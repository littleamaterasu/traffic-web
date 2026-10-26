import { describe, expect, it } from "vitest";

import { getFakeTraffic } from "./fake-traffic";

describe("dữ liệu traffic giả", () => {
  it("gắn domain được tìm kiếm vào báo cáo đầy đủ", () => {
    const data = getFakeTraffic("san-pham.vn");

    expect(data.domain).toBe("san-pham.vn");
    expect(data.monthly_visits).toHaveLength(12);
    expect(Object.keys(data.traffic_sources)).toHaveLength(13);
    expect(data.top_keywords).toHaveLength(5);
    expect(data.top_regions).toHaveLength(5);
    expect(data.ai_traffic?.trends).toHaveLength(4);
  });
});
