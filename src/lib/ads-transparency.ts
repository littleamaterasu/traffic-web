import { createCachedStore } from "@/lib/cached-store";
import type { AdCreative, AdDetail, AdsResponse } from "@/types/ads";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";
const MAX_CREATIVES = 40;
const NO_RESULTS = /hasn't returned any results/i;

export class AdsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdsApiError";
  }
}

interface SerpApiCreative {
  advertiser_id?: string;
  advertiser?: string;
  ad_creative_id?: string;
  format?: string;
  target_domain?: string;
  image?: string;
  width?: number;
  height?: number;
  link?: string;
  details_link?: string;
  total_days_shown?: number;
  first_shown?: number;
  last_shown?: number;
}

interface SerpApiResponse {
  error?: string;
  search_information?: {
    total_results?: number;
    ad_funded_by?: string;
    regions?: Array<{ region_name?: string; last_shown?: number }>;
  };
  ad_creatives?: SerpApiCreative[];
  serpapi_pagination?: { next_page_token?: string };
}

interface SerpApiDetailItem {
  snippet?: string;
  image?: string;
}

function vietnameseError(status: number, apiMessage?: string): string {
  if (status === 401 || status === 403) return "SERPAPI_KEY không hợp lệ hoặc đã hết hạn.";
  if (status === 429) return "SerpApi đang giới hạn lượt gọi hoặc đã hết quota.";
  if (apiMessage && /run out of searches|out of searches/i.test(apiMessage)) {
    return "Tài khoản SerpApi đã hết lượt tìm kiếm.";
  }
  return "Không thể lấy dữ liệu quảng cáo lúc này.";
}

function unixToIso(value: number | undefined): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString().slice(0, 10) : null;
}

function yyyymmddToIso(value: number | undefined): string | null {
  const text = typeof value === "number" ? String(value) : "";
  return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : null;
}

function toCreative(raw: SerpApiCreative): AdCreative {
  return {
    advertiser_id: raw.advertiser_id ?? "",
    advertiser: raw.advertiser ?? "",
    ad_creative_id: raw.ad_creative_id ?? "",
    format: raw.format ?? null,
    target_domain: raw.target_domain ?? null,
    image: raw.image ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    preview_link: raw.link ?? null,
    details_link: raw.details_link ?? null,
    total_days_shown: raw.total_days_shown ?? null,
    first_shown: unixToIso(raw.first_shown),
    last_shown: unixToIso(raw.last_shown),
  };
}

async function requestSerpApi(
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{ body: SerpApiResponse | null; ok: boolean; status: number }> {
  const query = new URLSearchParams({ ...params, api_key: apiKey });

  let response: Response;
  try {
    response = await fetchImpl(`${SERPAPI_BASE_URL}?${query}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new AdsApiError(502, "network_error", "Không thể kết nối đến SerpApi.");
  }

  let body: SerpApiResponse | null = null;
  try {
    body = (await response.json()) as SerpApiResponse;
  } catch {
    body = null;
  }

  return { body, ok: response.ok && !body?.error, status: response.status };
}

function failure(status: number, apiMessage?: string): AdsApiError {
  const mapped = [401, 403, 429].includes(status) ? status : 502;
  return new AdsApiError(mapped, "serpapi_error", vietnameseError(status, apiMessage));
}

export async function fetchAdsFromSerpApi(
  domain: string,
  apiKey: string,
  pageToken: string | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsResponse> {
  const params: Record<string, string> = {
    engine: "google_ads_transparency_center",
    text: domain,
    num: String(MAX_CREATIVES),
  };
  if (pageToken) params.next_page_token = pageToken;

  const { body, ok, status } = await requestSerpApi(params, apiKey, fetchImpl);

  // SerpApi trả lỗi "không có kết quả" dưới dạng error trong body; đây là trường hợp rỗng hợp lệ.
  if (body?.error && NO_RESULTS.test(body.error)) {
    return { domain, total_results: 0, creatives: [], next_page_token: null };
  }
  if (!ok) throw failure(status, body?.error);

  return {
    domain,
    total_results: body?.search_information?.total_results ?? null,
    creatives: (body?.ad_creatives ?? []).map(toCreative),
    next_page_token: body?.serpapi_pagination?.next_page_token ?? null,
  };
}

export async function fetchAdDetailFromSerpApi(
  advertiserId: string,
  creativeId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AdDetail> {
  const { body, ok, status } = await requestSerpApi(
    {
      engine: "google_ads_transparency_center_ad_details",
      advertiser_id: advertiserId,
      creative_id: creativeId,
    },
    apiKey,
    fetchImpl,
  );
  if (!ok) throw failure(status, body?.error);

  const info = body?.search_information;
  const items = ((body?.ad_creatives ?? []) as SerpApiDetailItem[]).map((item) => ({
    snippet: item.snippet ?? null,
    image: item.image ?? null,
  }));

  return {
    advertiser_id: advertiserId,
    creative_id: creativeId,
    funded_by: info?.ad_funded_by ?? null,
    regions: (info?.regions ?? [])
      .filter((region) => region.region_name)
      .map((region) => ({
        name: region.region_name as string,
        last_shown: yyyymmddToIso(region.last_shown),
      })),
    items,
  };
}

const adsStore = createCachedStore<AdsResponse>();
const detailStore = createCachedStore<AdDetail>();

export function getAds(
  domain: string,
  apiKey: string,
  pageToken: string | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsResponse> {
  return adsStore.get(`${domain}:${pageToken ?? ""}`, () =>
    fetchAdsFromSerpApi(domain, apiKey, pageToken, fetchImpl),
  );
}

export function getAdDetail(
  advertiserId: string,
  creativeId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AdDetail> {
  return detailStore.get(`${advertiserId}:${creativeId}`, () =>
    fetchAdDetailFromSerpApi(advertiserId, creativeId, apiKey, fetchImpl),
  );
}

export function clearAdsCache(): void {
  adsStore.clear();
  detailStore.clear();
}
