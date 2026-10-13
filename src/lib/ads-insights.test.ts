import { describe, expect, it } from "vitest";
import {
  getTimelineBar,
  getTimelineRange,
  groupByAdvertiser,
  isActive,
  isLongRunning,
  summarizeAds,
} from "./ads-insights";
import type { AdCreative } from "@/types/ads";

function creative(overrides: Partial<AdCreative>): AdCreative {
  return {
    advertiser_id: "AR1",
    advertiser: "Acme",
    ad_creative_id: "CR1",
    format: "image",
    target_domain: null,
    image: null,
    width: null,
    height: null,
    preview_link: null,
    details_link: null,
    total_days_shown: 10,
    first_shown: "2025-01-01",
    last_shown: "2025-01-10",
    ...overrides,
  };
}

const now = Date.parse("2025-01-12");

describe("ads insights", () => {
  it("xác định creative đang chạy trong cửa sổ 7 ngày", () => {
    expect(isActive(creative({ last_shown: "2025-01-10" }), now)).toBe(true);
    expect(isActive(creative({ last_shown: "2024-12-01" }), now)).toBe(false);
    expect(isActive(creative({ last_shown: null }), now)).toBe(false);
  });

  it("đánh dấu creative chạy lâu từ 30 ngày", () => {
    expect(isLongRunning(creative({ total_days_shown: 30 }))).toBe(true);
    expect(isLongRunning(creative({ total_days_shown: 29 }))).toBe(false);
    expect(isLongRunning(creative({ total_days_shown: null }))).toBe(false);
  });

  it("tóm tắt số nhà quảng cáo, đang chạy, định dạng và creative lâu nhất", () => {
    const list = [
      creative({ ad_creative_id: "CR1", total_days_shown: 5 }),
      creative({ ad_creative_id: "CR2", advertiser_id: "AR2", advertiser: "Beta", format: "video", total_days_shown: 40, last_shown: "2024-11-01" }),
    ];

    const summary = summarizeAds(list, now);

    expect(summary).toMatchObject({ advertisers: 2, creatives: 2, active: 1, formats: { image: 1, video: 1 } });
    expect(summary.longest?.ad_creative_id).toBe("CR2");
  });

  it("gom theo nhà quảng cáo và sắp xếp theo số creative", () => {
    const list = [
      creative({ ad_creative_id: "CR1" }),
      creative({ ad_creative_id: "CR2", last_shown: "2025-01-11" }),
      creative({ ad_creative_id: "CR3", advertiser_id: "AR2", advertiser: "Beta" }),
    ];

    const groups = groupByAdvertiser(list, now);

    expect(groups.map((group) => group.name)).toEqual(["Acme", "Beta"]);
    expect(groups[0]).toMatchObject({ count: 2, active: 2, totalDays: 20, lastShown: "2025-01-11" });
  });

  it("tính vị trí thanh timeline trong khoảng thời gian chung", () => {
    const a = creative({ first_shown: "2025-01-01", last_shown: "2025-01-10" });
    const b = creative({ first_shown: "2025-01-06", last_shown: "2025-01-10" });
    const range = getTimelineRange([a, b]);

    expect(range).not.toBeNull();
    expect(getTimelineBar(a, range!)).toEqual({ left: 0, width: 100 });
    expect(getTimelineBar(b, range!)).toEqual({ left: 50, width: 50 });
    expect(getTimelineBar(creative({ first_shown: null }), range!)).toBeNull();
  });

  it("trả về null khi không creative nào có ngày", () => {
    expect(getTimelineRange([creative({ first_shown: null })])).toBeNull();
  });
});
