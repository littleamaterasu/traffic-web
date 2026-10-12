import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAFFIC_MONTHS,
  getTrafficMonths,
  MAX_TRAFFIC_MONTHS,
  MIN_TRAFFIC_MONTHS,
} from "./config";

describe("traffic months config", () => {
  it("dùng giá trị mặc định khi env chưa được cấu hình", () => {
    expect(getTrafficMonths(undefined)).toBe(DEFAULT_TRAFFIC_MONTHS);
    expect(getTrafficMonths("  ")).toBe(DEFAULT_TRAFFIC_MONTHS);
  });

  it("đọc số tháng hợp lệ từ env", () => {
    expect(getTrafficMonths("6")).toBe(6);
    expect(getTrafficMonths(` ${MAX_TRAFFIC_MONTHS} `)).toBe(MAX_TRAFFIC_MONTHS);
  });

  it.each(["2", "13", "3.5", "abc"])("từ chối giá trị không hợp lệ: %s", (value) => {
    expect(() => getTrafficMonths(value)).toThrow(
      new RegExp(`${MIN_TRAFFIC_MONTHS}.*${MAX_TRAFFIC_MONTHS}`),
    );
  });
});
