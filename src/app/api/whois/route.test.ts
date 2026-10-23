import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearWhoisCache, getWhoisRecord } from "@/lib/whois";
import { GET } from "./route";

vi.mock("@/lib/whois", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whois")>();
  return { ...actual, getWhoisRecord: vi.fn(actual.getWhoisRecord) };
});

const API_KEY = "test-key-123";

const WHOIS_PATH = "/whoisserver/WhoisService";

const whoisUpstream = {
  WhoisRecord: {
    createdDate: "2010-05-01T00:00:00Z",
    updatedDate: "2024-01-15T00:00:00Z",
    expiresDate: "2030-05-01T00:00:00Z",
    registrarName: "Acme Registrar",
    status: "clientTransferProhibited",
    nameServers: { hostNames: ["ns1.acme.com", "ns2.acme.com"] },
    registrant: { organization: "Acme Co", name: "Alice" },
    rawText: "RAW-SENTINEL",
    contactEmail: "sentinel@example.test",
  },
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

function request(domain = "acme.com") {
  return new NextRequest(`http://localhost/api/whois?domain=${domain}`);
}

describe("GET /api/whois", () => {
  beforeEach(() => clearWhoisCache());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trả lỗi 400 invalid_domain và không gọi upstream cho domain không hợp lệ", async () => {
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("localhost"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_domain" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream", async () => {
    vi.stubEnv("WHOIS_API_KEY", "");
    const fetchMock = fetchRouter({});
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "missing_api_key", message: "Chưa cấu hình WHOIS_API_KEY trên máy chủ." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 200 với slice whois gọn khi upstream OK, không lộ key, raw text hay email", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [WHOIS_PATH]: whoisUpstream });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(body.domain).toBe("acme.com");
    expect(body.whois.error).toBeNull();
    expect(body.whois.data).toMatchObject({
      created_date: "2010-05-01T00:00:00Z",
      registrar: "Acme Registrar",
      name_servers: ["ns1.acme.com", "ns2.acme.com"],
      registrant_organization: "Acme Co",
    });
    expect(typeof body.whois.data.age_days).toBe("number");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("RAW-SENTINEL");
    expect(serialized).not.toContain("sentinel@example.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("trả 200 với slice lỗi whois_error khi upstream trả 500", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [WHOIS_PATH]: 500 }));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      domain: "acme.com",
      whois: {
        data: null,
        error: { code: "whois_error", message: "Không thể lấy dữ liệu WHOIS lúc này." },
      },
    });
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("trả slice lỗi insufficient_credits khi upstream trả 402", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [WHOIS_PATH]: 402 }));

    const body = await (await GET(request())).json();

    expect(body.whois.data).toBeNull();
    expect(body.whois.error.code).toBe("insufficient_credits");
  });

  it("thay lỗi không xác định bằng thông điệp chung và không lộ chi tiết nội bộ", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({}));
    vi.mocked(getWhoisRecord).mockImplementationOnce(() => {
      throw new Error("secret internal");
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.whois).toEqual({
      data: null,
      error: { code: "unexpected_error", message: "Không thể lấy dữ liệu WHOIS lúc này." },
    });
    expect(JSON.stringify(body)).not.toContain("secret internal");
  });

  it("trả slice rỗng không lỗi khi upstream không có WhoisRecord", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    vi.stubGlobal("fetch", fetchRouter({ [WHOIS_PATH]: {} }));

    const body = await (await GET(request())).json();

    expect(body.whois).toEqual({ data: null, error: null });
  });

  it("gọi upstream chỉ một lần khi gọi route hai lần liên tiếp nhờ cache", async () => {
    vi.stubEnv("WHOIS_API_KEY", API_KEY);
    const fetchMock = fetchRouter({ [WHOIS_PATH]: whoisUpstream });
    vi.stubGlobal("fetch", fetchMock);

    await GET(request());
    await GET(request());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
