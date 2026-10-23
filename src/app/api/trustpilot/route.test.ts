import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearTrustpilotCache, getTrustpilotProfile } from "@/lib/trustpilot";
import { trustpilotFixture, trustpilotUpstreamFixture } from "@/test/trustpilot-fixture";
import { GET } from "./route";

vi.mock("@/lib/trustpilot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trustpilot")>();
  return { ...actual, getTrustpilotProfile: vi.fn(actual.getTrustpilotProfile) };
});

const SCRAPER_URL = "http://scraper.test:5000";

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
  return new NextRequest(`http://localhost/api/trustpilot${query}`);
}

describe("GET /api/trustpilot", () => {
  beforeEach(() => clearTrustpilotCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả 200 với envelope trustpilot đã chuẩn hóa và header Cache-Control", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    const fetchMock = jsonFetch(trustpilotUpstreamFixture);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body.domain).toBe("acme.com");
    expect(body.trustpilot.error).toBeNull();
    expect(body.trustpilot.data.profile).toEqual(trustpilotFixture.trustpilot.data?.profile);
    expect(typeof body.trustpilot.data.fetched_at).toBe("string");
    expect(JSON.stringify(body)).not.toContain("scraper.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("trả 400 invalid_domain và không gọi upstream cho domain không hợp lệ", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    const fetchMock = jsonFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const local = await GET(request("http://localhost"));
    const missing = await GET(request());

    expect(local.status).toBe(400);
    await expect(local.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(missing.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 500 missing_scraper_url khi biến môi trường rỗng và không gọi upstream", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", "");
    const fetchMock = jsonFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("acme.com"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("missing_scraper_url");
    expect(body.error.message).toContain("TRUSTPILOT_SCRAPER_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ưu tiên invalid_domain hơn missing_scraper_url", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", "");

    const response = await GET(request("localhost"));

    expect(response.status).toBe(400);
  });

  it("trả slice lỗi scraper_error khi upstream trả 500", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    vi.stubGlobal("fetch", jsonFetch({ error: "boom" }, 500));

    const response = await GET(request("acme.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trustpilot.data).toBeNull();
    expect(body.trustpilot.error.code).toBe("scraper_error");
    expect(JSON.stringify(body)).not.toContain("scraper.test");
  });

  it("trả profile null không lỗi khi success true nhưng không có business", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    vi.stubGlobal("fetch", jsonFetch({ success: true, target: "acme.com", reviews: [] }));

    const body = await (await GET(request("acme.com"))).json();

    expect(body.trustpilot.error).toBeNull();
    expect(body.trustpilot.data.profile).toBeNull();
  });

  it("thay lỗi không xác định bằng thông điệp chung và không lộ chi tiết nội bộ", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    vi.mocked(getTrustpilotProfile).mockImplementationOnce(() => {
      throw new Error("SENTINEL-INTERNAL");
    });

    const response = await GET(request("acme.com"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text).trustpilot).toEqual({
      data: null,
      error: { code: "unexpected_error", message: "Không thể lấy đánh giá Trustpilot lúc này." },
    });
    expect(text).not.toContain("SENTINEL-INTERNAL");
    expect(text).not.toContain("scraper.test");
  });

  it("gọi upstream chỉ một lần khi gọi route hai lần liên tiếp nhờ cache", async () => {
    vi.stubEnv("TRUSTPILOT_SCRAPER_URL", SCRAPER_URL);
    const fetchMock = jsonFetch(trustpilotUpstreamFixture);
    vi.stubGlobal("fetch", fetchMock);

    await GET(request("acme.com"));
    await GET(request("acme.com"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
