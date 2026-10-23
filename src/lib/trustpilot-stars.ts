export const STAR_BOX_COUNT = 5;

function isPositiveScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function computeStarFills(score: unknown, fallbackScore?: unknown): number[] {
  const source = isPositiveScore(score) ? score : isPositiveScore(fallbackScore) ? fallbackScore : null;
  if (source === null) return [];
  const clamped = Math.min(source, STAR_BOX_COUNT);
  const rounded = Math.round(clamped * 2) / 2;
  return Array.from({ length: STAR_BOX_COUNT }, (_, index) => Math.min(Math.max(rounded - index, 0), 1));
}
