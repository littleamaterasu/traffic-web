import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearWhoisCache, fetchWhoisRecord, getWhoisRecord, WhoisApiError } from "./whois";

const API_KEY = "test-key-123";
const NOW = new Date("2026-10-23T00:00:00Z");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recordBody(overrides: Record<string, unknown> = {}) {
  return {
    WhoisRecord: {
      createdDate: "2017-01-11T10:00:00Z",
      updatedDate: "2025-02-01T10:00:00Z",
      expiresDate: "2027-01-11T10:00:00Z",
      estimatedDomainAge: 3571,
      registrarName: "GoDaddy.com, LLC",
      status:
        "clientTransferProhibited https://icann.org/epp#clientTransferProhibited clientDeleteProhibited",
      nameServers: { hostNames: ["NS1.Acme.com", "ns2.acme.com"] },
      registrant: {
        organization: "Domains By Proxy, LLC",
        name: "Registration Private",
        email: "secret@example.com",
      },
      rawText: "RAW-SENTINEL",
      ...overrides,
    },
  };
}

describe("fetchWhoisRecord", () => {
  beforeEach(() => {
    clearWhoisCache();
  });

  it("gọi đúng host, đường dẫn và tham số WhoisXML", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(recordBody()));
    await fetchWhoisRecord("acme.com", API_KEY, fetchMock as unknown as typeof fetch, NOW);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.host).toBe("www.whoisxmlapi.com");
    expect(url.pathname).toBe("/whoisserver/WhoisService");
    expect(url.searchParams.get("apiKey")).toBe(API_KEY);
    expect(url.searchParams.get("domainName")).toBe("acme.com");
    expect(url.searchParams.get("outputFormat")).toBe("JSON");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  });

  it("ánh xạ bản ghi WHOIS sang WhoisRecord gọn và không lộ dữ liệu thô", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(recordBody()));
    const result = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    );

    expect(result).toMatchObject({
      created_date: "2017-01-11T10:00:00Z",
      updated_date: "2025-02-01T10:00:00Z",
      expires_date: "2027-01-11T10:00:00Z",
      age_days: 3571,
      registrar: "GoDaddy.com, LLC",
      status: ["clientTransferProhibited", "clientDeleteProhibited"],
      name_servers: ["ns1.acme.com", "ns2.acme.com"],
      registrant_organization: "Domains By Proxy, LLC",
      privacy_protected: true,
    });
    expect(result?.age_verdict?.level).toBe("established");
    expect(result?.age_years).toBeGreaterThan(9);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("RAW-SENTINEL");
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain(API_KEY);
  });

  it("dùng registryData khi thiếu ngày ở cấp trên và ước tính tuổi khi thiếu ngày tạo", async () => {
    const body = recordBody({
      createdDate: undefined,
      updatedDate: undefined,
      expiresDate: undefined,
      registryData: {
        updatedDate: "2024-05-05T00:00:00Z",
        expiresDate: "2028-05-05T00:00:00Z",
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    );

    expect(result?.created_date).toBeNull();
    expect(result?.updated_date).toBe("2024-05-05T00:00:00Z");
    expect(result?.expires_date).toBe("2028-05-05T00:00:00Z");
    expect(result?.age_years).toBeCloseTo(3571 / 365.25, 5);
  });

  it("trả null khi không có WhoisRecord hoặc thiếu dữ liệu WHOIS", async () => {
    const empty = vi.fn().mockResolvedValue(jsonResponse({}));
    expect(
      await fetchWhoisRecord("acme.com", API_KEY, empty as unknown as typeof fetch, NOW),
    ).toBeNull();

    const missing = vi.fn().mockResolvedValue(
      jsonResponse({ WhoisRecord: { dataError: "MISSING_WHOIS_DATA" } }),
    );
    expect(
      await fetchWhoisRecord("acme.com", API_KEY, missing as unknown as typeof fetch, NOW),
    ).toBeNull();
  });

  it.each([
    [401, 401, "invalid_api_key"],
    [403, 401, "invalid_api_key"],
    [402, 402, "insufficient_credits"],
    [429, 429, "rate_limited"],
    [400, 502, "whois_error"],
    [422, 502, "whois_error"],
    [500, 502, "whois_error"],
  ])("ánh xạ HTTP %i sang mã lỗi", async (httpStatus, status, code) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: `upstream ${API_KEY}` }, httpStatus));
    const error = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(WhoisApiError);
    expect(error).toMatchObject({ status, code });
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain("whoisxmlapi.com");
  });

  it("báo network_error khi fetch bị từ chối và không lộ key", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(`boom ${API_KEY}`));
    const error = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    ).catch((caught) => caught);

    expect(error).toMatchObject({ status: 502, code: "network_error" });
    expect(error.message).not.toContain(API_KEY);
  });

  it("báo whois_error khi 200 không phải JSON hoặc chứa ErrorMessage", async () => {
    const notJson = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(
      fetchWhoisRecord("acme.com", API_KEY, notJson as unknown as typeof fetch, NOW),
    ).rejects.toMatchObject({ status: 502, code: "whois_error" });

    const withError = vi.fn().mockResolvedValue(jsonResponse({ ErrorMessage: { msg: "bad" } }));
    await expect(
      fetchWhoisRecord("acme.com", API_KEY, withError as unknown as typeof fetch, NOW),
    ).rejects.toMatchObject({ status: 502, code: "whois_error" });
  });
});

describe("getWhoisRecord", () => {
  beforeEach(() => {
    clearWhoisCache();
  });

  it("chỉ gọi upstream một lần cho cùng domain, kể cả khi gọi đồng thời", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(recordBody()));
    const impl = fetchMock as unknown as typeof fetch;

    await Promise.all([
      getWhoisRecord("acme.com", API_KEY, impl),
      getWhoisRecord("acme.com", API_KEY, impl),
    ]);
    await getWhoisRecord("acme.com", API_KEY, impl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
