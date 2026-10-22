import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearSeRankingCache } from "@/lib/seranking";
import type {
  SeRankingAdKeyword,
  SeRankingCompetitor,
  SeRankingOverview,
} from "@/types/seranking";
import { GET } from "./route";

const API_KEY = "test-key-123";

const OVERVIEW_PATH = "/v1/domain/overview/worldwide";
const KEYWORDS_PATH = "/v1/domain/keywords";
const COMPETITORS_PATH = "/v1/domain/competitors";

const overviewUpstream = {
  organic: [
    { source: "worldwide", keywords_count: 534_575, traffic_sum: 531_195, price_sum: 274_754.56 },
  ],
  adv: [{ source: "worldwide", keywords_count: 335, traffic_sum: 2_916, price_sum: 658.06 }],
};

const keywordsUpstream = [
  {
    keyword: "hosting giá rẻ",
    position: 1,
    volume: 8_100,
    cpc: 0.42,
    competition: 0.36,
    url: "https://acme.com/khuyen-mai",
    block: "top",
    block_position: 1,
    snippet_title: "Hosting giá rẻ cho người mới",
    snippet_description: "Miễn phí SSL, giảm 80% tháng đầu.",
    snippet_display_url: "acme.com",
    traffic: 1_204,
    price: 505.68,
    difficulty: 34,
  },
];

const competitorsUpstream = [
  {
    domain: "rival.com",
    common_keywords: 212,
    domain_relevance: 71.4,
    total_keywords: 1_830,
    missing_keywords: 1_618,
    traffic_sum: 40_512,
    price_sum: 92.4,
  },
];

const expectedOverview: SeRankingOverview = {
  organic: { keywords_count: 534_575, traffic_sum: 531_195, price_sum: 274_754.56 },
  paid: { keywords_count: 335, traffic_sum: 2_916, price_sum: 658.06 },
};

const expectedKeywords: SeRankingAdKeyword[] = [
  {
    keyword: "hosting giá rẻ",
    position: 1,
    volume: 8_100,
    cpc: 0.42,
    competition: 0.36,
    url: "https://acme.com/khuyen-mai",
    block: "top",
    block_position: 1,
    snippet_title: "Hosting giá rẻ cho người mới",
    snippet_description: "Miễn phí SSL, giảm 80% tháng đầu.",
    snippet_display_url: "acme.com",
    traffic: 1_204,
    price: 505.68,
    difficulty: 34,
  },
];

const expectedCompetitors: SeRankingCompetitor[] = [
  {
    domain: "rival.com",
    common_keywords: 212,
    domain_relevance: 71.4,
    total_keywords: 1_830,
    missing_keywords: 1_618,
    traffic_sum: 40_512,
    price_sum: 92.4,
  },
];

function fetchRouter(routes: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const body = routes[url.pathname];
    if (typeof body === "number") {
      return new Response(JSON.stringify({ error: "upstream_failure" }), { status: body });
    }
    return new Response(JSON.stringify(body ?? { error: "unexpected_path" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("GET /api/seranking", () => {
  beforeEach(() => clearSeRankingCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain khi thiếu domain và không gọi upstream", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 400 invalid_domain khi domain là localhost và không gọi upstream", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=localhost"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 400 invalid_source khi source viết hoa (không tự chuyển chữ thường)", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking?domain=acme.com&source=US"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid_source", message: "Mã cơ sở dữ liệu khu vực không hợp lệ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 400 invalid_source khi source dài hơn hai ký tự", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking?domain=acme.com&source=usa"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_source" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", "");
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 200 đủ ba slice khi mọi upstream OK, mặc định source us, không gọi backlinks và không lộ key", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({
      [OVERVIEW_PATH]: overviewUpstream,
      [KEYWORDS_PATH]: keywordsUpstream,
      [COMPETITORS_PATH]: competitorsUpstream,
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body).toEqual({
      domain: "acme.com",
      source: "us",
      overview: { data: expectedOverview, error: null },
      keywords: { data: expectedKeywords, error: null },
      competitors: { data: expectedCompetitors, error: null },
    });
    const keywordCall = fetchMock.mock.calls.find(([url]) => String(url).includes(KEYWORDS_PATH));
    expect(String(keywordCall?.[0])).toContain("source=us");
    expect(String(keywordCall?.[0])).toContain("limit=10");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("/backlinks/");
    }
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("trả 200 với slice keywords lỗi khi upstream keywords trả 500, các slice khác vẫn có dữ liệu", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({
      [OVERVIEW_PATH]: overviewUpstream,
      [KEYWORDS_PATH]: 500,
      [COMPETITORS_PATH]: competitorsUpstream,
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toEqual({ data: expectedOverview, error: null });
    expect(body.keywords).toEqual({
      data: null,
      error: { code: "seranking_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
    });
    expect(body.competitors).toEqual({ data: expectedCompetitors, error: null });
  });

  it("trả 200 với cả ba slice lỗi invalid_api_key khi upstream trả 401 cho mọi endpoint", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({
      [OVERVIEW_PATH]: 401,
      [KEYWORDS_PATH]: 401,
      [COMPETITORS_PATH]: 401,
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toEqual({
      data: null,
      error: { code: "invalid_api_key", message: "SE_RANKING_API_KEY không hợp lệ hoặc đã hết hạn." },
    });
    expect(body.keywords.error?.code).toBe("invalid_api_key");
    expect(body.competitors.error?.code).toBe("invalid_api_key");
  });
});
