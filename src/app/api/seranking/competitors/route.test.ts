import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearSeRankingCache } from "@/lib/seranking";
import type { SeRankingCompetitor } from "@/types/seranking";
import { GET } from "./route";

const API_KEY = "test-key-123";
const COMPETITORS_PATH = "/v1/domain/competitors";

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

describe("GET /api/seranking/competitors", () => {
  beforeEach(() => clearSeRankingCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain khi thiếu domain và không gọi upstream", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("http://localhost/api/seranking/competitors"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 400 invalid_source khi source không phải hai chữ cái thường", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com&source=US"),
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

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 200 với danh sách đối thủ, source mặc định us, limit 10 và không lộ key", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [COMPETITORS_PATH]: competitorsUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body).toEqual({
      domain: "acme.com",
      source: "us",
      competitors: { data: expectedCompetitors, error: null },
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("source=us");
    expect(url).toContain("limit=10");
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("trả 200 với slice lỗi khi upstream trả 500", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [COMPETITORS_PATH]: 500 }));

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competitors).toEqual({
      data: null,
      error: { code: "seranking_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
    });
  });

  it("giữ nguyên mã lỗi invalid_api_key khi upstream trả 401", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [COMPETITORS_PATH]: 401 }));

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com"),
    );
    const body = await response.json();

    expect(body.competitors.error?.code).toBe("invalid_api_key");
  });

  it("không lộ key hoặc thông điệp nội bộ khi fetch ném lỗi không xác định", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("secret " + API_KEY);
      }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/competitors?domain=acme.com"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect(body.competitors.data).toBeNull();
    expect(typeof body.competitors.error.message).toBe("string");
  });

  it("phục vụ lần gọi thứ hai từ cache, chỉ gọi upstream một lần", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [COMPETITORS_PATH]: competitorsUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const url = "http://localhost/api/seranking/competitors?domain=acme.com";
    await GET(new NextRequest(url));
    const second = await GET(new NextRequest(url));

    expect((await second.json()).competitors.data).toEqual(expectedCompetitors);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
