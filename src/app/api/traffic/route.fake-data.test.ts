import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const originalApiKey = process.env.TABAPI_KEY;
const originalUseFakeTrafficData = process.env.USE_FAKE_TRAFFIC_DATA;

afterEach(() => {
  vi.restoreAllMocks();

  if (originalApiKey === undefined) {
    delete process.env.TABAPI_KEY;
  } else {
    process.env.TABAPI_KEY = originalApiKey;
  }

  if (originalUseFakeTrafficData === undefined) {
    delete process.env.USE_FAKE_TRAFFIC_DATA;
  } else {
    process.env.USE_FAKE_TRAFFIC_DATA = originalUseFakeTrafficData;
  }
});

describe("GET /api/traffic với dữ liệu giả", () => {
  it("không cần API key và không gọi TabAPI", async () => {
    process.env.USE_FAKE_TRAFFIC_DATA = "true";
    delete process.env.TABAPI_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await GET(
      new NextRequest("http://localhost/api/traffic?domain=thu-nghiem.vn"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.domain).toBe("thu-nghiem.vn");
    expect(body.monthly_visits).toHaveLength(12);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
