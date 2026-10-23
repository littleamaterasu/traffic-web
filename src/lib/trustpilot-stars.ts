export const STAR_BOX_COUNT = 5;

export function computeStarFills(score: unknown): number[] {
  if (typeof score !== "number" || !Number.isFinite(score)) return [];
  const clamped = Math.min(Math.max(score, 0), STAR_BOX_COUNT);
  const rounded = Math.round(clamped * 2) / 2;
  return Array.from({ length: STAR_BOX_COUNT }, (_, index) => Math.min(Math.max(rounded - index, 0), 1));
}
