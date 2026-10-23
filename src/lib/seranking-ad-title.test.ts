import { describe, expect, it } from "vitest";
import { cleanAdTitle } from "./seranking-ad-title";

describe("cleanAdTitle", () => {
  it("cắt URL dính liền ở cuối tiêu đề", () => {
    expect(cleanAdTitle("Buy Shoes - Acme https://www.acme.com")).toBe("Buy Shoes - Acme");
  });

  it("cắt phần breadcrumb sau ký tự ›", () => {
    expect(cleanAdTitle("Giày chạy bộ - Acme › giay › chay-bo")).toBe("Giày chạy bộ - Acme");
  });

  it("giữ nguyên tiêu đề sạch", () => {
    expect(cleanAdTitle("Giày chạy bộ giá tốt")).toBe("Giày chạy bộ giá tốt");
  });

  it("trả về chuỗi gốc khi làm sạch xong bị rỗng", () => {
    expect(cleanAdTitle("https://www.acme.com")).toBe("https://www.acme.com");
  });

  it("trả null khi đầu vào null hoặc rỗng", () => {
    expect(cleanAdTitle(null)).toBeNull();
    expect(cleanAdTitle("")).toBeNull();
  });
});
