import { createCachedStore } from "@/lib/cached-store";
import type {
  TrustpilotBusiness,
  TrustpilotProfile,
  TrustpilotRatingBucket,
  TrustpilotResult,
  TrustpilotReview,
} from "@/types/trustpilot";

export const TRUSTPILOT_MAX_PAGES = 1;
export const TRUSTPILOT_REVIEW_LIMIT = 5;
export const TRUSTPILOT_TIMEOUT_MS = 45_000;
export const EMPTY_PROFILE_TTL_MS = 10 * 60 * 1000;
export const MAX_CONCURRENT_SCRAPES = 2;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_EMPTY_ENTRIES = 100;
const MAX_URL_CHARS = 500;
const MAX_CATEGORIES = 5;

export class TrustpilotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TrustpilotApiError";
  }
}

function invalidResponse(): TrustpilotApiError {
  return new TrustpilotApiError(502, "invalid_response", "Dữ liệu Trustpilot trả về không hợp lệ.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function reviewRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return null;
  return Math.min(5, value);
}

function reviewCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function capString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_CHARS) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const categories: string[] = [];
  for (const item of value) {
    const category = capString(item, 60);
    if (category) categories.push(category);
    if (categories.length >= MAX_CATEGORIES) break;
  }
  return categories;
}

function normalizeDistribution(value: unknown): TrustpilotRatingBucket[] {
  if (!Array.isArray(value)) return [];
  const buckets: TrustpilotRatingBucket[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const stars = item.stars;
    const percent = clampNumber(item.percent, 0, 100);
    if (stars !== 1 && stars !== 2 && stars !== 3 && stars !== 4 && stars !== 5) continue;
    if (percent === null) continue;
    buckets.push({ stars, percent });
  }
  return buckets;
}

function normalizeReview(raw: Record<string, unknown>): TrustpilotReview {
  return {
    id: capString(raw.id, 100) ?? "",
    author: capString(raw.author, 100),
    heading: capString(raw.heading, 200),
    body: capString(raw.body, 2000),
    date: normalizeDate(raw.date),
    location: capString(raw.location, 20),
    rating: reviewRating(raw.rating),
  };
}

function normalizeBusiness(raw: Record<string, unknown>, name: string): TrustpilotBusiness {
  const business: TrustpilotBusiness = {
    name,
    review_count: reviewCount(raw.numberOfReviews),
    trust_score: clampNumber(raw.trustScore, 0, 5),
    stars: clampNumber(raw.stars, 0, 5),
    website: safeHttpUrl(raw.website),
  };
  const logo = safeHttpUrl(raw.logo_url);
  if (logo) business.logo_url = logo;
  const claimed = capString(raw.claimed_since, 40);
  if (claimed) business.claimed_since = claimed;
  const categories = normalizeCategories(raw.categories);
  if (categories.length > 0) business.categories = categories;
  const distribution = normalizeDistribution(raw.rating_distribution);
  if (distribution.length > 0) business.rating_distribution = distribution;
  return business;
}

export function normalizeTrustpilotBody(body: unknown, now: Date = new Date()): TrustpilotResult {
  if (!isRecord(body)) throw invalidResponse();
  if (body.success !== true) {
    throw new TrustpilotApiError(
      502,
      "scraper_failed",
      "Không lấy được đánh giá Trustpilot cho tên miền này.",
    );
  }

  const fetchedAt = now.toISOString();
  const rawBusiness = body.business;
  const name = isRecord(rawBusiness) ? capString(rawBusiness.name, 200) : null;
  if (!isRecord(rawBusiness) || !name) return { fetched_at: fetchedAt, profile: null };

  const reviews = Array.isArray(body.reviews)
    ? body.reviews
        .filter(isRecord)
        .slice(0, TRUSTPILOT_REVIEW_LIMIT)
        .map((review) => normalizeReview(review))
    : [];

  const profile: TrustpilotProfile = {
    target: capString(body.target, 200) ?? "",
    trustpilot_url: safeHttpUrl(body.trustpilot_url),
    business: normalizeBusiness(rawBusiness, name),
    reviews,
  };

  return { fetched_at: fetchedAt, profile };
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function responseTooLarge(): TrustpilotApiError {
  return new TrustpilotApiError(502, "response_too_large", "Dữ liệu Trustpilot trả về quá lớn.");
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

export async function fetchTrustpilotProfile(
  domain: string,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<TrustpilotResult> {
  let origin: string;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("scheme");
    origin = parsed.origin;
  } catch {
    throw new TrustpilotApiError(500, "invalid_scraper_url", "TRUSTPILOT_SCRAPER_URL không hợp lệ.");
  }

  let response: Response;
  try {
    response = await fetchImpl(new URL("/api/reviews", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        domain,
        max_pages: TRUSTPILOT_MAX_PAGES,
        limit: TRUSTPILOT_REVIEW_LIMIT,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TRUSTPILOT_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new TrustpilotApiError(
        504,
        "scraper_timeout",
        "Dịch vụ Trustpilot nội bộ phản hồi quá chậm. Hãy thử lại sau.",
      );
    }
    throw new TrustpilotApiError(
      502,
      "scraper_unreachable",
      "Không thể kết nối đến dịch vụ Trustpilot nội bộ.",
    );
  }

  if (!response.ok) {
    throw new TrustpilotApiError(502, "scraper_error", "Dịch vụ Trustpilot nội bộ trả về lỗi.");
  }

  let text: string;
  try {
    text = await readBodyText(response);
  } catch (error) {
    if (error instanceof TrustpilotApiError) throw error;
    if (isTimeout(error)) {
      throw new TrustpilotApiError(
        504,
        "scraper_timeout",
        "Dịch vụ Trustpilot nội bộ phản hồi quá chậm. Hãy thử lại sau.",
      );
    }
    throw invalidResponse();
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw invalidResponse();
  }

  const result = normalizeTrustpilotBody(body, now);
  if (result.profile && !result.profile.target) result.profile.target = domain;
  return result;
}

const profileStore = createCachedStore<TrustpilotResult>();
const emptyResults = new Map<string, { result: TrustpilotResult; expiresAt: number }>();
let activeScrapes = 0;

class EmptyProfileSignal extends Error {
  constructor(public readonly result: TrustpilotResult) {
    super("empty_profile");
  }
}

async function loadProfile(
  domain: string,
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<TrustpilotResult> {
  if (activeScrapes >= MAX_CONCURRENT_SCRAPES) {
    throw new TrustpilotApiError(
      429,
      "scraper_busy",
      "Dịch vụ lấy đánh giá đang bận, vui lòng thử lại sau ít phút.",
    );
  }
  activeScrapes += 1;
  try {
    const result = await fetchTrustpilotProfile(domain, baseUrl, fetchImpl);
    if (result.profile === null) throw new EmptyProfileSignal(result);
    return result;
  } finally {
    activeScrapes = Math.max(0, activeScrapes - 1);
  }
}

export async function getTrustpilotProfile(
  rawDomain: string,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TrustpilotResult> {
  const domain = rawDomain.toLowerCase();
  const cachedEmpty = emptyResults.get(domain);
  if (cachedEmpty) {
    if (cachedEmpty.expiresAt > Date.now()) return cachedEmpty.result;
    emptyResults.delete(domain);
  }

  try {
    return await profileStore.get(domain, () => loadProfile(domain, baseUrl, fetchImpl));
  } catch (error) {
    if (error instanceof EmptyProfileSignal) {
      if (emptyResults.size >= MAX_EMPTY_ENTRIES) {
        const oldest = emptyResults.keys().next().value as string | undefined;
        if (oldest !== undefined) emptyResults.delete(oldest);
      }
      emptyResults.set(domain, { result: error.result, expiresAt: Date.now() + EMPTY_PROFILE_TTL_MS });
      return error.result;
    }
    throw error;
  }
}

export function clearTrustpilotCache(): void {
  profileStore.clear();
  emptyResults.clear();
  activeScrapes = 0;
}
