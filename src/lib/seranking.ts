import { createCachedStore } from "@/lib/cached-store";
import type {
  SeRankingAdKeyword,
  SeRankingCompetitor,
} from "@/types/seranking";

const SERANKING_BASE_URL = "https://api.seranking.com/v1";
const KEYWORDS_PATH = "/domain/keywords";
const COMPETITORS_PATH = "/domain/competitors";
const KEYWORD_TYPE = "adv";

export class SeRankingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SeRankingApiError";
  }
}

interface UpstreamKeywordRow {
  keyword?: string;
  position?: number;
  url?: string;
  block?: string;
  snippet_title?: string;
  snippet_description?: string;
  snippet_display_url?: string;
}

interface UpstreamCompetitorRow {
  domain?: string;
  common_keywords?: number;
  domain_relevance?: number;
  total_keywords?: number;
  missing_keywords?: number;
  traffic_sum?: number;
  price_sum?: number;
}

function vietnameseError(status: number): string {
  if (status === 401 || status === 403) return "SE_RANKING_API_KEY không hợp lệ hoặc đã hết hạn.";
  if (status === 402) return "Tài khoản SE Ranking không đủ credits.";
  if (status === 429) return "SE Ranking đang giới hạn lượt gọi hoặc đã hết quota.";
  return "Không thể lấy dữ liệu SE Ranking lúc này.";
}

function failure(status: number): SeRankingApiError {
  if (status === 401 || status === 403) {
    return new SeRankingApiError(401, "invalid_api_key", vietnameseError(401));
  }
  if (status === 402) {
    return new SeRankingApiError(402, "insufficient_credits", vietnameseError(402));
  }
  if (status === 429) {
    return new SeRankingApiError(429, "rate_limited", vietnameseError(429));
  }
  return new SeRankingApiError(502, "seranking_error", vietnameseError(502));
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function requestSeRanking<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const url = `${SERANKING_BASE_URL}${path}?${new URLSearchParams(params)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new SeRankingApiError(502, "network_error", "Không thể kết nối đến SE Ranking.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new SeRankingApiError(502, "seranking_error", vietnameseError(502));
    }
  }

  if (!response.ok) throw failure(response.status);

  return body as T;
}

function toKeyword(raw: UpstreamKeywordRow): SeRankingAdKeyword {
  return {
    keyword: str(raw.keyword),
    position: num(raw.position),
    block: raw.block === "top" || raw.block === "bottom" ? raw.block : null,
    url: str(raw.url),
    snippet_title: str(raw.snippet_title),
    snippet_description: str(raw.snippet_description),
    snippet_display_url: str(raw.snippet_display_url),
  };
}

function toCompetitor(raw: UpstreamCompetitorRow): SeRankingCompetitor {
  return {
    domain: str(raw.domain),
    common_keywords: num(raw.common_keywords),
    domain_relevance: num(raw.domain_relevance),
    total_keywords: num(raw.total_keywords),
    missing_keywords: num(raw.missing_keywords),
    traffic_sum: num(raw.traffic_sum),
    price_sum: num(raw.price_sum),
  };
}

export async function fetchSeRankingKeywords(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingAdKeyword[]> {
  const body = await requestSeRanking<UpstreamKeywordRow[]>(
    KEYWORDS_PATH,
    { domain, source, type: KEYWORD_TYPE, limit: String(limit) },
    apiKey,
    fetchImpl,
  );
  if (!Array.isArray(body)) return [];
  return body.map(toKeyword);
}

export async function fetchSeRankingCompetitors(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingCompetitor[]> {
  const body = await requestSeRanking<UpstreamCompetitorRow[]>(
    COMPETITORS_PATH,
    { domain, source, type: KEYWORD_TYPE, limit: String(limit) },
    apiKey,
    fetchImpl,
  );
  if (!Array.isArray(body)) return [];
  return body.map(toCompetitor);
}

const keywordsStore = createCachedStore<SeRankingAdKeyword[]>();
const competitorsStore = createCachedStore<SeRankingCompetitor[]>();

export function getSeRankingKeywords(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingAdKeyword[]> {
  return keywordsStore.get(`${domain}:${source}:${limit}`, () =>
    fetchSeRankingKeywords(domain, source, limit, apiKey, fetchImpl),
  );
}

export function getSeRankingCompetitors(
  domain: string,
  source: string,
  limit: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingCompetitor[]> {
  return competitorsStore.get(`${domain}:${source}:${limit}`, () =>
    fetchSeRankingCompetitors(domain, source, limit, apiKey, fetchImpl),
  );
}

export function clearSeRankingCache(): void {
  keywordsStore.clear();
  competitorsStore.clear();
}
