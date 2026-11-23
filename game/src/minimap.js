// The minimap: the whole city shrunk into a corner of the HUD — roads,
// parks, buildings, the sea, the mission marker, traffic, police and the
// player arrow. Drawn onto the main canvas, no extra element.
import { BEACH_Y, MARINA_X } from './world.js';
import { WORLD } from './config.js';

export function drawMinimap(ctx, state, x, y, size) {
  const scale = size / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 6, size + 12, size + 12);
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Ground, sea and beach.
  ctx.fillStyle = '#5d7d4a';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#2fa8c9';
  ctx.fillRect(x, y + BEACH_Y * scale, size, size - BEACH_Y * scale);
  ctx.fillRect(x + MARINA_X * scale, y, size - MARINA_X * scale, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + (BEACH_Y - 40) * scale, size, 40 * scale);
  // Parks and buildings.
  ctx.fillStyle = '#4c8a3f';
  for (const park of state.city.parks) ctx.fillRect(x + park.x * scale, y + park.y * scale, park.w * scale, park.h * scale);
  ctx.fillStyle = 'rgba(220, 220, 220, 0.55)';
  for (const b of state.city.buildings) ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  // Roads on the minimap: lighter than the main view so the grid reads.
  ctx.strokeStyle = '#6a7080';
  ctx.lineWidth = Math.max(2, 96 * scale);
  for (const rx of state.city.roadXs) {
    ctx.beginPath();
    ctx.moveTo(x + rx * scale, y);
    ctx.lineTo(x + rx * scale, y + size);
    ctx.stroke();
  }
  for (const ry of state.city.roadYs) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * scale);
    ctx.lineTo(x + size, y + ry * scale);
    ctx.stroke();
  }
  // Mission marker: pulsing yellow diamond.
  if (state.mission.marker) {
    const pulse = 5 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(x + state.mission.marker.x * scale, y + state.mission.marker.y * scale - pulse);
    ctx.lineTo(x + state.mission.marker.x * scale + pulse, y + state.mission.marker.y * scale);
    ctx.lineTo(x + state.mission.marker.x * scale, y + state.mission.marker.y * scale + pulse);
    ctx.lineTo(x + state.mission.marker.x * scale - pulse, y + state.mission.marker.y * scale);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic dots, police flashing dots.
  ctx.fillStyle = '#cfd3da';
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    ctx.fillRect(x + car.x * scale - 1, y + car.y * scale - 1, 2.5, 2.5);
  }
  const flash = Math.floor(state.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  for (const cop of state.footCops) {
    ctx.fillRect(x + cop.x * scale - 1.5, y + cop.y * scale - 1.5, 3, 3);
  }
  // Player arrow.
  const px = x + state.player.x * scale;
  const py = y + state.player.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(state.player.angle) * 7, py + Math.sin(state.player.angle) * 7);
  ctx.lineTo(px + Math.cos(state.player.angle + 2.5) * 5, py + Math.sin(state.player.angle + 2.5) * 5);
  ctx.lineTo(px + Math.cos(state.player.angle - 2.5) * 5, py + Math.sin(state.player.angle - 2.5) * 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
