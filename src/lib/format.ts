const numberFormatter = new Intl.NumberFormat("vi-VN");
const compactFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactUsdFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined): string {
  return value == null ? "—" : numberFormatter.format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  return value == null ? "—" : compactFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(value: number | null | undefined): string {
  if (value == null) return "—";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} phút ${seconds.toString().padStart(2, "0")} giây`;
}

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? "—" : usdFormatter.format(value);
}

export function formatCompactCurrency(value: number | null | undefined): string {
  return value == null ? "—" : `${compactUsdFormatter.format(value)} USD`;
}

export function formatMonth(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "—";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
