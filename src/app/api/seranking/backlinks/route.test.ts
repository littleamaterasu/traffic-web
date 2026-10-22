import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearSeRankingCache } from "@/lib/seranking";
import type { SeRankingBacklinks } from "@/types/seranking";
import { GET } from "./route";

const API_KEY = "test-key-123";

const BACKLINKS_PATH = "/v1/backlinks/summary";

const backlinksUpstream = {
  summary: [
    {
      target: "acme.com",
      backlinks: 12_345,
      refdomains: 678,
      dofollow_backlinks: 11_111,
      nofollow_backlinks: 1_234,
      dofollow_refdomains: 600,
      domain_inlink_rank: 78.9,
      inlink_rank: 61.2,
      top_anchors_by_backlinks: [{ anchor: "acme", backlinks: 999, refdomains: 45 }],
      top_anchors_by_refdomains: [{ anchor: "đối tác", refdomains: 12 }],
    },
  ],
};

const expectedBacklinks: SeRankingBacklinks = {
  target: "acme.com",
  backlinks: 12_345,
  refdomains: 678,
  dofollow_backlinks: 11_111,
  nofollow_backlinks: 1_234,
  dofollow_refdomains: 600,
  domain_inlink_rank: 78.9,
  inlink_rank: 61.2,
  top_anchors_by_backlinks: [{ anchor: "acme", backlinks: 999, refdomains: 45 }],
  top_anchors_by_refdomains: [{ anchor: "đối tác", backlinks: null, refdomains: 12 }],
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

describe("GET /api/seranking/backlinks", () => {
  beforeEach(() => clearSeRankingCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain và không gọi upstream cho domain không hợp lệ", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/backlinks?domain=localhost"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", "");
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/backlinks?domain=acme.com"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 200 với slice backlinks khi upstream OK, không lộ key và đặt Cache-Control", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [BACKLINKS_PATH]: backlinksUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/backlinks?domain=acme.com"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body).toEqual({
      domain: "acme.com",
      backlinks: { data: expectedBacklinks, error: null },
    });
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("trả 200 với slice lỗi khi upstream trả 500", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [BACKLINKS_PATH]: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/seranking/backlinks?domain=acme.com"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      domain: "acme.com",
      backlinks: {
        data: null,
        error: { code: "seranking_error", message: "Không thể lấy dữ liệu SE Ranking lúc này." },
      },
    });
  });

  it("gọi upstream chỉ một lần khi gọi route hai lần liên tiếp nhờ cache", async () => {
    vi.stubEnv("SE_RANKING_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [BACKLINKS_PATH]: backlinksUpstream });
    vi.stubGlobal("fetch", fetchMock);

    await GET(new NextRequest("http://localhost/api/seranking/backlinks?domain=acme.com"));
    await GET(new NextRequest("http://localhost/api/seranking/backlinks?domain=acme.com"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
