import { afterEach, describe, expect, it } from "vitest";

import { useFakeTrafficData } from "./config";

const originalUseFakeTrafficData = process.env.USE_FAKE_TRAFFIC_DATA;

afterEach(() => {
  if (originalUseFakeTrafficData === undefined) {
    delete process.env.USE_FAKE_TRAFFIC_DATA;
    return;
  }

  process.env.USE_FAKE_TRAFFIC_DATA = originalUseFakeTrafficData;
});

describe("cấu hình dữ liệu traffic giả", () => {
  it("chỉ bật khi biến môi trường có giá trị true", () => {
    process.env.USE_FAKE_TRAFFIC_DATA = " TRUE ";
    expect(useFakeTrafficData()).toBe(true);

    process.env.USE_FAKE_TRAFFIC_DATA = "false";
    expect(useFakeTrafficData()).toBe(false);
  });
});
