import type { Hex } from './types';

export const key = (hex: Hex): string => `${hex.q},${hex.r}`;
export const equal = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
export const distance = (a: Hex, b: Hex): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
const DIRECTIONS: readonly Hex[] = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
export const neighbors = (hex: Hex): Hex[] => DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
export function disk(radius: number): Hex[] {
  const cells: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) cells.push({ q, r });
  }
  return cells;
}
export function pixel(hex: Hex, size = 43): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (hex.q + hex.r / 2), y: size * 1.5 * hex.r };
}
function roundHex(q: number, r: number): Hex {
  let x = Math.round(q);
  let z = Math.round(r);
  const y = Math.round(-q - r);
  const dx = Math.abs(x - q);
  const dz = Math.abs(z - r);
  if (dx > Math.abs(y + q + r) && dx > dz) x = -y - z;
  else if (dz > Math.abs(y + q + r)) z = -x - y;
  return { q: x, r: z };
}
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (!n) return [{ ...a }];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return roundHex(a.q + (b.q - a.q) * t + 0.000001, a.r + (b.r - a.r) * t + 0.000002);
  });
}
