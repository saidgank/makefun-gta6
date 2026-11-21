// Solmar Heat — keyboard and mouse input. Held keys are read as axes every step;
// one-shot presses (enter a car, confirm, pause, switch weapon, mute) are queued as
// named actions and taken once by the loop, so a press between frames is never lost
// and never counted twice.

const ACTION_KEYS = {
  KeyE: 'enter',
  Enter: 'confirm',
  KeyP: 'pause',
  Escape: 'pause',
  KeyQ: 'weapon',
  Digit1: 'weapon',
  Digit2: 'weapon',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = new Set();
  const actions = [];
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    held.add(event.code);
    const action = ACTION_KEYS[event.code];
    if (action && !event.repeat) actions.push(action);
    if (event.code === 'Space' && !event.repeat) actions.push('confirm');
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    actions.push('click');
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** Movement axes, each -1..1: x right, y down. */
    axes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Throttle for driving: 1 forward, -1 brake/reverse. */
    throttle() {
      return (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    },
    /** Steering for driving: -1 left, 1 right. */
    steer() {
      return (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    handbrake() {
      return held.has('Space');
    },
    attacking() {
      return mouse.down || held.has('KeyF');
    },
    /** Drain the one-shot action queue. */
    takeActions() {
      return actions.splice(0, actions.length);
    },
  };
}
