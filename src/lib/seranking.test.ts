import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SeRankingApiError,
  clearSeRankingCache,
  fetchSeRankingBacklinks,
  fetchSeRankingCompetitors,
  fetchSeRankingKeywords,
  getSeRankingBacklinks,
  getSeRankingCompetitors,
  getSeRankingKeywords,
} from "./seranking";
import type { SeRankingAdKeyword } from "@/types/seranking";

const TEST_KEY = "test-key";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const keywordsUpstream = [
  {
    keyword: "giày chạy bộ",
    position: 2,
    volume: 9_000,
    cpc: 1.5,
    competition: 0.7,
    url: "https://acme.com/giay",
    block: "bottom",
    block_position: 3,
    snippet_title: "Giày chạy bộ - Acme",
    snippet_description: "Giảm giá",
    snippet_display_url: "acme.com/giay",
    traffic: 300,
    price: 80,
    difficulty: 30,
  },
  { keyword: "giày", position: 1, block: "side" },
];

const keywordsExpected: SeRankingAdKeyword[] = [
  {
    keyword: "giày chạy bộ",
    position: 2,
    block: "bottom",
    url: "https://acme.com/giay",
    snippet_title: "Giày chạy bộ - Acme",
    snippet_description: "Giảm giá",
    snippet_display_url: "acme.com/giay",
  },
  {
    keyword: "giày",
    position: 1,
    block: null,
    url: null,
    snippet_title: null,
    snippet_description: null,
    snippet_display_url: null,
  },
];

const competitorsUpstream = [
  {
    domain: "rival.com",
    common_keywords: 128,
    domain_relevance: 62.5,
    total_keywords: 940,
    missing_keywords: 812,
    traffic_sum: 1500,
    price_sum: 320.75,
  },
];

const backlinksUpstream = {
  summary: [
    {
      target: "acme.com",
      backlinks: 4210,
      refdomains: 312,
      subnets: 190,
      ips: 205,
      nofollow_backlinks: 800,
      dofollow_backlinks: 3410,
      edu_backlinks: 2,
      gov_backlinks: 0,
      inlink_rank: 55,
      domain_inlink_rank: 61,
      dofollow_refdomains: 240,
      top_anchors_by_backlinks: [{ anchor: "acme", backlinks: 900 }],
      top_anchors_by_refdomains: [{ anchor: "may chay bo", refdomains: 40 }],
    },
  ],
};

describe("SE Ranking client", () => {
  beforeEach(() => clearSeRankingCache());

  it("fetchSeRankingKeywords gọi /domain/keywords type=adv, gửi header Token và chỉ giữ trường quảng cáo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(keywordsUpstream));

    const result = await fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, fetchMock as unknown as typeof fetch);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.seranking.com/v1/domain/keywords");
    expect(url.searchParams.get("domain")).toBe("acme.com");
    expect(url.searchParams.get("source")).toBe("us");
    expect(url.searchParams.get("type")).toBe("adv");
    expect(url.searchParams.get("limit")).toBe("10");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Token ${TEST_KEY}`);
    expect(result).toEqual(keywordsExpected);
    for (const row of result) {
      expect(row).not.toHaveProperty("volume");
      expect(row).not.toHaveProperty("cpc");
      expect(row).not.toHaveProperty("traffic");
      expect(row).not.toHaveProperty("price");
    }
  });

  it("keywords với phản hồi không phải mảng trả mảng rỗng", async () => {
    const missing = vi.fn().mockResolvedValue(jsonResponse({}));
    const result = await fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, missing as unknown as typeof fetch);
    expect(result).toEqual([]);
  });

  it("fetchSeRankingCompetitors gọi type=adv và chuẩn hóa đối thủ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(competitorsUpstream));

    const result = await fetchSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, fetchMock as unknown as typeof fetch);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.seranking.com/v1/domain/competitors");
    expect(url.searchParams.get("domain")).toBe("acme.com");
    expect(url.searchParams.get("source")).toBe("us");
    expect(url.searchParams.get("type")).toBe("adv");
    expect(result).toEqual([
      {
        domain: "rival.com",
        common_keywords: 128,
        domain_relevance: 62.5,
        total_keywords: 940,
        missing_keywords: 812,
        traffic_sum: 1500,
        price_sum: 320.75,
      },
    ]);
  });

  it("fetchSeRankingBacklinks gọi target= và map summary[0] gồm anchor lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(backlinksUpstream));

    const result = await fetchSeRankingBacklinks("acme.com", TEST_KEY, fetchMock as unknown as typeof fetch);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.seranking.com/v1/backlinks/summary");
    expect(url.searchParams.get("target")).toBe("acme.com");
    expect(result).toEqual({
      target: "acme.com",
      backlinks: 4210,
      refdomains: 312,
      dofollow_backlinks: 3410,
      nofollow_backlinks: 800,
      dofollow_refdomains: 240,
      domain_inlink_rank: 61,
      inlink_rank: 55,
      top_anchors_by_backlinks: [{ anchor: "acme", backlinks: 900, refdomains: null }],
      top_anchors_by_refdomains: [{ anchor: "may chay bo", backlinks: null, refdomains: 40 }],
    });
  });

  it("backlinks: summary rỗng hoặc thiếu trả null", async () => {
    const empty = vi.fn().mockResolvedValue(jsonResponse({ summary: [] }));
    const emptyResult = await fetchSeRankingBacklinks("acme.com", TEST_KEY, empty as unknown as typeof fetch);
    expect(emptyResult).toBeNull();

    const missing = vi.fn().mockResolvedValue(jsonResponse({}));
    const missingResult = await fetchSeRankingBacklinks("acme.com", TEST_KEY, missing as unknown as typeof fetch);
    expect(missingResult).toBeNull();
  });

  it("lỗi 401/403 thành invalid_api_key, 402 thành insufficient_credits, 429 thành rate_limited", async () => {
    const unauthorized = vi.fn().mockResolvedValue(jsonResponse({ error: "bad key" }, 401));
    await expect(fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, unauthorized as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 401, code: "invalid_api_key" });

    const forbidden = vi.fn().mockResolvedValue(jsonResponse({}, 403));
    await expect(fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, forbidden as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 401, code: "invalid_api_key" });

    const unpaid = vi.fn().mockResolvedValue(jsonResponse({}, 402));
    await expect(fetchSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, unpaid as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 402, code: "insufficient_credits" });

    const limited = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    await expect(fetchSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, limited as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("trạng thái khác trả 502 seranking_error, mất kết nối trả network_error, JSON hỏng trả seranking_error", async () => {
    const serverError = vi.fn().mockResolvedValue(jsonResponse("boom", 500));
    await expect(fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, serverError as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 502, code: "seranking_error" });

    const offline = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, offline as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 502, code: "network_error" });

    const brokenJson = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, brokenJson as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 502, code: "seranking_error" });
  });

  it("mọi lỗi là SeRankingApiError, thông báo không bao giờ chứa key", async () => {
    const unauthorized = vi.fn().mockResolvedValue(jsonResponse(TEST_KEY, 401));
    const error = await fetchSeRankingKeywords("acme.com", "us", 10, TEST_KEY, unauthorized as unknown as typeof fetch).catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(SeRankingApiError);
    expect((error as SeRankingApiError).name).toBe("SeRankingApiError");
    expect((error as SeRankingApiError).message).not.toContain(TEST_KEY);
    expect((error as SeRankingApiError).message.length).toBeGreaterThan(0);
  });

  it("getSeRankingX cùng tham số chỉ gọi mạng một lần và không đụng chéo store", async () => {
    const keywordsMock = vi.fn().mockImplementation(async () => jsonResponse(keywordsUpstream));
    await getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, keywordsMock as unknown as typeof fetch);
    await getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, keywordsMock as unknown as typeof fetch);
    expect(keywordsMock).toHaveBeenCalledTimes(1);

    const competitorsMock = vi.fn().mockResolvedValue(jsonResponse(competitorsUpstream));
    await getSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, competitorsMock as unknown as typeof fetch);
    expect(competitorsMock).toHaveBeenCalledTimes(1);
    expect(String(competitorsMock.mock.calls[0][0])).not.toContain("/backlinks/summary");
  });

  it("getSeRankingCompetitors tách cache theo source và limit", async () => {
    const competitorsMock = vi.fn().mockImplementation(async () => jsonResponse(competitorsUpstream));
    await getSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, competitorsMock as unknown as typeof fetch);
    await getSeRankingCompetitors("acme.com", "uk", 10, TEST_KEY, competitorsMock as unknown as typeof fetch);
    expect(competitorsMock).toHaveBeenCalledTimes(2);
  });

  it("backlinks có store riêng, cùng domain chỉ gọi một lần", async () => {
    const backlinksMock = vi.fn().mockImplementation(async () => jsonResponse(backlinksUpstream));
    await getSeRankingBacklinks("acme.com", TEST_KEY, backlinksMock as unknown as typeof fetch);
    await getSeRankingBacklinks("acme.com", TEST_KEY, backlinksMock as unknown as typeof fetch);
    expect(backlinksMock).toHaveBeenCalledTimes(1);
  });

  it("clearSeRankingCache xóa cả ba store", async () => {
    const keywordsMock = vi.fn().mockImplementation(async () => jsonResponse(keywordsUpstream));
    const competitorsMock = vi.fn().mockImplementation(async () => jsonResponse(competitorsUpstream));
    const backlinksMock = vi.fn().mockImplementation(async () => jsonResponse(backlinksUpstream));

    await getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, keywordsMock as unknown as typeof fetch);
    await getSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, competitorsMock as unknown as typeof fetch);
    await getSeRankingBacklinks("acme.com", TEST_KEY, backlinksMock as unknown as typeof fetch);
    clearSeRankingCache();
    await getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, keywordsMock as unknown as typeof fetch);
    await getSeRankingCompetitors("acme.com", "us", 10, TEST_KEY, competitorsMock as unknown as typeof fetch);
    await getSeRankingBacklinks("acme.com", TEST_KEY, backlinksMock as unknown as typeof fetch);

    expect(keywordsMock).toHaveBeenCalledTimes(2);
    expect(competitorsMock).toHaveBeenCalledTimes(2);
    expect(backlinksMock).toHaveBeenCalledTimes(2);
  });

  it("lỗi không được cache, lần gọi sau phải refetch", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(keywordsUpstream));

    await expect(getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(
      SeRankingApiError,
    );
    const recovered = await getSeRankingKeywords("acme.com", "us", 10, TEST_KEY, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual(keywordsExpected);
  });
});
