import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearSeRankingCache } from "@/lib/seranking";
import type { SeRankingOverview } from "@/types/seranking";
import { GET } from "./route";

const API_KEY = "test-key-123";

const OVERVIEW_PATH = "/v1/domain/overview/worldwide";
const COMPETITORS_PATH = "/v1/domain/competitors";

const overviewUpstream = {
  organic: [
    { source: "worldwide", keywords_count: 534_575, traffic_sum: 531_195, price_sum: 274_754.56 },
  ],
  adv: [{ source: "worldwide", keywords_count: 335, traffic_sum: 2_916, price_sum: 658.06 }],
};

const expectedOverview: SeRankingOverview = {
  organic: { keywords_count: 534_575, traffic_sum: 531_195, price_sum: 274_754.56 },
  paid: { keywords_count: 335, traffic_sum: 2_916, price_sum: 658.06 },
};

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

  it("trả 200 chỉ gồm domain, source, overview; không gọi competitors, backlinks và không lộ key", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({
      [OVERVIEW_PATH]: overviewUpstream,
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
    });
    expect(body).not.toHaveProperty("competitors");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain(COMPETITORS_PATH);
      expect(String(url)).not.toContain("/domain/keywords");
      expect(String(url)).not.toContain("/backlinks/");
    }
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("trả 200 với slice overview lỗi khi upstream overview trả 500", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [OVERVIEW_PATH]: 500 }));

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toEqual({
      data: null,
      error: { code: "seranking_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
    });
  });

  it("trả 200 với slice overview lỗi invalid_api_key khi upstream trả 401", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [OVERVIEW_PATH]: 401 }));

    const response = await GET(new NextRequest("http://localhost/api/seranking?domain=acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toEqual({
      data: null,
      error: { code: "invalid_api_key", message: "SE_RANKING_API_KEY không hợp lệ hoặc đã hết hạn." },
    });
  });
});
