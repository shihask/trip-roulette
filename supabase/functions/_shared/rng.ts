/**
 * Uniform selection for the roulette (ARCHITECTURE §6.5). Web Crypto with rejection sampling:
 * 32-bit values at or above the largest multiple of n below 2^32 are discarded, so each index has
 * probability exactly 1/n. The random source is injectable for tests.
 */

export type RandomUint32 = () => number;

export const RNG_NAME = "webcrypto-rejection";

export const webCryptoUint32: RandomUint32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function uniformIndex(n: number, random: RandomUint32 = webCryptoUint32): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError("n must be a positive integer");
  const limit = 2 ** 32 - (2 ** 32 % n); // largest multiple of n not above 2^32
  for (let attempt = 0; attempt < 1000; attempt++) {
    const v = random();
    if (v < limit) return v % n;
  }
  // Probability of reaching here with a real RNG is < (1/2^31)^1000.
  throw new Error("random source keeps returning rejected values");
}
