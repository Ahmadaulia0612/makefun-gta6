// Drawing only: the city, every actor, the HUD with its minimap, and the
// menu screens. The world's state and the current screen in, pixels out.
// The camera lives in state.camera; this file never moves it.
import { FONT, PALETTE, WORLD } from './config.js';
import { BEACH_Y, MARINA_X, SEA_Y } from './world.js';
import { drawMinimap } from './minimap.js';
import { currentObjective, MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_OVER = 'complete';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cssW = 1280;
  let cssH = 720;
  const fonts = new Map();
  function font(size, bold) {
    const key = `${bold ? '700 ' : ''}${size}px`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function viewBounds(state) {
    const cam = state.camera;
    const hw = cssW / 2 / cam.zoom;
    const hh = cssH / 2 / cam.zoom;
    return { x0: cam.x - hw - 60, y0: cam.y - hh - 60, x1: cam.x + hw + 60, y1: cam.y + hh + 60 };
  }

  function drawGround(state, v) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // Sea along the south and east edges, beach in front of it.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(v.x0, Math.max(v.y0, SEA_Y), v.x1 - v.x0, v.y1 - Math.max(v.y0, SEA_Y));
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(v.x0, Math.max(v.y0, BEACH_Y + 60), v.x1 - v.x0, Math.min(v.y1, SEA_Y) - Math.max(v.y0, BEACH_Y + 60));
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(v.x0, Math.max(v.y0, BEACH_Y), v.x1 - v.x0, Math.min(v.y1, BEACH_Y + 60) - Math.max(v.y0, BEACH_Y));
    // Parks.
    for (const park of state.city.parks) {
      if (park.x > v.x1 || park.x + park.w < v.x0 || park.y > v.y1 || park.y + park.h < v.y0) continue;
      ctx.fillStyle = '#5d8a48';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#6fa055';
      ctx.fillRect(park.x + 8, park.y + 8, park.w - 16, park.h - 16);
    }
    // Parking lots.
    for (const lot of state.city.parkingLots) {
      if (lot.x > v.x1 || lot.x + lot.w < v.x0 || lot.y > v.y1 || lot.y + lot.h < v.y0) continue;
      ctx.fillStyle = '#555a66';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 20; x < lot.x + lot.w - 10; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 12);
        ctx.lineTo(x, lot.y + 44);
        ctx.stroke();
      }
    }
    // Sidewalks then roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of state.city.roadXs) ctx.fillRect(rx - 62, v.y0, 124, v.y1 - v.y0);
    for (const ry of state.city.roadYs) ctx.fillRect(v.x0, ry - 62, v.x1 - v.x0, 124);
    ctx.fillStyle = PALETTE.road;
    for (const rx of state.city.roadXs) ctx.fillRect(rx - 48, v.y0, 96, v.y1 - v.y0);
    for (const ry of state.city.roadYs) ctx.fillRect(v.x0, ry - 48, v.x1 - v.x0, 96);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of state.city.roadXs) {
      for (let y = Math.floor(v.y0 / 44) * 44; y < v.y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of state.city.roadYs) {
      for (let x = Math.floor(v.x0 / 44) * 44; x < v.x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Crosswalk stripes at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of state.city.roadXs) {
      for (const ry of state.city.roadYs) {
        if (rx < v.x0 || rx > v.x1 || ry < v.y0 || ry > v.y1) continue;
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(rx + i * 12 - 3, ry - 56, 6, 14);
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(rx - 56, ry + i * 12 - 3, 14, 6);
      }
    }
  }

  function drawBuildings(state, v) {
    for (const b of state.city.buildings) {
      if (b.x > v.x1 || b.x + b.w < v.x0 || b.y > v.y1 || b.y + b.h < v.y0) continue;
      // Sun shadow to the south-east.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + b.height * 0.7, b.y + b.height * 0.7, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      if (b.windows) {
        ctx.fillStyle = 'rgba(30,45,70,0.55)';
        for (let wx = b.x + 14; wx < b.x + b.w - 12; wx += 26) {
          for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 26) ctx.fillRect(wx, wy, 12, 12);
        }
      }
      if (b.name) {
        ctx.font = font(15, true);
        ctx.fillStyle = 'rgba(20,26,36,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    // Palms: trunk dot and frond canopy.
    for (const palm of state.city.palms) {
      if (palm.x < v.x0 || palm.x > v.x1 || palm.y < v.y0 || palm.y > v.y1) continue;
      ctx.fillStyle = '#3f7d33';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a047';
      ctx.beginPath();
      ctx.arc(palm.x - 4, palm.y - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a34';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -30, -14, 62, 32, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -32, -16, 64, 32, 9);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(-6, -16, 18, 32);
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-4, -20, 10, 7);
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-4, 13, 10, 7);
    } else {
      ctx.fillStyle = 'rgba(20,30,45,0.85)';
      roundRect(ctx, -8, -13, 20, 26, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(8, -12, 8, 24);
    }
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(31, -10, 3, 0, Math.PI * 2);
    ctx.arc(31, 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-33, -11, 3, 6);
    ctx.fillRect(-33, 5, 3, 6);
    if (isPlayer) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2.5;
      roundRect(ctx, -34, -18, 68, 36, 10);
      ctx.stroke();
    }
    if (car.health < 40 && car.health > 0) {
      ctx.fillStyle = 'rgba(90,90,90,0.7)';
      ctx.beginPath();
      ctx.arc(-18, -6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, isPlayer, hasGun) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(4, -6, 4, 0, Math.PI * 2);
    ctx.arc(4, 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick / gun.
    ctx.fillStyle = isPlayer ? '#f2c94c' : 'rgba(20,20,20,0.6)';
    ctx.fillRect(8, -2, hasGun ? 16 : 8, 4);
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(state) {
    const v = viewBounds(state);
    drawGround(state, v);
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.35)';
    ctx.lineWidth = 5;
    for (const skid of state.skids) {
      if (skid.x < v.x0 || skid.x > v.x1 || skid.y < v.y0 || skid.y > v.y1) continue;
      ctx.beginPath();
      ctx.moveTo(skid.x, skid.y);
      ctx.lineTo(skid.x - Math.cos(skid.angle) * 26, skid.y - Math.sin(skid.angle) * 26);
      ctx.stroke();
    }
    drawBuildings(state, v);
    // Mission marker: beacon column and pulsing ring.
    if (state.mission.marker) {
      const mk = state.mission.marker;
      const pulse = 1 + Math.sin(state.time * 4) * 0.12;
      ctx.fillStyle = 'rgba(242,201,76,0.18)';
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, mk.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, mk.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f2c94c';
      ctx.save();
      ctx.translate(mk.x, mk.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
    }
    // Pickups.
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      ctx.fillStyle = pickup.kind === 'health' ? '#e5534b' : pickup.kind === 'ammo' ? '#3aa655' : '#f2c94c';
      roundRect(ctx, pickup.x - 13, pickup.y - 13 + bob, 26, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(ctx, pickup.x - 13, pickup.y - 13 + bob, 26, 26, 6);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = font(16, true);
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'ammo' ? 'A' : '$', pickup.x, pickup.y + 6 + bob);
    }
    // Pedestrians, cops, rivals.
    for (const ped of state.peds) {
      if (ped.mode === 'down') {
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.color, false, false);
    }
    for (const cop of state.footCops) drawPerson(cop.x, cop.y, cop.angle, cop.color, false, true);
    for (const enemy of state.enemies) {
      drawPerson(enemy.x, enemy.y, enemy.angle, enemy.color, false, true);
      ctx.fillStyle = '#111111';
      ctx.fillRect(enemy.x - 16, enemy.y - 26, 32, 5);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(enemy.x - 16, enemy.y - 26, 32 * Math.max(0, enemy.health / 100), 5);
    }
    // Cars (player's car last so it draws on top).
    for (const car of state.cars) {
      if (car === state.player.car) continue;
      drawCarShape(car, false);
    }
    if (state.player.car) drawCarShape(state.player.car, true);
    // The player on foot.
    const player = state.player;
    if (player.onFoot) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(player.x, player.y, player.angle, '#f5f5f5', true, player.weapon === 'pistol');
    }
    // Bullets as tracers.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(x, y, wanted) {
    for (let i = 0; i < 5; i += 1) {
      ctx.font = font(26, true);
      ctx.fillStyle = i < wanted ? '#f2c94c' : 'rgba(255,255,255,0.28)';
      ctx.textAlign = 'left';
      ctx.fillText('★', x + i * 28, y);
    }
  }

  function drawHud(state) {
    const player = state.player;
    // Top-right: cash, health, wanted.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, cssW - 246, 12, 234, 108, 10);
    ctx.fill();
    text(`$${player.cash.toLocaleString('en-US')}`, cssW - 28, 44, 26, '#7CFC9A', 'right', true);
    ctx.fillStyle = '#222831';
    roundRect(ctx, cssW - 218, 56, 190, 12, 6);
    ctx.fill();
    ctx.fillStyle = player.health > 40 ? '#3aa655' : '#e5534b';
    roundRect(ctx, cssW - 218, 56, 190 * Math.max(0, player.health / player.maxHealth), 12, 6);
    ctx.fill();
    drawStars(cssW - 218, 102, state.wanted);
    text(state.wanted > 0 ? 'WANTED' : 'CLEAN', cssW - 28, 102, 15, state.wanted > 0 ? '#ff8a7a' : '#cfd3da', 'right', true);
    // Top-centre: mission + objective.
    const mission = state.mission;
    if (mission.active) {
      const title = `MISSION ${mission.index + 1} — ${MISSIONS[mission.index].title.toUpperCase()}`;
      text(title, cssW / 2, 34, 17, '#f2c94c', 'center', true);
      text(currentObjective(state), cssW / 2, 58, 19, PALETTE.text, 'center');
      if (mission.marker) {
        const d = Math.round(Math.hypot(player.x - mission.marker.x, player.y - mission.marker.y));
        text(`${d}m`, cssW / 2, 80, 15, '#cfd3da', 'center');
      }
    } else if (mission.done) {
      text('SOLMAR BAY — FREE ROAM', cssW / 2, 34, 17, '#f2c94c', 'center', true);
      text('Steal cars, cause chaos, or replay missions from the menu.', cssW / 2, 58, 16, PALETTE.text, 'center');
    }
    // Messages feed, top-left, below the mission title.
    state.messages.forEach((msg, i) => {
      const age = state.time - msg.t;
      if (age > 6) return;
      ctx.globalAlpha = age > 4 ? (6 - age) / 2 : 1;
      text(msg.text, 16, 112 + i * 24, 16, PALETTE.text);
      ctx.globalAlpha = 1;
    });
    // Banner.
    if (state.banner && state.bannerTimer > 0) {
      const a = Math.min(1, state.bannerTimer);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(12,16,24,0.8)';
      const w = 460;
      roundRect(ctx, cssW / 2 - w / 2, cssH / 2 - 90, w, 86, 12);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      roundRect(ctx, cssW / 2 - w / 2, cssH / 2 - 90, w, 86, 12);
      ctx.stroke();
      text(state.banner.title, cssW / 2, cssH / 2 - 52, 26, '#f2c94c', 'center', true);
      if (state.banner.sub) text(state.banner.sub, cssW / 2, cssH / 2 - 24, 15, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
    // Minimap, bottom-left, with its label above it.
    drawMinimap(ctx, state, 22, cssH - 212, 190);
    text('SOLMAR BAY', 22, cssH - 224, 13, '#ffffff', 'left', true);
    // Bottom-right: weapon, ammo, speed — one panel, no overlap.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, cssW - 206, cssH - 84, 194, 72, 10);
    ctx.fill();
    text(player.weapon === 'pistol' ? 'PISTOL' : 'FISTS', cssW - 28, cssH - 52, 18, PALETTE.text, 'right', true);
    if (player.weapon === 'pistol') text(`AMMO ${player.ammo}`, cssW - 28, cssH - 28, 16, '#f2c94c', 'right', true);
    if (player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * 0.32);
      text(`${kmh} km/h`, cssW - 188, cssH - 52, 18, PALETTE.text, 'left', true);
      const hp = Math.max(0, player.car.health);
      text(`CAR ${Math.round(hp)}%`, cssW - 188, cssH - 28, 14, hp > 40 ? '#cfd3da' : '#ff8a7a', 'left', true);
    } else if (player.weapon !== 'pistol') {
      text('E — enter car   F — punch', cssW - 188, cssH - 28, 13, '#cfd3da', 'left');
    }
    // Controls hint, first seconds of play (never in staged screenshots).
    if (state.time < 14 && state.mode === 'play' && !state.isShot) {
      ctx.globalAlpha = Math.max(0, 1 - state.time / 14);
      text('WASD move / drive   •   E steal car   •   Click shoot   •   Shift run   •   P pause   •   M mute', cssW / 2, cssH - 14, 14, '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.66)';
    ctx.fillRect(0, 0, cssW, cssH);
    const w = 620;
    const h = 150 + lines.length * 30;
    const x = (cssW - w) / 2;
    const y = (cssH - h) / 2;
    ctx.fillStyle = 'rgba(16, 20, 30, 0.94)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || '#f2c94c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    text(title, cssW / 2, y + 62, 40, accent || '#f2c94c', 'center', true);
    lines.forEach((line, i) => text(line, cssW / 2, y + 104 + i * 30, 18, PALETTE.text, 'center'));
    text(prompt, cssW / 2, y + h - 26, 17, '#f2c94c', 'center', true);
  }

  function draw(state, screen) {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#10141d';
    ctx.fillRect(0, 0, cssW, cssH);
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? (state.random() - 0.5) * cam.shake : 0;
    const shakeY = cam.shake > 0 ? (state.random() - 0.5) * cam.shake : 0;
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawWorld(state);
    ctx.restore();
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
      ctx.fillRect(0, 0, cssW, cssH);
      text('SOLMAR BAY', cssW / 2, cssH / 2 - 128, 84, '#f2c94c', 'center', true);
      text('An open-world crime story', cssW / 2, cssH / 2 - 88, 24, PALETTE.text, 'center');
      text('Steal cars. Outrun the cops. Pull the big score.', cssW / 2, cssH / 2 - 58, 18, '#cfd3da', 'center');
      const lines = [
        'WASD / arrows — move & drive      E — steal / exit car',
        'Mouse click — shoot      F — punch      Shift — run      Space — handbrake',
        'P — pause      M — mute      Progress saves automatically',
      ];
      const hasSave = state.saveExists;
      const prompt = hasSave ? 'ENTER — continue your story    •    N — new game' : 'Press ENTER or click to start';
      const w = 640;
      const h = 130 + lines.length * 28;
      const x = (cssW - w) / 2;
      const y = cssH / 2 - 20;
      ctx.fillStyle = 'rgba(16, 20, 30, 0.92)';
      roundRect(ctx, x, y, w, h, 12);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 12);
      ctx.stroke();
      lines.forEach((line, i) => text(line, cssW / 2, y + 44 + i * 28, 17, PALETTE.text, 'center'));
      text(prompt, cssW / 2, y + h - 24, 18, '#f2c94c', 'center', true);
      if (hasSave) text('Saved game found — your cash and missions are waiting.', cssW / 2, cssH - 24, 15, '#cfd3da', 'center');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Take a breath, Rio. The city waits.', `Missions done: ${state.stats.missionsDone} / 6     Cash: $${state.player.cash.toLocaleString('en-US')}`], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar Bay PD caught up with you.', `You lost $${Math.round(state.player.cash * 0.15).toLocaleString('en-US')} in fines. The story continues.`], 'Press ENTER to get back out there', '#3b82f6');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rio went down — but Solmar Bay never sleeps.', 'You wake up at the hospital. The story continues.'], 'Press ENTER to get back out there', '#e5534b');
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE BIG SCORE', ['Bay Bank is empty. Rio Vega is a legend.', `Final cash: $${state.player.cash.toLocaleString('en-US')}     Missions: 6 / 6     Kills: ${state.stats.kills}`, 'Free roam continues — press ENTER to keep playing'], '#7CFC9A');
    }
  }

  return { draw, cssSize() { return { w: cssW, h: cssH }; } };
}
