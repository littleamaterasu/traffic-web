export const DEFAULT_TRAFFIC_MONTHS = 3;
export const MIN_TRAFFIC_MONTHS = 3;
export const MAX_TRAFFIC_MONTHS = 12;

export function getTrafficMonths(value = process.env.TRAFFIC_MONTHS): number {
  if (value == null || value.trim() === "") return DEFAULT_TRAFFIC_MONTHS;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `TRAFFIC_MONTHS phải là số nguyên từ ${MIN_TRAFFIC_MONTHS} đến ${MAX_TRAFFIC_MONTHS}.`,
    );
  }

  const months = Number(normalized);
  if (months < MIN_TRAFFIC_MONTHS || months > MAX_TRAFFIC_MONTHS) {
    throw new Error(
      `TRAFFIC_MONTHS phải nằm trong khoảng ${MIN_TRAFFIC_MONTHS}–${MAX_TRAFFIC_MONTHS}.`,
    );
  }

  return months;
}
export function isFakeDataEnabled(): boolean {
  return process.env.USE_FAKE_TRAFFIC_DATA?.trim().toLowerCase() === "true";
}
