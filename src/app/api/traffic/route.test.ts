import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearTrafficCache } from "@/lib/tabapi";
import { trafficFixture } from "@/test/fixture";
import { GET } from "./route";

describe("GET /api/traffic", () => {
  beforeEach(() => clearTrafficCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 cho domain không hợp lệ", async () => {
    const response = await GET(new NextRequest("http://localhost/api/traffic?domain=localhost"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
  });

  it("trả lỗi cấu hình khi thiếu key", async () => {
    vi.stubEnv("TABAPI_KEY", "");
    const response = await GET(new NextRequest("http://localhost/api/traffic?domain=vercel.com"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình TABAPI_KEY trên máy chủ." },
    });
  });

  it("trả lỗi cấu hình khi số tháng nằm ngoài phạm vi TabAPI hỗ trợ", async () => {
    vi.stubEnv("TABAPI_KEY", "sk_test");
    vi.stubEnv("TRAFFIC_MONTHS", "2");

    const response = await GET(new NextRequest("http://localhost/api/traffic?domain=vercel.com"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_configuration", message: expect.stringContaining("3–12") },
    });
  });

  it("chuẩn hóa URL và trả dữ liệu mà không để lộ key", async () => {
    const secret = "sk_route_secret";
    vi.stubEnv("TABAPI_KEY", secret);
    vi.stubEnv("TRAFFIC_MONTHS", "6");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(trafficFixture), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/traffic?domain=https%3A%2F%2FVERCEL.com%2Fblog"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body).domain).toBe("vercel.com");
    expect(body).not.toContain(secret);
    expect(fetchMock.mock.calls[0][0]).toContain("/domains/vercel.com/traffic?months=6");
  });
});
