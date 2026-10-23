import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HISTORY_PURCHASES_PER_DAY,
  canonicalWhoisDomain,
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
      privacy_protected: true,
    });
    expect(result).not.toHaveProperty("registrant_organization");
    expect(result?.age_verdict?.level).toBe("established");
    expect(result?.age_years).toBeGreaterThan(9);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("RAW-SENTINEL");
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("Domains By Proxy");
  });

  it("không trả văn bản chủ sở hữu ra ngoài nhưng vẫn tính privacy_protected", async () => {
    const body = recordBody({
      registrant: { organization: "SENTINEL-ORG-ACME", name: "SENTINEL-PERSON-JANE" },
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    );

    expect(result?.privacy_protected).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SENTINEL-ORG-ACME");
    expect(serialized).not.toContain("SENTINEL-PERSON-JANE");
  });

  it("tính age_days và age_years từ cùng ngày tạo, bỏ qua ước tính", async () => {
    const body = recordBody({ createdDate: "2020-01-01T00:00:00Z", estimatedDomainAge: 99999 });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      new Date("2026-01-01T00:00:00Z"),
    );

    expect(result?.age_days).toBe(2192);
    expect(result?.age_years).toBe(6);
  });

  it("ngày tạo ở tương lai cho age_days, age_years và nhận định đều null", async () => {
    const body = recordBody({ createdDate: "2030-01-01T00:00:00Z", estimatedDomainAge: 500 });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    const result = await fetchWhoisRecord(
      "acme.com",
      API_KEY,
      fetchMock as unknown as typeof fetch,
      NOW,
    );

    expect(result?.age_days).toBeNull();
    expect(result?.age_years).toBeNull();
    expect(result?.age_verdict).toBeNull();
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
    expect(result?.age_days).toBe(3571);
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

  it("www.acme.com và acme.com dùng chung một mục cache và một lần gọi upstream", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(recordBody()));
    const impl = fetchMock as unknown as typeof fetch;

    await getWhoisRecord("www.acme.com", API_KEY, impl);
    await getWhoisRecord("acme.com", API_KEY, impl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("domainName")).toBe("acme.com");
  });
});

describe("canonicalWhoisDomain", () => {
  it("bỏ tiền tố www. và chữ hoa nhưng giữ nguyên khi chỉ còn một nhãn", () => {
    expect(canonicalWhoisDomain("WWW.Acme.com")).toBe("acme.com");
    expect(canonicalWhoisDomain("acme.com")).toBe("acme.com");
    expect(canonicalWhoisDomain("www.com")).toBe("www.com");
    expect(canonicalWhoisDomain("shop.acme.com")).toBe("shop.acme.com");
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
      "Acme Co",
      API_KEY,
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("báo whois_error khi recordsCount không phải số", async () => {
    const bad = historyFetch("many");
    await expect(
      fetchWhoisHistory("acme.com", API_KEY, bad as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502, code: "whois_error" });
  });

  it("báo whois_error khi mua mà recordsCount lớn hơn 0 nhưng thiếu records", async () => {
    const noRecords = historyFetch(5);
    await expect(
      fetchWhoisHistory("acme.com", API_KEY, noRecords as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502, code: "whois_error" });
  });

  it("từ chối khi số bản ghi đã mua vượt giới hạn", async () => {
    const records = Array.from({ length: 4 }, (_, index) =>
      historyRecord(`202${index}-01-01`, "GoDaddy.com, LLC"),
    );
    const fetchMock = historyFetch(2, records);
    await expect(
      fetchWhoisHistory("acme.com", API_KEY, fetchMock as unknown as typeof fetch, 3),
    ).rejects.toMatchObject({ status: 422, code: "too_many_records" });
  });
});

function purchaseBodyFetch(purchaseBody: unknown, count = 2) {
  return vi.fn().mockImplementation(async (input: unknown) => {
    const mode = new URL(String(input)).searchParams.get("mode");
    if (mode === "preview") return jsonResponse({ recordsCount: count });
    return jsonResponse(purchaseBody);
  });
}

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

  it("www.acme.com và acme.com chỉ xem trước một lần và mua một lần", async () => {
    const fetchMock = historyFetch(2, [
      historyRecord("2024-01-01", "GoDaddy.com, LLC"),
      historyRecord("2025-01-01", "GoDaddy.com, LLC"),
    ]);
    const impl = fetchMock as unknown as typeof fetch;

    await getWhoisHistory("www.acme.com", API_KEY, impl);
    await getWhoisHistory("acme.com", API_KEY, impl);

    expect(modes(fetchMock)).toEqual(["preview", "purchase"]);
    for (const call of fetchMock.mock.calls) {
      expect(new URL(String(call[0])).searchParams.get("domainName")).toBe("acme.com");
    }
  });

  it("phản hồi mua 200 sai cấu trúc là whois_error và không bị cache", async () => {
    for (const bad of [{ error: "quota" }, null, "oops", { recordsCount: 2 }]) {
      clearWhoisCache();
      const fetchMock = purchaseBodyFetch(bad);
      const impl = fetchMock as unknown as typeof fetch;

      await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
        status: 502,
        code: "whois_error",
      });
      await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
        code: "whois_error",
      });
      expect(modes(fetchMock).filter((mode) => mode === "purchase")).toHaveLength(2);
    }
  });

  it("recordsCount 0 không có records là lịch sử rỗng và được cache", async () => {
    const fetchMock = purchaseBodyFetch({ recordsCount: 0 }, 1);
    const impl = fetchMock as unknown as typeof fetch;

    const first = await getWhoisHistory("acme.com", API_KEY, impl);
    await getWhoisHistory("acme.com", API_KEY, impl);

    expect(first.summary.records).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("không cache và không trả dữ liệu khi số bản ghi mua về vượt giới hạn", async () => {
    const records = Array.from({ length: HISTORY_RECORD_CAP + 1 }, (_, index) =>
      historyRecord(`2000-01-${String((index % 28) + 1).padStart(2, "0")}`, "GoDaddy.com, LLC"),
    );
    const fetchMock = historyFetch(10, records);
    const impl = fetchMock as unknown as typeof fetch;

    await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
      status: 422,
      code: "too_many_records",
    });
    await expect(getWhoisHistory("acme.com", API_KEY, impl)).rejects.toMatchObject({
      code: "too_many_records",
    });
    expect(modes(fetchMock).filter((mode) => mode === "purchase")).toHaveLength(2);
  });

  describe("ngân sách mua lịch sử", () => {
    function purchases(fetchMock: ReturnType<typeof vi.fn>): number {
      return modes(fetchMock).filter((mode) => mode === "purchase").length;
    }

    const twoRecords = [
      historyRecord("2024-01-01", "GoDaddy.com, LLC"),
      historyRecord("2025-01-01", "GoDaddy.com, LLC"),
    ];

    it("lượt thứ 11 trong 24 giờ bị từ chối với history_budget_exceeded", async () => {
      const fetchMock = historyFetch(2, twoRecords);
      const impl = fetchMock as unknown as typeof fetch;
      const now = () => 1_000_000;

      for (let index = 0; index < HISTORY_PURCHASES_PER_DAY; index += 1) {
        await getWhoisHistory(`site${index}.com`, API_KEY, impl, now);
      }
      const error = await getWhoisHistory("site-extra.com", API_KEY, impl, now).catch(
        (caught) => caught,
      );

      expect(error).toBeInstanceOf(WhoisApiError);
      expect(error).toMatchObject({ status: 429, code: "history_budget_exceeded" });
      expect(purchases(fetchMock)).toBe(HISTORY_PURCHASES_PER_DAY);
    });

    it("cửa sổ trượt 24 giờ giải phóng ngân sách", async () => {
      const fetchMock = historyFetch(2, twoRecords);
      const impl = fetchMock as unknown as typeof fetch;
      let t = 1_000_000;
      const now = () => t;

      for (let index = 0; index < HISTORY_PURCHASES_PER_DAY; index += 1) {
        await getWhoisHistory(`site${index}.com`, API_KEY, impl, now);
      }
      await expect(getWhoisHistory("late.com", API_KEY, impl, now)).rejects.toMatchObject({
        code: "history_budget_exceeded",
      });

      t += 24 * 60 * 60 * 1000 + 1;
      const result = await getWhoisHistory("late.com", API_KEY, impl, now);
      expect(result.summary.records).toBe(2);
    });

    it("lần gọi trúng cache, kể cả biến thể www., không tiêu tốn ngân sách", async () => {
      const fetchMock = historyFetch(2, twoRecords);
      const impl = fetchMock as unknown as typeof fetch;
      const now = () => 1_000_000;

      for (let index = 0; index < HISTORY_PURCHASES_PER_DAY; index += 1) {
        await getWhoisHistory(`site${index}.com`, API_KEY, impl, now);
      }
      await getWhoisHistory("site0.com", API_KEY, impl, now);
      await getWhoisHistory("www.site0.com", API_KEY, impl, now);

      expect(purchases(fetchMock)).toBe(HISTORY_PURCHASES_PER_DAY);
    });

    it("vượt giới hạn bản ghi hoặc không có bản ghi thì không tiêu tốn ngân sách", async () => {
      const now = () => 1_000_000;
      const over = historyFetch(HISTORY_RECORD_CAP + 1) as unknown as typeof fetch;
      const empty = historyFetch(0) as unknown as typeof fetch;

      for (let index = 0; index < HISTORY_PURCHASES_PER_DAY + 2; index += 1) {
        await getWhoisHistory(`over${index}.com`, API_KEY, over, now).catch(() => undefined);
        await getWhoisHistory(`empty${index}.com`, API_KEY, empty, now);
      }

      const fetchMock = historyFetch(2, twoRecords);
      const result = await getWhoisHistory("real.com", API_KEY, fetchMock as unknown as typeof fetch, now);
      expect(result.summary.records).toBe(2);
    });

    it("clearWhoisCache đặt lại bộ đếm ngân sách", async () => {
      const fetchMock = historyFetch(2, twoRecords);
      const impl = fetchMock as unknown as typeof fetch;
      const now = () => 1_000_000;

      for (let index = 0; index < HISTORY_PURCHASES_PER_DAY; index += 1) {
        await getWhoisHistory(`site${index}.com`, API_KEY, impl, now);
      }
      clearWhoisCache();

      await expect(getWhoisHistory("fresh.com", API_KEY, impl, now)).resolves.toBeDefined();
    });
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
