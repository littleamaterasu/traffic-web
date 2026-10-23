import { formatDate, formatNumber } from "@/lib/format";
import type {
  WhoisAgeLevel,
  WhoisAgeVerdict,
  WhoisChangeEvent,
  WhoisChangeField,
  WhoisHistory,
  WhoisHistoryRecordInput,
  WhoisHistorySummary,
} from "@/types/whois";

export const WHOIS_EVENT_CAP = 30;

export const WHOIS_AGE_VERDICT_LABELS: Record<WhoisAgeLevel, string> = {
  very_new: "Domain rất mới (dưới 1 năm)",
  new: "Domain còn mới (1–3 năm)",
  established: "Domain lâu năm (trên 3 năm)",
};

export const WHOIS_FIELD_LABELS: Record<WhoisChangeField, string> = {
  registrar: "Nhà đăng ký",
  name_servers: "Name server",
  registrant: "Chủ sở hữu",
  expires: "Hết hạn",
};

const PRIVACY_PATTERN =
  /privacy|proxy|redacted|whoisguard|data protected|withheld|identity protect|not disclosed/i;

function addYearsUtc(date: Date, years: number): number {
  return Date.UTC(
    date.getUTCFullYear() + years,
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
}

export function yearsBetween(from: Date, to: Date): number {
  let whole = to.getUTCFullYear() - from.getUTCFullYear();
  if (addYearsUtc(from, whole) > to.getTime()) whole -= 1;
  const start = addYearsUtc(from, whole);
  const end = addYearsUtc(from, whole + 1);
  const fraction = end > start ? (to.getTime() - start) / (end - start) : 0;
  return whole + fraction;
}

export function computeAgeYears(
  createdDate: string | null,
  estimatedDomainAge: number | null,
  now: Date,
): number | null {
  if (createdDate) {
    const time = Date.parse(createdDate);
    if (!Number.isNaN(time)) {
      if (time > now.getTime()) return null;
      return yearsBetween(new Date(time), now);
    }
  }
  if (
    estimatedDomainAge != null &&
    Number.isFinite(estimatedDomainAge) &&
    estimatedDomainAge >= 0
  ) {
    return estimatedDomainAge / 365.25;
  }
  return null;
}

export function classifyAge(years: number | null): WhoisAgeVerdict | null {
  if (years == null || !Number.isFinite(years)) return null;
  const level: WhoisAgeLevel =
    years < 1 ? "very_new" : years <= 3 ? "new" : "established";
  return { level, label: WHOIS_AGE_VERDICT_LABELS[level] };
}

export function detectPrivacy(
  organization: string | null,
  name?: string | null,
): boolean | null {
  const text = organization?.trim() || name?.trim() || "";
  if (!text) return null;
  return PRIVACY_PATTERN.test(text);
}

export function normalizeNameServers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const result = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    for (const part of entry.split("|")) {
      const host = part.trim().toLowerCase().replace(/\.$/, "");
      if (host) result.add(host);
    }
  }
  return [...result].sort();
}

function expiryYear(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return String(new Date(time).getUTCFullYear());
}

function cleanText(value: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function compactHistory(
  records: WhoisHistoryRecordInput[],
  maxEvents: number = WHOIS_EVENT_CAP,
): WhoisHistory {
  const valid = records
    .map((record) => ({ record, time: record.audit ? Date.parse(record.audit) : NaN }))
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => a.time - b.time);

  const events: WhoisChangeEvent[] = [];
  const counts: Record<WhoisChangeField, number> = {
    registrar: 0,
    name_servers: 0,
    registrant: 0,
    expires: 0,
  };

  let lastRegistrar: string | null = null;
  let lastNameServers: string | null = null;
  let lastExpiry: string | null = null;
  let lastRegistrant: string | null = null;
  let lastRegistrantKey: string | null = null;
  let seenFirst = false;

  const push = (
    date: string,
    field: WhoisChangeField,
    from: string | null,
    to: string | null,
  ) => {
    events.push({ date, field, from, to });
    counts[field] += 1;
  };

  for (const { record } of valid) {
    const date = record.audit as string;
    const registrar = cleanText(record.registrar);
    const nameServers = normalizeNameServers(record.name_servers).join(", ") || null;
    const expiry = expiryYear(record.expires_date);
    const registrant = cleanText(record.registrant_organization);
    const registrantKey = registrant ? registrant.toLowerCase() : null;

    if (seenFirst) {
      if (registrar && lastRegistrar && registrar !== lastRegistrar) {
        push(date, "registrar", lastRegistrar, registrar);
      }
      if (nameServers && lastNameServers && nameServers !== lastNameServers) {
        push(date, "name_servers", lastNameServers, nameServers);
      }
      if (registrantKey !== lastRegistrantKey) {
        push(date, "registrant", lastRegistrant, registrant);
      }
      if (expiry && lastExpiry && expiry !== lastExpiry) {
        push(date, "expires", lastExpiry, expiry);
      }
    }

    if (registrar) lastRegistrar = registrar;
    if (nameServers) lastNameServers = nameServers;
    if (expiry) lastExpiry = expiry;
    lastRegistrant = registrant;
    lastRegistrantKey = registrantKey;
    seenFirst = true;
  }

  const total = events.length;
  const ordered = [...events].reverse().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return {
    summary: {
      records: valid.length,
      first_seen: valid.length > 0 ? (valid[0].record.audit as string) : null,
      changes_total: total,
      registrar_changes: counts.registrar,
      nameserver_changes: counts.name_servers,
      registrant_changes: counts.registrant,
      expiry_changes: counts.expires,
    },
    events: ordered.slice(0, maxEvents),
    events_truncated: total > maxEvents,
  };
}

export function summarizeVolatility(summary: WhoisHistorySummary): string {
  if (summary.records === 0) {
    return "Nhà cung cấp chưa có lịch sử WHOIS cho domain này.";
  }
  if (summary.records === 1) {
    return `Mới có 1 bản ghi (từ ${formatDate(summary.first_seen)}), chưa đủ dữ liệu để đánh giá mức độ thay đổi.`;
  }
  const base = `${formatNumber(summary.records)} bản ghi, theo dõi từ ${formatDate(summary.first_seen)}`;
  if (summary.changes_total === 0) {
    return `${base}: thông tin đăng ký ổn định, không ghi nhận thay đổi.`;
  }
  if (summary.changes_total <= 3) {
    return `${base}: có một vài thay đổi (${formatNumber(summary.changes_total)}).`;
  }
  return `${base}: thay đổi nhiều (${formatNumber(summary.changes_total)} lần), nên xem kỹ dòng thời gian.`;
}
