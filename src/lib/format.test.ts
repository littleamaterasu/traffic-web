import { describe, expect, it } from "vitest";
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatDuration, formatMonth, formatNumber, formatPercent } from "./format";

describe("format helpers", () => {
  it("định dạng số và giá trị rỗng", () => {
    expect(formatNumber(1234567)).toMatch(/1[.,]234[.,]567/);
    expect(formatCompactNumber(30173255)).toMatch(/30[,.]2/);
    expect(formatNumber(null)).toBe("—");
  });

  it("định dạng phần trăm, tiền và thời lượng", () => {
    expect(formatPercent(0.3183)).toBe("31.8%");
    expect(formatCurrency(1.1)).toBe("$1.10");
    expect(formatCompactCurrency(2800450)).toMatch(/2[,.]8.*USD/);
    expect(formatDuration(428.87)).toBe("7 phút 09 giây");
  });

  it("định dạng tháng hợp lệ", () => {
    expect(formatMonth("2026-08")).toMatch(/2026/);
    expect(formatMonth("invalid")).toBe("—");
  });
});
