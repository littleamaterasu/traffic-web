import { describe, expect, it } from "vitest";
import type { WhoisHistoryRecordInput, WhoisHistorySummary } from "@/types/whois";
import {
  WHOIS_EVENT_CAP,
  classifyAge,
  classifyPrivacyState,
  compactHistory,
  computeAgeYears,
  detectPrivacy,
  normalizeNameServers,
  summarizeVolatility,
  yearsBetween,
} from "./whois-insights";

const NOW = new Date("2026-10-23T00:00:00Z");

function record(overrides: Partial<WhoisHistoryRecordInput>): WhoisHistoryRecordInput {
  return {
    audit: "2020-01-01T00:00:00Z",
    registrar: "GoDaddy.com, LLC",
    name_servers: ["a.ns.com", "b.ns.com"],
    registrant_organization: "Acme Corp",
    expires_date: "2027-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("yearsBetween", () => {
  it("đúng 1 năm vào ngày kỷ niệm", () => {
    expect(yearsBetween(new Date("2025-10-23"), new Date("2026-10-23"))).toBe(1);
  });

  it("dưới 1 năm một ngày trước ngày kỷ niệm", () => {
    expect(yearsBetween(new Date("2025-10-24"), new Date("2026-10-23"))).toBeLessThan(1);
  });
});

describe("computeAgeYears", () => {
  it("dùng createdDate khi có", () => {
    const years = computeAgeYears("2017-01-11T00:00:00Z", 3571, NOW);
    expect(years).toBeGreaterThan(9.7);
    expect(years).toBeLessThan(9.9);
  });

  it("dùng estimatedDomainAge khi thiếu createdDate", () => {
    expect(computeAgeYears(null, 365.25 * 5, NOW)).toBeCloseTo(5, 5);
  });

  it("trả về null khi thiếu hoặc không hợp lệ", () => {
    expect(computeAgeYears(null, null, NOW)).toBeNull();
    expect(computeAgeYears("abc", null, NOW)).toBeNull();
  });

  it("trả về null khi ngày tạo nằm trong tương lai", () => {
    expect(computeAgeYears("2030-01-01", 100, NOW)).toBeNull();
  });
});

describe("classifyAge", () => {
  it("classifyAge 0.99 là rất mới", () => {
    expect(classifyAge(0.99)?.level).toBe("very_new");
  });

  it("classifyAge 1 là còn mới", () => {
    expect(classifyAge(1)?.level).toBe("new");
  });

  it("classifyAge 3 vẫn là còn mới (gồm cả 3)", () => {
    expect(classifyAge(3)?.level).toBe("new");
  });

  it("classifyAge 3.01 là lâu năm", () => {
    const verdict = classifyAge(3.01);
    expect(verdict?.level).toBe("established");
    expect(verdict?.label).toContain("lâu năm");
  });

  it("classifyAge null trả về null", () => {
    expect(classifyAge(null)).toBeNull();
  });
});

describe("detectPrivacy", () => {
  it("nhận diện dịch vụ ẩn thông tin", () => {
    expect(detectPrivacy("Domains By Proxy, LLC")).toBe(true);
    expect(detectPrivacy("REDACTED FOR PRIVACY")).toBe(true);
    expect(detectPrivacy("WhoisGuard Protected")).toBe(true);
    expect(detectPrivacy("Contact Privacy Inc.")).toBe(true);
  });

  it("không đánh dấu tổ chức thông thường", () => {
    expect(detectPrivacy("Acme Corp")).toBe(false);
  });

  it("trả về null khi không có văn bản", () => {
    expect(detectPrivacy(null, null)).toBeNull();
    expect(detectPrivacy("", "")).toBeNull();
  });

  it("dùng tên khi tổ chức trống", () => {
    expect(detectPrivacy("", "Registration Private proxy")).toBe(true);
  });
});

describe("normalizeNameServers", () => {
  it("tách, chuẩn hóa, loại trùng và sắp xếp", () => {
    expect(normalizeNameServers(["A.NS.com|b.ns.com", "a.ns.com.", " "])).toEqual([
      "a.ns.com",
      "b.ns.com",
    ]);
  });

  it("trả về mảng rỗng khi không phải mảng", () => {
    expect(normalizeNameServers(undefined)).toEqual([]);
    expect(normalizeNameServers("a.ns.com")).toEqual([]);
  });
});

describe("compactHistory", () => {
  it("lịch sử rỗng cho tóm tắt rỗng", () => {
    const result = compactHistory([]);
    expect(result.summary).toEqual({
      records: 0,
      first_seen: null,
      changes_total: 0,
      registrar_changes: 0,
      nameserver_changes: 0,
      privacy_changes: 0,
    });
    expect(result.events).toEqual([]);
    expect(result.events_truncated).toBe(false);
  });

  it("một bản ghi không sinh sự kiện", () => {
    const result = compactHistory([record({})]);
    expect(result.summary.records).toBe(1);
    expect(result.events).toEqual([]);
  });

  it("các bản ghi giống nhau liên tiếp không sinh sự kiện", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01" }),
      record({ audit: "2021-01-01" }),
      record({ audit: "2022-01-01" }),
    ]);
    expect(result.summary.records).toBe(3);
    expect(result.events).toEqual([]);
  });

  it("đổi nhà đăng ký sinh một sự kiện với ngày của bản ghi sau", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01" }),
      record({ audit: "2021-01-01", registrar: "Namecheap, Inc." }),
    ]);
    expect(result.events).toEqual([
      { date: "2021-01-01", field: "registrar", from: "GoDaddy.com, LLC", to: "Namecheap, Inc." },
    ]);
    expect(result.summary.registrar_changes).toBe(1);
  });

  it("đổi tập name server sinh sự kiện, khác dạng pipe thì không", () => {
    const changed = compactHistory([
      record({ audit: "2020-01-01" }),
      record({ audit: "2021-01-01", name_servers: ["c.ns.com"] }),
    ]);
    expect(changed.events).toEqual([
      { date: "2021-01-01", field: "name_servers", from: "a.ns.com, b.ns.com", to: "c.ns.com" },
    ]);
    const same = compactHistory([
      record({ audit: "2020-01-01" }),
      record({ audit: "2021-01-01", name_servers: ["B.ns.com|a.ns.com"] }),
    ]);
    expect(same.events).toEqual([]);
  });

  it("khác biệt chỉ về hoa thường của nhà đăng ký không sinh sự kiện", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01", registrar: "GODADDY.COM, LLC" }),
      record({ audit: "2021-01-01", registrar: "GoDaddy.com, LLC" }),
    ]);
    expect(result.events).toEqual([]);
    expect(result.summary.changes_total).toBe(0);
  });

  it("đổi nhà đăng ký thật lấy giá trị gốc gần nhất làm from", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01", registrar: "GODADDY.COM, LLC" }),
      record({ audit: "2021-01-01", registrar: "GoDaddy.com, LLC" }),
      record({ audit: "2022-01-01", registrar: "Namecheap, Inc." }),
    ]);
    expect(result.events).toEqual([
      { date: "2022-01-01", field: "registrar", from: "GoDaddy.com, LLC", to: "Namecheap, Inc." },
    ]);
  });

  it("classifyPrivacyState phân loại ẩn, công khai và không rõ", () => {
    expect(classifyPrivacyState("Domains By Proxy, LLC")).toBe("private");
    expect(classifyPrivacyState("REDACTED FOR PRIVACY")).toBe("private");
    expect(classifyPrivacyState("******** ********")).toBe("private");
    expect(classifyPrivacyState("Jeff Smith")).toBe("public");
    expect(classifyPrivacyState("Registrant State/Province: New York")).toBe("public");
    expect(classifyPrivacyState(null)).toBe("unknown");
    expect(classifyPrivacyState("")).toBe("unknown");
    expect(classifyPrivacyState("   ")).toBe("unknown");
  });

  it("sự kiện quyền riêng tư chỉ khi chuyển trạng thái đã biết, null không phát sinh", () => {
    const orgs = ["Jeff Smith", null, "REDACTED FOR PRIVACY", null, "REDACTED FOR PRIVACY", "Jeff Smith"];
    const result = compactHistory(
      orgs.map((organization, index) =>
        record({ audit: `${2020 + index}-01-01`, registrant_organization: organization }),
      ),
    );
    expect(result.events.map((event) => [event.field, event.from, event.to])).toEqual([
      ["privacy", "private", "public"],
      ["privacy", "public", "private"],
    ]);
    expect(result.summary.privacy_changes).toBe(2);
  });

  it("gia hạn hết hạn không sinh sự kiện và không tính vào tổng", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01", expires_date: "2019-03-01" }),
      record({ audit: "2021-01-01", expires_date: "2020-03-01" }),
      record({ audit: "2022-01-01", expires_date: "2035-03-01" }),
    ]);
    expect(result.events).toEqual([]);
    expect(result.summary.changes_total).toBe(0);
  });

  it("mẫu thực tế: nhiễu hoa thường, null, gia hạn không làm tăng thay đổi", () => {
    const rows: Array<Partial<WhoisHistoryRecordInput>> = [
      { registrar: "GoDaddy.com, LLC", registrant_organization: "Jeff Smith", expires_date: "2019-01-01" },
      { registrar: "GODADDY.COM, LLC", registrant_organization: null, expires_date: "2020-01-01" },
      { registrar: "GoDaddy.com, LLC", registrant_organization: "Domains By Proxy, LLC", expires_date: "2021-01-01" },
      { registrar: "GODADDY.COM, LLC", registrant_organization: null, expires_date: "2022-01-01" },
      { registrar: "GoDaddy.com, LLC", registrant_organization: "Domains By Proxy, LLC", expires_date: "2023-01-01" },
      {
        registrar: "GODADDY.COM, LLC",
        registrant_organization: "Registrant State/Province: New York",
        name_servers: ["x.domaincontrol.com"],
        expires_date: "2024-01-01",
      },
      {
        registrar: "GoDaddy.com, LLC",
        registrant_organization: "REDACTED FOR PRIVACY",
        name_servers: ["x.cloudflare.com"],
        expires_date: "2035-01-01",
      },
    ];
    const result = compactHistory(
      rows.map((row, index) =>
        record({ name_servers: ["x.domaincontrol.com"], audit: `${2018 + index}-06-01`, ...row }),
      ),
    );
    expect(result.summary).toMatchObject({
      records: 7,
      registrar_changes: 0,
      nameserver_changes: 1,
      privacy_changes: 3,
      changes_total: 4,
    });
    expect(
      result.events.every((event) => ["registrar", "name_servers", "privacy"].includes(event.field)),
    ).toBe(true);
  });

  it("không để lộ văn bản chủ sở hữu trong kết quả", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01", registrant_organization: "Jeff Smith" }),
      record({ audit: "2021-01-01", registrant_organization: "REDACTED FOR PRIVACY" }),
      record({ audit: "2022-01-01", registrant_organization: "Registrant State/Province: New York" }),
    ]);
    const json = JSON.stringify(result);
    expect(json).not.toContain("Jeff");
    expect(json).not.toContain("Smith");
    expect(json).not.toContain("New York");
    expect(json).not.toContain("Registrant State");
  });

  it("giá trị rỗng được bỏ qua và giữ giá trị đã biết trước đó", () => {
    const result = compactHistory([
      record({ audit: "2020-01-01" }),
      record({ audit: "2021-01-01", registrar: null, name_servers: [], expires_date: null }),
      record({ audit: "2022-01-01" }),
    ]);
    expect(result.events).toEqual([]);
  });

  it("sắp xếp theo audit tăng dần và bỏ bản ghi không có audit hợp lệ", () => {
    const result = compactHistory([
      record({ audit: "2021-01-01", registrar: "Namecheap, Inc." }),
      record({ audit: null }),
      record({ audit: "invalid" }),
      record({ audit: "2020-01-01" }),
    ]);
    expect(result.summary.records).toBe(2);
    expect(result.summary.first_seen).toBe("2020-01-01");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].from).toBe("GoDaddy.com, LLC");
  });

  it("giới hạn số sự kiện nhưng tóm tắt đếm đủ", () => {
    const records = Array.from({ length: WHOIS_EVENT_CAP + 6 }, (_, index) =>
      record({
        audit: new Date(Date.UTC(2000 + index, 0, 1)).toISOString(),
        registrar: `Registrar ${index}`,
      }),
    );
    const result = compactHistory(records);
    expect(result.events).toHaveLength(WHOIS_EVENT_CAP);
    expect(result.events_truncated).toBe(true);
    expect(result.summary.registrar_changes).toBe(WHOIS_EVENT_CAP + 5);
    expect(result.summary.changes_total).toBe(WHOIS_EVENT_CAP + 5);
    expect(Date.parse(result.events[0].date)).toBeGreaterThan(Date.parse(result.events[1].date));
  });
});

describe("summarizeVolatility", () => {
  const base: WhoisHistorySummary = {
    records: 0,
    first_seen: null,
    changes_total: 0,
    registrar_changes: 0,
    nameserver_changes: 0,
    privacy_changes: 0,
  };

  it("không có bản ghi thì không khẳng định ổn định", () => {
    const text = summarizeVolatility(base);
    expect(text).toContain("chưa có lịch sử");
    expect(text).not.toContain("ổn định");
  });

  it("một bản ghi thì nói chưa đủ dữ liệu", () => {
    const text = summarizeVolatility({ ...base, records: 1, first_seen: "2020-01-01" });
    expect(text).toContain("chưa đủ dữ liệu");
    expect(text).not.toContain("ổn định");
  });

  it("nhiều bản ghi không thay đổi thì ổn định", () => {
    const text = summarizeVolatility({ ...base, records: 5, first_seen: "2018-05-02" });
    expect(text).toContain("ổn định");
    expect(text).toContain("02/05/2018");
    expect(text).toContain("5");
  });

  it("1 đến 3 thay đổi là một vài thay đổi", () => {
    const text = summarizeVolatility({ ...base, records: 5, first_seen: "2018-05-02", changes_total: 3 });
    expect(text).toContain("một vài thay đổi");
  });

  it("từ 4 thay đổi là thay đổi nhiều", () => {
    const text = summarizeVolatility({ ...base, records: 9, first_seen: "2018-05-02", changes_total: 4 });
    expect(text).toContain("thay đổi nhiều");
    expect(text).toContain("thay đổi đăng ký (nhà đăng ký, name server, quyền riêng tư)");
    expect(text).not.toContain("hết hạn");
  });
});
