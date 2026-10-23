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
    expect(computeStarFills(0)).toEqual([]);
    expect(computeStarFills(2.5)).toEqual([1, 1, 0.5, 0, 0]);
    expect(computeStarFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(computeStarFills(0.2)).toEqual([0, 0, 0, 0, 0]);
  });

  it("giới hạn giá trị lớn hơn 5 và bỏ giá trị âm", () => {
    expect(computeStarFills(7)).toEqual([1, 1, 1, 1, 1]);
    expect(computeStarFills(-3)).toEqual([]);
  });

  it("dùng điểm dự phòng khi điểm chính bằng 0, null hoặc không hợp lệ", () => {
    const full = [1, 1, 1, 1, 1];
    expect(computeStarFills(0, 4.9)).toEqual(full);
    expect(computeStarFills(null, 4.9)).toEqual(full);
    expect(computeStarFills(-1, 4.9)).toEqual(full);
    expect(computeStarFills(NaN, 4.9)).toEqual(full);
    expect(computeStarFills(Infinity, 4.3)).toEqual([1, 1, 1, 1, 0.5]);
  });

  it("ưu tiên điểm chính hợp lệ hơn điểm dự phòng", () => {
    expect(computeStarFills(4, 4.9)).toEqual([1, 1, 1, 1, 0]);
  });

  it("trả về mảng rỗng khi cả hai điểm đều không hợp lệ", () => {
    expect(computeStarFills(0, 0)).toEqual([]);
    expect(computeStarFills(null, null)).toEqual([]);
    expect(computeStarFills(null, undefined)).toEqual([]);
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
