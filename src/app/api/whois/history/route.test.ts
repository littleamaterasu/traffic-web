import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearWhoisCache, getWhoisHistory } from "@/lib/whois";
import { GET } from "./route";

vi.mock("@/lib/whois", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whois")>();
  return { ...actual, getWhoisHistory: vi.fn(actual.getWhoisHistory) };
});

const API_KEY = "test-key-123";

function purchaseBody() {
  return {
    recordsCount: 3,
    records: [
      {
        audit: "2020-01-01T00:00:00Z",
        registrarName: "Old Registrar",
        nameServers: ["ns1.old.com"],
        expiresDateISO8601: "2025-01-01T00:00:00Z",
        registrantContact: { organization: "Acme Co", email: "sentinel@example.test" },
        rawText: "RAW-SENTINEL",
        cleanText: "RAW-SENTINEL",
      },
      {
        audit: "2022-01-01T00:00:00Z",
        registrarName: "New Registrar",
        nameServers: ["ns1.new.com"],
        expiresDateISO8601: "2026-01-01T00:00:00Z",
        registrantContact: { organization: "Acme Co", email: "sentinel@example.test" },
        rawText: "RAW-SENTINEL",
      },
      {
        audit: "2024-01-01T00:00:00Z",
        registrarName: "New Registrar",
        nameServers: ["ns1.new.com"],
        expiresDateISO8601: "2026-01-01T00:00:00Z",
        registrantContact: { organization: "Acme Co", email: "sentinel@example.test" },
        rawText: "RAW-SENTINEL",
      },
    ],
  };
}

function fetchRouter(options: { count?: number; previewStatus?: number } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const mode = url.searchParams.get("mode");
    if (mode === "preview") {
      if (options.previewStatus) {
        return new Response(JSON.stringify({ error: "upstream_failure" }), {
          status: options.previewStatus,
        });
      }
      return new Response(JSON.stringify({ recordsCount: options.count ?? 3 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (mode === "purchase") {
      return new Response(JSON.stringify(purchaseBody()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "unexpected_mode" }), { status: 400 });
  });
}

function modes(fetchMock: ReturnType<typeof fetchRouter>) {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("mode"));
}

function request(domain = "acme.com") {
  return new NextRequest(`http://localhost/api/whois/history?domain=${domain}`);
}

describe("GET /api/whois/history", () => {
  beforeEach(() => clearWhoisCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain và không gọi upstream cho domain không hợp lệ", async () => {
    const fetchMock = fetchRouter();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("localhost"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream", async () => {
    vi.stubEnv("WHOIS_API_KEY", "");
    const fetchMock = fetchRouter();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình WHOIS_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("xem trước rồi mua lịch sử đúng một lần và chỉ trả timeline gọn không lộ dữ liệu nhạy cảm", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ count: 3 });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body.domain).toBe("acme.com");
    expect(body.history.error).toBeNull();
    expect(body.history.data.summary.records).toBe(3);
    expect(Array.isArray(body.history.data.events)).toBe(true);
    expect(typeof body.history.data.events_truncated).toBe("boolean");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(modes(fetchMock)).toEqual(["preview", "purchase"]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("RAW-SENTINEL");
    expect(serialized).not.toContain("sentinel@example.test");
  });

  it("trả slice lỗi too_many_records và không mua dữ liệu khi vượt giới hạn 100 bản ghi", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ count: 101 });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.history.data).toBeNull();
    expect(body.history.error.code).toBe("too_many_records");
    expect(body.history.error.message).toContain("101");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(modes(fetchMock)).not.toContain("purchase");
  });

  it("trả slice lỗi insufficient_credits khi xem trước bị từ chối với 402", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ previewStatus: 402 }));

    const body = await (await GET(request())).json();

    expect(body.history.data).toBeNull();
    expect(body.history.error.code).toBe("insufficient_credits");
  });

  it("không gọi thêm upstream cho yêu cầu lặp lại sau khi thành công", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ count: 3 });
    vi.stubGlobal("fetch", fetchMock);

    await GET(request());
    await GET(request());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("không gọi thêm upstream cho yêu cầu lặp lại sau too_many_records", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ count: 101 });
    vi.stubGlobal("fetch", fetchMock);

    await GET(request());
    await GET(request());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("thay lỗi không xác định bằng thông điệp chung và không lộ chi tiết nội bộ", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter());
    vi.mocked(getWhoisHistory).mockImplementationOnce(() => {
      throw new Error("secret internal");
    });

    const body = await (await GET(request())).json();

    expect(body.history).toEqual({
      data: null,
      error: { code: "unexpected_error", message: "Không thể lấy dữ liệu WHOIS lúc này." },
    });
    expect(JSON.stringify(body)).not.toContain("secret internal");
  });
});
