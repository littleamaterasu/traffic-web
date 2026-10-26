import {
  capString,
  clampCount,
  clampScore,
  displayPath,
  extractHostname,
  safeHttpUrl,
} from "@/lib/backlink-sanitize";
import { createCachedStore } from "@/lib/cached-store";
import type {
  ReferringBacklink,
  ReferringOverview,
  ReferringSitesResult,
} from "@/types/referring-sites";

const TABAPI_BASE_URL = "https://tabapi.com/api/v1";
const BACKLINK_LIMIT = 20;
const REFERRING_TIMEOUT_MS = 30_000;
const EMPTY_RESULT_TTL_MS = 10 * 60 * 1000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_EMPTY_ENTRIES = 100;
const TITLE_MAX = 200;
const ANCHOR_MAX = 120;

export class ReferringSitesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReferringSitesApiError";
  }
}

function invalidResponse(): ReferringSitesApiError {
  return new ReferringSitesApiError(502, "invalid_response", "Dữ liệu backlink trả về không hợp lệ.");
}

function responseTooLarge(): ReferringSitesApiError {
  return new ReferringSitesApiError(502, "response_too_large", "Dữ liệu backlink trả về quá lớn.");
}

function failure(status: number): ReferringSitesApiError {
  if (status === 400) {
    return new ReferringSitesApiError(400, "invalid_domain", "Tên miền không hợp lệ.");
  }
  if (status === 401 || status === 403) {
    return new ReferringSitesApiError(401, "invalid_api_key", "Khóa TabAPI không hợp lệ hoặc không có quyền.");
  }
  if (status === 402) {
    return new ReferringSitesApiError(402, "insufficient_credits", "Tài khoản TabAPI không đủ credits.");
  }
  if (status === 429) {
    return new ReferringSitesApiError(429, "rate_limited", "TabAPI đang giới hạn tốc độ. Vui lòng thử lại sau.");
  }
  return new ReferringSitesApiError(502, "upstream_error", "TabAPI đang gặp sự cố. Vui lòng thử lại sau.");
}

function timeoutError(): ReferringSitesApiError {
  return new ReferringSitesApiError(504, "timeout", "TabAPI phản hồi quá chậm. Hãy thử lại sau.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function normalizeOverview(value: unknown): ReferringOverview | null {
  if (!isRecord(value)) return null;
  const overview: ReferringOverview = {
    domain_rating: clampScore(value.domain_rating),
    backlinks: clampCount(value.backlinks),
    referring_domains: clampCount(value.referring_domains),
    dofollow_backlinks_pct: clampScore(value.dofollow_backlinks_pct),
    dofollow_referring_domains_pct: clampScore(value.dofollow_referring_domains_pct),
  };
  return Object.values(overview).every((item) => item === null) ? null : overview;
}

function normalizeBacklink(raw: Record<string, unknown>): ReferringBacklink | null {
  const fromUrl = safeHttpUrl(raw.from_url);
  const fromDomain = extractHostname(fromUrl);
  if (!fromUrl || !fromDomain) return null;
  const toUrl = safeHttpUrl(raw.to_url);
  return {
    from_url: fromUrl,
    from_domain: fromDomain,
    to_url: toUrl,
    to_path: displayPath(toUrl),
    title: capString(raw.title, TITLE_MAX),
    anchor: capString(raw.anchor, ANCHOR_MAX),
    domain_rating: clampScore(raw.domain_rating),
  };
}

export function normalizeReferringSitesBody(
  body: unknown,
  now: Date = new Date(),
): ReferringSitesResult {
  if (!isRecord(body)) throw invalidResponse();
  const backlinks: ReferringBacklink[] = [];
  const seenDomains = new Set<string>();
  if (Array.isArray(body.backlinks)) {
    for (const item of body.backlinks) {
      if (backlinks.length >= BACKLINK_LIMIT) break;
      if (!isRecord(item)) continue;
      const backlink = normalizeBacklink(item);
      if (!backlink) continue;
      const domainKey = backlink.from_domain.toLowerCase();
      if (seenDomains.has(domainKey)) continue;
      seenDomains.add(domainKey);
      backlinks.push(backlink);
    }
  }
  return {
    fetched_at: now.toISOString(),
    overview: normalizeOverview(body.overview),
    backlinks,
  };
}

export function isEmptyReferringSites(result: ReferringSitesResult): boolean {
  return result.overview === null && result.backlinks.length === 0;
}

async function readBodyText(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw responseTooLarge();
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw responseTooLarge();
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw responseTooLarge();
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

export async function fetchReferringSites(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferringSitesResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${TABAPI_BASE_URL}/domains/${encodeURIComponent(domain)}/backlinks`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REFERRING_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeout(error)) throw timeoutError();
    throw new ReferringSitesApiError(502, "network_error", "Không thể kết nối đến TabAPI.");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw failure(response.status);
  }

  let text: string;
  try {
    text = await readBodyText(response);
  } catch (error) {
    if (error instanceof ReferringSitesApiError) throw error;
    if (isTimeout(error)) throw timeoutError();
    throw invalidResponse();
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw invalidResponse();
  }

  return normalizeReferringSitesBody(body);
}

const referringSitesStore = createCachedStore<ReferringSitesResult>();
const emptyResults = new Map<string, { result: ReferringSitesResult; expiresAt: number }>();

class EmptyReferringSitesSignal extends Error {
  constructor(public readonly result: ReferringSitesResult) {
    super("empty_referring_sites");
  }
}

async function loadReferringSites(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ReferringSitesResult> {
  const result = await fetchReferringSites(domain, apiKey, fetchImpl);
  if (isEmptyReferringSites(result)) throw new EmptyReferringSitesSignal(result);
  return result;
}

export async function getReferringSites(
  rawDomain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferringSitesResult> {
  const domain = rawDomain.toLowerCase();
  const cachedEmpty = emptyResults.get(domain);
  if (cachedEmpty) {
    if (cachedEmpty.expiresAt > Date.now()) return cachedEmpty.result;
    emptyResults.delete(domain);
  }

  try {
    return await referringSitesStore.get(`backlinks:${domain}`, () =>
      loadReferringSites(domain, apiKey, fetchImpl),
    );
  } catch (error) {
    if (error instanceof EmptyReferringSitesSignal) {
      if (emptyResults.size >= MAX_EMPTY_ENTRIES) {
        const oldest = emptyResults.keys().next().value as string | undefined;
        if (oldest !== undefined) emptyResults.delete(oldest);
      }
      emptyResults.set(domain, { result: error.result, expiresAt: Date.now() + EMPTY_RESULT_TTL_MS });
      return error.result;
    }
    throw error;
  }
}

export function clearReferringSitesCache(): void {
  referringSitesStore.clear();
  emptyResults.clear();
}
