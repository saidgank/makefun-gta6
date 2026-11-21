// Solmar Heat — a seeded random stream (mulberry32) with the everyday helpers the game
// wants bound to it. Seeded worlds make the screenshot scenes deterministic: the same
// seed always dresses the city the same way, paints the same traffic and shirts the
// same pedestrians.

/** Create a raw generator from a 32-bit seed: a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded stream plus range, integer, chance and pick helpers. */
export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], both ends included. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }

  /** One element of a list. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}

/** The paint shelf for civilian cars. */
export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#f7e463', '#2ecc71', '#1abc9c', '#3498db',
  '#9b59b6', '#ecf0f1', '#95a5a6', '#e67e22', '#fd79a8', '#f6e58d',
];

/** Shirt colours for pedestrians. */
export const SHIRT_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43',
  '#54a0ff', '#5f27cd', '#c8d6e5', '#ff7847', '#78e08f', '#e77f67',
];
