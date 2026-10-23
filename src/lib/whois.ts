import { createCachedStore } from "@/lib/cached-store";
import {
  classifyAge,
  computeAgeYears,
  detectPrivacy,
  normalizeNameServers,
} from "@/lib/whois-insights";
import type { WhoisRecord } from "@/types/whois";

const WHOIS_BASE_URL = "https://www.whoisxmlapi.com/whoisserver/WhoisService";
const DAY_MS = 24 * 60 * 60 * 1000;

export class WhoisApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WhoisApiError";
  }
}

interface UpstreamContact {
  organization?: unknown;
  name?: unknown;
}

interface UpstreamRegistryData {
  createdDate?: unknown;
  updatedDate?: unknown;
  expiresDate?: unknown;
  status?: unknown;
}

interface UpstreamWhoisRecord {
  createdDate?: unknown;
  updatedDate?: unknown;
  expiresDate?: unknown;
  estimatedDomainAge?: unknown;
  registrarName?: unknown;
  status?: unknown;
  nameServers?: { hostNames?: unknown } | null;
  registrant?: UpstreamContact | null;
  registryData?: UpstreamRegistryData | null;
  dataError?: unknown;
}

interface UpstreamWhoisBody {
  WhoisRecord?: UpstreamWhoisRecord;
  ErrorMessage?: unknown;
}

function vietnameseError(status: number): string {
  if (status === 401 || status === 403) return "WHOIS_API_KEY không hợp lệ hoặc đã hết hạn.";
  if (status === 402) return "Tài khoản WhoisXML không đủ credits.";
  if (status === 429) return "WhoisXML đang giới hạn lượt gọi hoặc đã hết quota.";
  return "Không thể lấy dữ liệu WHOIS lúc này.";
}

function failure(status: number): WhoisApiError {
  if (status === 401 || status === 403) {
    return new WhoisApiError(401, "invalid_api_key", vietnameseError(401));
  }
  if (status === 402) {
    return new WhoisApiError(402, "insufficient_credits", vietnameseError(402));
  }
  if (status === 429) {
    return new WhoisApiError(429, "rate_limited", vietnameseError(429));
  }
  return new WhoisApiError(502, "whois_error", vietnameseError(502));
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function requestWhois<T>(
  baseUrl: string,
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const url = `${baseUrl}?${new URLSearchParams({ ...params, apiKey })}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new WhoisApiError(502, "network_error", "Không thể kết nối đến WhoisXML.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw failure(502);
  }

  if (!response.ok) throw failure(response.status);

  return body as T;
}

function parseStatus(value: unknown): string[] {
  const tokens: string[] = [];
  if (typeof value === "string") tokens.push(...value.split(/\s+/));
  else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") tokens.push(...item.split(/\s+/));
    }
  }
  return tokens.filter((token) => token && !token.toLowerCase().startsWith("http"));
}

function wholeDaysBetween(createdDate: string | null, now: Date): number | null {
  if (!createdDate) return null;
  const time = Date.parse(createdDate);
  if (Number.isNaN(time) || time > now.getTime()) return null;
  return Math.floor((now.getTime() - time) / DAY_MS);
}

export async function fetchWhoisRecord(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<WhoisRecord | null> {
  const body = await requestWhois<UpstreamWhoisBody | null>(
    WHOIS_BASE_URL,
    { domainName: domain, outputFormat: "JSON" },
    apiKey,
    fetchImpl,
  );

  if (!body || typeof body !== "object" || body.ErrorMessage) throw failure(502);

  const record = body.WhoisRecord;
  if (!record || typeof record !== "object") return null;

  const registry = record.registryData ?? {};
  const created = str(record.createdDate) ?? str(registry.createdDate);
  const updated = str(record.updatedDate) ?? str(registry.updatedDate);
  const expires = str(record.expiresDate) ?? str(registry.expiresDate);
  const registrar = str(record.registrarName);

  if (record.dataError === "MISSING_WHOIS_DATA" && !created && !updated && !expires && !registrar) {
    return null;
  }

  const estimated = num(record.estimatedDomainAge);
  const ageYears = computeAgeYears(created, estimated, now);
  const organization = str(record.registrant?.organization);
  const registrantName = str(record.registrant?.name);

  return {
    created_date: created,
    updated_date: updated,
    expires_date: expires,
    age_days: estimated ?? wholeDaysBetween(created, now),
    age_years: ageYears,
    age_verdict: classifyAge(ageYears),
    registrar,
    status: parseStatus(record.status ?? registry.status),
    name_servers: normalizeNameServers(record.nameServers?.hostNames),
    registrant_organization: organization,
    privacy_protected: detectPrivacy(organization, registrantName),
  };
}

const recordStore = createCachedStore<WhoisRecord | null>();

export function getWhoisRecord(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WhoisRecord | null> {
  return recordStore.get(domain, () => fetchWhoisRecord(domain, apiKey, fetchImpl));
}

export function clearWhoisCache(): void {
  recordStore.clear();
}
