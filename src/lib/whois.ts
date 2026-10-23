import { createCachedStore } from "@/lib/cached-store";
import {
  classifyAge,
  compactHistory,
  computeAgeDays,
  computeAgeYears,
  detectPrivacy,
  normalizeNameServers,
} from "@/lib/whois-insights";
import type { WhoisHistory, WhoisHistoryRecordInput, WhoisRecord } from "@/types/whois";

const WHOIS_BASE_URL = "https://www.whoisxmlapi.com/whoisserver/WhoisService";
const HISTORY_BASE_URL = "https://whois-history.whoisxmlapi.com/api/v1";
export const HISTORY_RECORD_CAP = 100;
export const HISTORY_PURCHASES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

let purchaseTimestamps: number[] = [];

export function canonicalWhoisDomain(domain: string): string {
  const lower = domain.toLowerCase();
  if (!lower.startsWith("www.")) return lower;
  const rest = lower.slice(4);
  return rest.includes(".") ? rest : lower;
}

function reservePurchase(now: () => number): void {
  const current = now();
  purchaseTimestamps = purchaseTimestamps.filter((time) => time > current - DAY_MS);
  if (purchaseTimestamps.length >= HISTORY_PURCHASES_PER_DAY) {
    throw new WhoisApiError(
      429,
      "history_budget_exceeded",
      "Đã đạt giới hạn 10 lượt mua lịch sử WHOIS mỗi 24 giờ để bảo vệ credits WhoisXML. Vui lòng thử lại sau.",
    );
  }
  purchaseTimestamps.push(current);
}

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

export async function fetchWhoisRecord(
  rawDomain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<WhoisRecord | null> {
  const domain = canonicalWhoisDomain(rawDomain);
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
    age_days: computeAgeDays(created, estimated, now),
    age_years: ageYears,
    age_verdict: classifyAge(ageYears),
    registrar,
    status: parseStatus(record.status ?? registry.status),
    name_servers: normalizeNameServers(record.nameServers?.hostNames),
    privacy_protected: detectPrivacy(organization, registrantName),
  };
}

interface UpstreamHistoryRecord {
  audit?: unknown;
  registrarName?: unknown;
  nameServers?: unknown;
  expiresDateISO8601?: unknown;
  updatedDateISO8601?: unknown;
  createdDateISO8601?: unknown;
  registrantContact?: UpstreamContact | null;
}

interface UpstreamHistoryBody {
  recordsCount?: unknown;
  records?: unknown;
}

function readAudit(record: UpstreamHistoryRecord): string | null {
  const audit = record.audit;
  if (typeof audit === "string") return audit;
  if (audit && typeof audit === "object") {
    const nested = audit as { updatedDate?: unknown; createdDate?: unknown };
    const date = str(nested.updatedDate) ?? str(nested.createdDate);
    if (date) return date;
  }
  return str(record.updatedDateISO8601) ?? str(record.createdDateISO8601);
}

function toHistoryInput(raw: UpstreamHistoryRecord): WhoisHistoryRecordInput {
  const contact = raw.registrantContact;
  return {
    audit: readAudit(raw),
    registrar: str(raw.registrarName),
    name_servers: raw.nameServers,
    registrant_organization: str(contact?.organization) ?? str(contact?.name),
    expires_date: str(raw.expiresDateISO8601),
  };
}

async function fetchHistoryPreview(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<number> {
  const body = await requestWhois<UpstreamHistoryBody | null>(
    HISTORY_BASE_URL,
    { domainName: domain, mode: "preview" },
    apiKey,
    fetchImpl,
  );
  const count = num(body?.recordsCount);
  if (count === null) throw failure(502);
  return count;
}

async function fetchHistoryPurchase(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  cap: number,
): Promise<WhoisHistory> {
  const body = await requestWhois<UpstreamHistoryBody | null>(
    HISTORY_BASE_URL,
    { domainName: domain, mode: "purchase" },
    apiKey,
    fetchImpl,
  );
  if (!body || typeof body !== "object") throw failure(502);
  let records: UpstreamHistoryRecord[];
  if (Array.isArray(body.records)) records = body.records as UpstreamHistoryRecord[];
  else if (num(body.recordsCount) === 0) records = [];
  else throw failure(502);
  if (records.length > cap) throw tooManyRecords(records.length, cap);
  return compactHistory(
    records
      .filter((record) => record && typeof record === "object")
      .map((record) => toHistoryInput(record)),
  );
}

function tooManyRecords(count: number, cap: number): WhoisApiError {
  return new WhoisApiError(
    422,
    "too_many_records",
    `Domain có ${count} bản ghi lịch sử, vượt giới hạn ${cap} bản ghi cho mỗi lần tải nên hệ thống không mua dữ liệu để tiết kiệm credits.`,
  );
}

async function loadHistory(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  cap: number,
  count: number,
  reserve: () => void,
): Promise<WhoisHistory> {
  if (count > cap) throw tooManyRecords(count, cap);
  if (count === 0) return compactHistory([]);
  reserve();
  return fetchHistoryPurchase(domain, apiKey, fetchImpl, cap);
}

export async function fetchWhoisHistory(
  rawDomain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  cap: number = HISTORY_RECORD_CAP,
): Promise<WhoisHistory> {
  const domain = canonicalWhoisDomain(rawDomain);
  const count = await fetchHistoryPreview(domain, apiKey, fetchImpl);
  return loadHistory(domain, apiKey, fetchImpl, cap, count, () => undefined);
}

const recordStore = createCachedStore<WhoisRecord | null>();
const previewStore = createCachedStore<number>();
const historyStore = createCachedStore<WhoisHistory>();

export function getWhoisRecord(
  rawDomain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WhoisRecord | null> {
  const domain = canonicalWhoisDomain(rawDomain);
  return recordStore.get(domain, () => fetchWhoisRecord(domain, apiKey, fetchImpl));
}

export function getWhoisHistory(
  rawDomain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<WhoisHistory> {
  const domain = canonicalWhoisDomain(rawDomain);
  return historyStore.get(domain, async () => {
    const count = await previewStore.get(domain, () =>
      fetchHistoryPreview(domain, apiKey, fetchImpl),
    );
    return loadHistory(domain, apiKey, fetchImpl, HISTORY_RECORD_CAP, count, () =>
      reservePurchase(now),
    );
  });
}

export function clearWhoisCache(): void {
  purchaseTimestamps = [];
  recordStore.clear();
  previewStore.clear();
  historyStore.clear();
}
