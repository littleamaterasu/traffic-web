import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTrafficCache, fetchTrafficFromTabApi, getTraffic, TrafficApiError } from "./tabapi";
import { trafficFixture } from "@/test/fixture";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TabAPI client", () => {
  beforeEach(() => clearTrafficCache());

  it("gọi đúng endpoint và chỉ gửi key trong Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(trafficFixture));
    const secret = "sk_test_secret";

    const result = await fetchTrafficFromTabApi("vercel.com", secret, 6, fetchMock as unknown as typeof fetch);

    expect(result.domain).toBe("vercel.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tabapi.com/api/v1/domains/vercel.com/traffic?months=6");
    expect(url).not.toContain(secret);
    expect(options.headers.Authorization).toBe(`Bearer ${secret}`);
  });

  it("cache kết quả thành công theo domain", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(trafficFixture));

    await getTraffic("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch);
    await getTraffic("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tách cache theo số tháng lịch sử", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(trafficFixture));

    await getTraffic("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch);
    await getTraffic("vercel.com", "sk_test", 6, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("months=3");
    expect(fetchMock.mock.calls[1][0]).toContain("months=6");
  });

  it("không cache lỗi", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "insufficient_credits", message: "No credits" } }, 402),
      );

    await expect(getTraffic("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({
      status: 402,
      message: "Tài khoản TabAPI không đủ credits.",
    });
    await expect(getTraffic("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(
      TrafficApiError,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, "invalid_domain", "Tên miền không hợp lệ."],
    [402, "insufficient_credits", "Tài khoản TabAPI không đủ credits."],
    [422, "unprocessable", "Tên miền chưa có đủ 3 tháng dữ liệu."],
    [502, "upstream_error", "TabAPI đang gặp sự cố. Vui lòng thử lại sau."],
  ])("ánh xạ lỗi %s", async (status, code, message) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code, message: "Upstream message" } }, status));

    await expect(fetchTrafficFromTabApi("vercel.com", "sk_test", 3, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({
      status,
      code,
      message,
    });
  });
});
