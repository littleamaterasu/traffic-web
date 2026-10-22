import { createCachedStore } from "@/lib/cached-store";
import type {
  SeRankingAdKeyword,
  SeRankingAnchor,
  SeRankingBacklinks,
  SeRankingCompetitor,
  SeRankingMetric,
  SeRankingOverview,
} from "@/types/seranking";

const SERANKING_BASE_URL = "https://api.seranking.com/v1";
const OVERVIEW_PATH = "/domain/overview/worldwide";
const KEYWORDS_PATH = "/domain/keywords";
const COMPETITORS_PATH = "/domain/competitors";
const BACKLINKS_PATH = "/backlinks/summary";
const CURRENCY = "USD";
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

interface UpstreamOverviewEntry {
  keywords_count?: number;
  traffic_sum?: number;
  price_sum?: number;
}

interface UpstreamOverview {
  organic?: UpstreamOverviewEntry[];
  adv?: UpstreamOverviewEntry[];
}

interface UpstreamKeywordRow {
  keyword?: string;
  position?: number;
  volume?: number;
  cpc?: number;
  competition?: number;
  url?: string;
  block?: string;
  block_position?: number;
  snippet_title?: string;
  snippet_description?: string;
  snippet_display_url?: string;
  traffic?: number;
  price?: number;
  difficulty?: number;
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

interface UpstreamAnchorRow {
  anchor?: string;
  backlinks?: number;
  refdomains?: number;
}

interface UpstreamBacklinksEntry {
  target?: string;
  backlinks?: number;
  refdomains?: number;
  dofollow_backlinks?: number;
  nofollow_backlinks?: number;
  dofollow_refdomains?: number;
  domain_inlink_rank?: number;
  inlink_rank?: number;
  top_anchors_by_backlinks?: UpstreamAnchorRow[];
  top_anchors_by_refdomains?: UpstreamAnchorRow[];
}

interface UpstreamBacklinksBody {
  summary?: UpstreamBacklinksEntry[];
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

function toMetric(entry: UpstreamOverviewEntry | undefined): SeRankingMetric | null {
  if (!entry || typeof entry !== "object") return null;
  return {
    keywords_count: num(entry.keywords_count),
    traffic_sum: num(entry.traffic_sum),
    price_sum: num(entry.price_sum),
  };
}

function toKeyword(raw: UpstreamKeywordRow): SeRankingAdKeyword {
  return {
    keyword: str(raw.keyword),
    position: num(raw.position),
    volume: num(raw.volume),
    cpc: num(raw.cpc),
    competition: num(raw.competition),
    url: str(raw.url),
    block: str(raw.block),
    block_position: num(raw.block_position),
    snippet_title: str(raw.snippet_title),
    snippet_description: str(raw.snippet_description),
    snippet_display_url: str(raw.snippet_display_url),
    traffic: num(raw.traffic),
    price: num(raw.price),
    difficulty: num(raw.difficulty),
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

function toAnchors(rows: unknown): SeRankingAnchor[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    anchor: str(row?.anchor) ?? "",
    backlinks: num(row?.backlinks),
    refdomains: num(row?.refdomains),
  }));
}

function toBacklinks(raw: UpstreamBacklinksEntry): SeRankingBacklinks {
  return {
    target: str(raw.target),
    backlinks: num(raw.backlinks),
    refdomains: num(raw.refdomains),
    dofollow_backlinks: num(raw.dofollow_backlinks),
    nofollow_backlinks: num(raw.nofollow_backlinks),
    dofollow_refdomains: num(raw.dofollow_refdomains),
    domain_inlink_rank: num(raw.domain_inlink_rank),
    inlink_rank: num(raw.inlink_rank),
    top_anchors_by_backlinks: toAnchors(raw.top_anchors_by_backlinks),
    top_anchors_by_refdomains: toAnchors(raw.top_anchors_by_refdomains),
  };
}

export async function fetchSeRankingOverview(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingOverview> {
  const body = await requestSeRanking<UpstreamOverview>(
    OVERVIEW_PATH,
    { domain, currency: CURRENCY },
    apiKey,
    fetchImpl,
  );
  return {
    organic: toMetric(Array.isArray(body?.organic) ? body.organic[0] : undefined),
    paid: toMetric(Array.isArray(body?.adv) ? body.adv[0] : undefined),
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

export async function fetchSeRankingBacklinks(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingBacklinks | null> {
  const body = await requestSeRanking<UpstreamBacklinksBody>(
    BACKLINKS_PATH,
    { target: domain },
    apiKey,
    fetchImpl,
  );
  if (!Array.isArray(body?.summary) || body.summary.length === 0) return null;
  return toBacklinks(body.summary[0]);
}

const overviewStore = createCachedStore<SeRankingOverview>();
const keywordsStore = createCachedStore<SeRankingAdKeyword[]>();
const competitorsStore = createCachedStore<SeRankingCompetitor[]>();
const backlinksStore = createCachedStore<SeRankingBacklinks | null>();

export function getSeRankingOverview(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingOverview> {
  return overviewStore.get(domain, () =>
    fetchSeRankingOverview(domain, apiKey, fetchImpl),
  );
}

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

export function getSeRankingBacklinks(
  domain: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SeRankingBacklinks | null> {
  return backlinksStore.get(domain, () =>
    fetchSeRankingBacklinks(domain, apiKey, fetchImpl),
  );
}

export function clearSeRankingCache(): void {
  overviewStore.clear();
  keywordsStore.clear();
  competitorsStore.clear();
  backlinksStore.clear();
}
