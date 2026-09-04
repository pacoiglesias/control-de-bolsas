export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
