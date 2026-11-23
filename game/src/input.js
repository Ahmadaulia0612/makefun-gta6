// Keyboard and mouse input. Held keys give a move/steer vector; one-shot
// presses (enter car, punch, pause, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted
// twice. Mouse position is kept in screen pixels and converted to world
// coordinates by the caller, which knows the camera.
export const ACTION_ENTER_CAR = 1;
export const ACTION_ATTACK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyF') actions |= ACTION_ATTACK;
    else if (event.code === 'Space') actions |= ACTION_ATTACK;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_ATTACK;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function axis(negSet, posSet) {
    let value = 0;
    for (const code of negSet) if (keys.has(code)) value -= 1;
    for (const code of posSet) if (keys.has(code)) value += 1;
    return value;
  }

  return {
    /** Move vector: x is -1..1 (left/right), y is -1..1 (up/down). */
    move() {
      const x = axis(LEFT, RIGHT);
      const y = axis(UP, DOWN);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
    },
    runHeld() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    handbrakeHeld() {
      return keys.has('Space');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
