import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearWhoisCache,
  fetchWhoisHistory,
  fetchWhoisRecord,
  getWhoisHistory,
  getWhoisRecord,
  HISTORY_RECORD_CAP,
  WhoisApiError,
} from "./whois";

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

function historyRecord(audit: string, registrar: string, extra: Record<string, unknown> = {}) {
  return {
    audit,
    registrarName: registrar,
    nameServers: ["a.ns.com|b.ns.com"],
    expiresDateISO8601: "2027-01-11T00:00:00Z",
    registrantContact: {
      organization: "Acme Co",
      name: "NAME-SENTINEL",
      email: "EMAIL-SENTINEL@example.com",
      telephone: "PHONE-SENTINEL",
    },
    rawText: "RAW-SENTINEL",
    cleanText: "CLEAN-SENTINEL",
    ...extra,
  };
}

function historyFetch(count: unknown, records?: unknown[]) {
  return vi.fn().mockImplementation(async (input: unknown) => {
    const mode = new URL(String(input)).searchParams.get("mode");
    if (mode === "preview") return jsonResponse({ recordsCount: count });
    return jsonResponse({ recordsCount: count, ...(records ? { records } : {}) });
  });
}

function modes(fetchMock: ReturnType<typeof vi.fn>): (string | null)[] {
  return fetchMock.mock.calls.map((call) => new URL(String(call[0])).searchParams.get("mode"));
}

describe("fetchWhoisHistory", () => {
  beforeEach(() => {
    clearWhoisCache();
  });

  it("xem trước trước và trả lịch sử rỗng khi recordsCount là 0", async () => {
    const fetchMock = historyFetch(0);
    const result = await fetchWhoisHistory("acme.com", API_KEY, fetchMock as unknown as typeof fetch);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.host).toBe("whois-history.whoisxmlapi.com");
    expect(url.pathname).toBe("/api/v1");
    expect(url.searchParams.get("domainName")).toBe("acme.com");
    expect(url.searchParams.get("apiKey")).toBe(API_KEY);
    expect(result.summary.records).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("từ chối mua khi vượt giới hạn và chỉ gọi upstream một lần", async () => {
    const fetchMock = historyFetch(HISTORY_RECORD_CAP + 1);
    const error = await fetchWhoisHistory(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(WhoisApiError);
    expect(error).toMatchObject({ status: 422, code: "too_many_records" });
    expect(error.message).toContain("101");
    expect(error.message).toContain(String(HISTORY_RECORD_CAP));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(modes(fetchMock)).not.toContain("purchase");
  });

  it("mua dữ liệu khi trong giới hạn, rút gọn và loại bỏ dữ liệu thô", async () => {
    const records = [
      historyRecord("2024-01-01", "GoDaddy.com, LLC"),
      historyRecord("2025-01-01", "Namecheap, Inc."),
      {
        audit: { updatedDate: "2023-01-01", createdDate: "2020-01-01" },
        registrarName: "GoDaddy.com, LLC",
        nameServers: ["a.ns.com|b.ns.com"],
        expiresDateISO8601: "2027-01-11T00:00:00Z",
        registrantContact: { name: "Acme Co", email: "EMAIL-SENTINEL@example.com" },
      },
    ];
    const fetchMock = historyFetch(44, records);
    const result = await fetchWhoisHistory("acme.com", API_KEY, fetchMock as unknown as typeof fetch);

    expect(modes(fetchMock)).toEqual(["preview", "purchase"]);
    expect(result.summary.records).toBe(3);
    expect(result.summary.first_seen).toBe("2023-01-01");
    expect(result.summary.registrar_changes).toBe(1);
    const serialized = JSON.stringify(result);
    for (const sentinel of [
      "RAW-SENTINEL",
      "CLEAN-SENTINEL",
      "EMAIL-SENTINEL",
      "PHONE-SENTINEL",
      "NAME-SENTINEL",
      API_KEY,
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("báo whois_error khi recordsCount không phải số và trả rỗng khi thiếu records", async () => {
    const bad = historyFetch("many");
    await expect(
      fetchWhoisHistory("acme.com", API_KEY, bad as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502, code: "whois_error" });

    const noRecords = historyFetch(5);
    const result = await fetchWhoisHistory(
      "acme.com",
      API_KEY,
      noRecords as unknown as typeof fetch,
    );
    expect(result.summary.records).toBe(0);
  });
});

describe("getWhoisHistory", () => {
  beforeEach(() => {
    clearWhoisCache();
  });

  it("lần gọi thứ hai không gọi upstream thêm", async () => {
    const fetchMock = historyFetch(2, [
      historyRecord("2024-01-01", "GoDaddy.com, LLC"),
      historyRecord("2025-01-01", "GoDaddy.com, LLC"),
    ]);
    const impl = fetchMock as unknown as typeof fetch;

    await getWhoisHistory("acme.com", API_KEY, impl);
    await getWhoisHistory("acme.com", API_KEY, impl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sau lỗi too_many_records lần gọi tiếp theo không xem trước lại", async () => {
    const fetchMock = historyFetch(500);
    const impl = fetchMock as unknown as typeof fetch;

    await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
      code: "too_many_records",
    });
    await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
      code: "too_many_records",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clearWhoisCache xoá cả ba kho cache", async () => {
    const fetchMock = historyFetch(0);
    const impl = fetchMock as unknown as typeof fetch;

    await getWhoisHistory("acme.com", API_KEY, impl);
    clearWhoisCache();
    await getWhoisHistory("acme.com", API_KEY, impl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
