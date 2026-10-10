/**
 * RAND (2ND ÷): a deterministic uniform generator, mulberry32, whose 32-bit state lives in
 * `state.randSeed` so sequences replay exactly (and survive persistence). Values satisfy 0 < x < 1.
 * `n STO 2ND RAND` (n a positive integer) seeds it: the same seed always gives the same sequence.
 */
import { CalcError } from "../errors";
import { round13 } from "../finance/precision";

/** Advance the generator. Returns the value and the next state to store in `randSeed`. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let a = seed | 0;
  for (;;) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const value = round13(u);
    if (value > 0 && value < 1) return { value, seed: a };
  }
}

/** Validate a keyed seed (a positive integer; Error 2 otherwise) and convert it to generator state. */
export function seedFrom(x: number): number {
  if (!Number.isInteger(x) || x <= 0) throw new CalcError(2);
  return Number(BigInt.asIntN(32, BigInt(x)));
}
