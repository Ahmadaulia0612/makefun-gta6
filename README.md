# Solmar Bay — Open World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ahmadaulia0612/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ahmadaulia0612/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **gta6-01** bounty. It runs entirely offline in a desktop browser
from static files — no build step, no network requests, no assets borrowed
from any commercial game. Every street, character, vehicle, name and story
beat is original.

## Play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

## The game

You are **Rio Vega**, a wheelman trying to go straight in the sun-soaked
coastal city of **Solmar Bay** — until the city pulls him back in.

- **A city to explore** on foot and by car: a seeded grid of roads,
  pastel buildings, parks, a beach and a marina, with traffic and
  pedestrians living their own lives.
- **Steal and drive**: walk up to any car, press **E**, and it is yours —
  if anyone sees you take it, the cops will know.
- **Wanted level (1–5 stars)**: crimes raise it, the police answer with
  patrol cars, foot cops and, at three stars, gunfire. Stay clean and
  unseen and the heat fades.
- **Six story missions**: from *First Wheels* to *The Big Score* at Bay
  Bank, with pickups, deliveries, escapes and a turf war.
- **Combat**: fists, a pistol, rival gang members, health and ammo
  pickups, car explosions.
- **HUD with a live minimap**, cash, health, wanted stars, speed and
  mission objective with distance.
- **Start screen, pause, Busted / Wasted screens, and autosave** —
  progress (cash, missions, health, ammo) survives closing the tab.
- **Synthesised sound**: engine hum, police siren, gunshots, crashes and
  mission jingles, all generated with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Steal / exit car |
| Mouse click | Shoot (pistol) |
| F | Punch |
| Shift | Run |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## Screenshots

The four screenshots under `screenshots/` are real renders of the game's
own code, staged with `?shot=cover|drive|foot|mission&seed=7` (see
`shots.json`).

## Structure

```
game/
  index.html        entry point
  src/
    config.js       tuning, palette, city names
    random.js       seeded RNG
    input.js        keyboard + mouse
    audio.js        synthesised WebAudio sound
    world.js        city generation + collision
    state.js        the whole game state
    traffic.js      traffic, pedestrians, driving physics
    police.js       wanted level + police AI
    combat.js       shooting, rivals, pickups, explosions
    missions.js     the six-mission story
    minimap.js      HUD minimap
    render.js       world, HUD and menu drawing
    save.js         localStorage save / load
    shots.js        staged screenshot scenes
    main.js         boot + fixed-step game loop
```

## License

MIT — see `LICENSE`.
