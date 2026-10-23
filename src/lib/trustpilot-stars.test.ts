import { describe, expect, it } from "vitest";
import { computeStarFills } from "./trustpilot-stars";

describe("computeStarFills", () => {
  it("làm tròn đến 0,5 gần nhất", () => {
    expect(computeStarFills(4.9)).toEqual([1, 1, 1, 1, 1]);
    expect(computeStarFills(4.3)).toEqual([1, 1, 1, 1, 0.5]);
    expect(computeStarFills(4.2)).toEqual([1, 1, 1, 1, 0]);
    expect(computeStarFills(4.75)).toEqual([1, 1, 1, 1, 1]);
  });

  it("xử lý các giá trị biên", () => {
    expect(computeStarFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(computeStarFills(2.5)).toEqual([1, 1, 0.5, 0, 0]);
    expect(computeStarFills(5)).toEqual([1, 1, 1, 1, 1]);
  });

  it("giới hạn giá trị ngoài khoảng 0 đến 5", () => {
    expect(computeStarFills(7)).toEqual([1, 1, 1, 1, 1]);
    expect(computeStarFills(-3)).toEqual([0, 0, 0, 0, 0]);
  });

  it("trả về mảng rỗng khi đầu vào không hợp lệ", () => {
    expect(computeStarFills(null)).toEqual([]);
    expect(computeStarFills(undefined)).toEqual([]);
    expect(computeStarFills(NaN)).toEqual([]);
    expect(computeStarFills(Infinity)).toEqual([]);
    expect(computeStarFills("4")).toEqual([]);
    expect(computeStarFills({})).toEqual([]);
  });
});
