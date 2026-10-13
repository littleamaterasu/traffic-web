import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdsApiError, clearAdsCache, fetchAdDetailFromSerpApi, fetchAdsFromSerpApi, getAds } from "./ads-transparency";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const serpFixture = {
  search_information: { total_results: 2 },
  ad_creatives: [
    {
      advertiser_id: "AR1",
      advertiser: "Acme Ltd",
      ad_creative_id: "CR1",
      format: "image",
      link: "https://example.com/preview",
      details_link: "https://adstransparency.google.com/advertiser/AR1/creative/CR1",
      total_days_shown: 12,
      first_shown: 1735689600,
      last_shown: 1736553600,
    },
  ],
};

describe("Ads Transparency client", () => {
  beforeEach(() => clearAdsCache());

  it("gọi đúng engine và chuẩn hóa creative", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serpFixture));

    const result = await fetchAdsFromSerpApi("acme.com", "key", null, fetchMock as unknown as typeof fetch);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("engine")).toBe("google_ads_transparency_center");
    expect(url.searchParams.get("text")).toBe("acme.com");
    expect(result.total_results).toBe(2);
    expect(result.creatives[0]).toMatchObject({
      advertiser: "Acme Ltd",
      format: "image",
      first_shown: "2025-01-01",
      last_shown: "2025-01-11",
    });
  });

  it("coi 'không có kết quả' là danh sách rỗng", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Google Ads Transparency Center hasn't returned any results for this query." }),
    );

    const result = await fetchAdsFromSerpApi("acme.com", "key", null, fetchMock as unknown as typeof fetch);

    expect(result.creatives).toEqual([]);
  });

  it("gửi next_page_token, trả token kế tiếp và tách cache theo trang", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({ ...serpFixture, serpapi_pagination: { next_page_token: "tok2" } }),
    );

    const first = await getAds("acme.com", "key", null, fetchMock as unknown as typeof fetch);
    await getAds("acme.com", "key", "tok1", fetchMock as unknown as typeof fetch);

    expect(first.next_page_token).toBe("tok2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("next_page_token")).toBe(false);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("next_page_token")).toBe("tok1");
  });

  it("lấy ảnh tĩnh của creative", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ad_creatives: [{ ad_creative_id: "CR9", format: "text", image: "https://img/x.png", width: 356, height: 213 }],
      }),
    );

    const result = await fetchAdsFromSerpApi("acme.com", "key", null, fetchMock as unknown as typeof fetch);

    expect(result.creatives[0]).toMatchObject({ image: "https://img/x.png", width: 356, height: 213 });
  });

  it("chuẩn hóa chi tiết creative: sản phẩm và thị trường", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        search_information: {
          ad_funded_by: "Acme Ltd",
          regions: [{ region_name: "United States", last_shown: 20261013 }],
        },
        ad_creatives: [{ snippet: "Sock, Grey, Size M", image: "https://img/p.jpg" }],
      }),
    );

    const detail = await fetchAdDetailFromSerpApi("AR1", "CR1", "key", fetchMock as unknown as typeof fetch);

    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("engine")).toBe(
      "google_ads_transparency_center_ad_details",
    );
    expect(detail).toMatchObject({
      funded_by: "Acme Ltd",
      regions: [{ name: "United States", last_shown: "2026-10-13" }],
      items: [{ snippet: "Sock, Grey, Size M", image: "https://img/p.jpg" }],
    });
  });

  it("cache theo domain và không cache lỗi", async () => {
    const ok = vi.fn().mockResolvedValue(jsonResponse(serpFixture));
    await getAds("acme.com", "key", null, ok as unknown as typeof fetch);
    await getAds("acme.com", "key", null, ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(1);

    const fail = vi.fn().mockResolvedValue(jsonResponse({ error: "Invalid API key" }, 401));
    await expect(getAds("b.com", "key", null, fail as unknown as typeof fetch)).rejects.toBeInstanceOf(AdsApiError);
    await expect(getAds("b.com", "key", null, fail as unknown as typeof fetch)).rejects.toMatchObject({ status: 401 });
    expect(fail).toHaveBeenCalledTimes(2);
  });
});
