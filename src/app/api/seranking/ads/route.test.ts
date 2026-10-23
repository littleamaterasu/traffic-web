import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearSeRankingCache } from "@/lib/seranking";
import type { SeRankingAdKeyword } from "@/types/seranking";
import { GET } from "./route";

const API_KEY = "test-key-123";
const KEYWORDS_PATH = "/v1/domain/keywords";

const adsUpstream = [
  {
    keyword: "giày chạy bộ",
    position: 1,
    volume: 12_000,
    cpc: 1.25,
    competition: 0.8,
    url: "https://acme.com/giay",
    block: "top",
    block_position: 1,
    snippet_title: "Giày chạy bộ - Acme",
    snippet_description: "Giảm giá mùa hè",
    snippet_display_url: "acme.com/giay",
    traffic: 500,
    price: 99.5,
    difficulty: 40,
  },
];

const expectedAds: SeRankingAdKeyword[] = [
  {
    keyword: "giày chạy bộ",
    position: 1,
    block: "top",
    url: "https://acme.com/giay",
    snippet_title: "Giày chạy bộ - Acme",
    snippet_description: "Giảm giá mùa hè",
    snippet_display_url: "acme.com/giay",
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

describe("GET /api/seranking/ads", () => {
  beforeEach(() => clearSeRankingCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain khi thiếu domain và không gọi upstream", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 400 invalid_source khi source không phải hai chữ cái thường", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/ads?domain=acme.com&source=US"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid_source", message: "Mã cơ sở dữ liệu khu vực không hợp lệ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", "");
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads?domain=acme.com"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 200 với mẫu quảng cáo, source mặc định us, limit 10, không lộ key và không có volume/cpc", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [KEYWORDS_PATH]: adsUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body).toEqual({
      domain: "acme.com",
      source: "us",
      ads: { data: expectedAds, error: null },
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("source=us");
    expect(url).toContain("limit=10");
    expect(url).toContain("type=adv");
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    for (const row of body.ads.data) {
      expect(row).not.toHaveProperty("volume");
      expect(row).not.toHaveProperty("cpc");
      expect(row).not.toHaveProperty("traffic");
      expect(row).not.toHaveProperty("price");
    }
  });

  it("trả 200 với slice lỗi khi upstream trả 500", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [KEYWORDS_PATH]: 500 }));

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ads).toEqual({
      data: null,
      error: { code: "seranking_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
    });
  });

  it("giữ nguyên mã lỗi invalid_api_key khi upstream trả 401", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [KEYWORDS_PATH]: 401 }));

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads?domain=acme.com"));
    const body = await response.json();

    expect(body.ads.error?.code).toBe("invalid_api_key");
  });

  it("không lộ key hoặc thông điệp nội bộ khi fetch ném lỗi không xác định", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("secret " + API_KEY);
      }),
    );

    const response = await GET(new NextRequest("http://localhost/api/seranking/ads?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect(body.ads.data).toBeNull();
    expect(typeof body.ads.error.message).toBe("string");
  });

  it("phục vụ lần gọi thứ hai từ cache, chỉ gọi upstream một lần", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [KEYWORDS_PATH]: adsUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const url = "http://localhost/api/seranking/ads?domain=acme.com";
    await GET(new NextRequest(url));
    const second = await GET(new NextRequest(url));

    expect((await second.json()).ads.data).toEqual(expectedAds);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
