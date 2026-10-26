import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearReferringSitesCache, getReferringSites } from "@/lib/referring-sites";
import { referringSitesUpstreamFixture } from "@/test/referring-sites-fixture";
import { GET } from "./route";

vi.mock("@/lib/referring-sites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/referring-sites")>();
  return { ...actual, getReferringSites: vi.fn(actual.getReferringSites) };
});

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function request(domain?: string) {
  const query = domain === undefined ? "" : `?domain=${domain}`;
  return new NextRequest(`http://localhost/api/referring-sites${query}`);
}

describe("GET /api/referring-sites", () => {
  beforeEach(() => {
    clearReferringSitesCache();
    vi.stubEnv("TABAPI_KEY", "test-key-123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả 200 với envelope referring_sites, header Cache-Control và gọi upstream đúng một lần", async () => {
    const fetchMock = jsonFetch(referringSitesUpstreamFixture);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body.domain).toBe("acme.com");
    expect(body.referring_sites.error).toBeNull();
    expect(body.referring_sites.data.overview.domain_rating).toBe(93);
    expect(body.referring_sites.data.backlinks).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://tabapi.com/api/v1/domains/acme.com/backlinks");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-key-123");
  });

  it("không để lộ API key trong response", async () => {
    vi.stubGlobal("fetch", jsonFetch(referringSitesUpstreamFixture));
    const response = await GET(request("acme.com"));
    expect(JSON.stringify(await response.json())).not.toContain("test-key-123");
  });

  it("trả 400 invalid_domain và không gọi upstream cho domain không hợp lệ", async () => {
    const fetchMock = jsonFetch({});
    vi.stubGlobal("fetch", fetchMock);

    for (const value of ["http://localhost", undefined, "127.0.0.1"]) {
      const response = await GET(request(value));
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe("invalid_domain");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ưu tiên invalid_domain hơn missing_api_key", async () => {
    vi.stubEnv("TABAPI_KEY", "");
    const response = await GET(request("127.0.0.1"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_domain");
  });

  it("trả 500 missing_api_key và không gọi upstream khi thiếu TABAPI_KEY", async () => {
    const fetchMock = jsonFetch({});
    vi.stubGlobal("fetch", fetchMock);

    for (const value of [undefined, ""]) {
      if (value === undefined) {
        vi.stubEnv("TABAPI_KEY", undefined as unknown as string);
      } else {
        vi.stubEnv("TABAPI_KEY", value);
      }
      const response = await GET(request("acme.com"));
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error.code).toBe("missing_api_key");
      expect(body.error.message).toContain("TABAPI_KEY");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi upstream 402 dưới dạng error slice với HTTP 200", async () => {
    vi.stubGlobal("fetch", jsonFetch({ error: { message: "x" } }, 402));
    const response = await GET(request("acme.com"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.referring_sites.data).toBeNull();
    expect(body.referring_sites.error.code).toBe("insufficient_credits");
  });

  it("trả upstream_error khi upstream 500", async () => {
    vi.stubGlobal("fetch", jsonFetch({}, 500));
    const response = await GET(request("acme.com"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.referring_sites.data).toBeNull();
    expect(body.referring_sites.error.code).toBe("upstream_error");
  });

  it("che lỗi nội bộ không xác định bằng thông điệp tiếng Việt chung", async () => {
    vi.mocked(getReferringSites).mockRejectedValueOnce(new Error("SENTINEL-INTERNAL"));
    const response = await GET(request("acme.com"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.referring_sites.error.code).toBe("unexpected_error");
    expect(body.referring_sites.error.message).toBe("Không thể tải dữ liệu backlink lúc này.");
    expect(JSON.stringify(body)).not.toContain("SENTINEL-INTERNAL");
  });

  it("coi body backlink rỗng là dữ liệu rỗng chứ không phải lỗi", async () => {
    vi.stubGlobal("fetch", jsonFetch({ domain: "acme.com", overview: {}, backlinks: [] }));
    const response = await GET(request("acme.com"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.referring_sites.error).toBeNull();
    expect(body.referring_sites.data.overview).toBeNull();
    expect(body.referring_sites.data.backlinks).toEqual([]);
  });

  it("dùng cache cho hai lần gọi liên tiếp cùng domain", async () => {
    const fetchMock = jsonFetch(referringSitesUpstreamFixture);
    vi.stubGlobal("fetch", fetchMock);
    await GET(request("acme.com"));
    await GET(request("acme.com"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
