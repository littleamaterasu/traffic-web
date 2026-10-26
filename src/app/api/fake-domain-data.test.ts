import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAdDetail } from "@/app/api/ads/detail/route";
import { GET as getAds } from "@/app/api/ads/route";
import { GET as getReferringSites } from "@/app/api/referring-sites/route";
import { GET as getSeRankingAds } from "@/app/api/seranking/ads/route";
import { GET as getSeRankingCompetitors } from "@/app/api/seranking/competitors/route";
import { GET as getTrustpilot } from "@/app/api/trustpilot/route";
import { GET as getWhoisHistory } from "@/app/api/whois/history/route";
import { GET as getWhois } from "@/app/api/whois/route";

const ENV_KEYS = [
  "USE_FAKE_TRAFFIC_DATA",
  "SERPAPI_KEY",
  "TABAPI_KEY",
  "SE_RANKING_API_KEY",
  "WHOIS_API_KEY",
  "TRUSTPILOT_SCRAPER_URL",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  process.env.USE_FAKE_TRAFFIC_DATA = "true";
  for (const key of ENV_KEYS.slice(1)) delete process.env[key];
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("fake data cho toàn bộ báo cáo domain", () => {
  it("trả đủ dữ liệu cho mọi panel mà không cần API key hoặc gọi mạng", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Không được gọi mạng"));

    const adsResponse = await getAds(
      new NextRequest("http://localhost/api/ads?domain=vercel.com"),
    );
    const ads = await adsResponse.json();
    expect(ads.domain).toBe("vercel.com");
    expect(ads.creatives).toHaveLength(6);
    expect(ads.creatives[0].target_domain).toBe("vercel.com");

    const detailResponse = await getAdDetail(
      new NextRequest(
        "http://localhost/api/ads/detail?advertiser_id=AR100000001&creative_id=CR100000001",
      ),
    );
    const detail = await detailResponse.json();
    expect(detail.funded_by).toBeTruthy();
    expect(detail.regions.length).toBeGreaterThan(0);
    expect(detail.items.length).toBeGreaterThan(0);

    const referringResponse = await getReferringSites(
      new NextRequest("http://localhost/api/referring-sites?domain=vercel.com"),
    );
    const referring = await referringResponse.json();
    expect(referring.domain).toBe("vercel.com");
    expect(referring.referring_sites.data.backlinks).toHaveLength(10);
    expect(referring.referring_sites.data.backlinks[0].to_url).toContain("vercel.com");

    const seAdsResponse = await getSeRankingAds(
      new NextRequest("http://localhost/api/seranking/ads?domain=vercel.com"),
    );
    const seAds = await seAdsResponse.json();
    expect(seAds.ads.data).toHaveLength(10);
    expect(seAds.ads.data[0].url).toContain("vercel.com");

    const competitorsResponse = await getSeRankingCompetitors(
      new NextRequest("http://localhost/api/seranking/competitors?domain=vercel.com"),
    );
    const competitors = await competitorsResponse.json();
    expect(competitors.competitors.data).toHaveLength(6);

    const whoisResponse = await getWhois(
      new NextRequest("http://localhost/api/whois?domain=vercel.com"),
    );
    const whois = await whoisResponse.json();
    expect(whois.whois.data.name_servers).toContain("ns1.vercel.com");

    const historyResponse = await getWhoisHistory(
      new NextRequest("http://localhost/api/whois/history?domain=vercel.com"),
    );
    const history = await historyResponse.json();
    expect(history.history.data.events).toHaveLength(6);
    expect(history.history.data.events[0].to).toContain("vercel.com");

    const trustpilotResponse = await getTrustpilot(
      new NextRequest("http://localhost/api/trustpilot?domain=vercel.com"),
    );
    const trustpilot = await trustpilotResponse.json();
    expect(trustpilot.trustpilot.data.profile.target).toBe("vercel.com");
    expect(trustpilot.trustpilot.data.profile.reviews).toHaveLength(5);
    expect(trustpilot.trustpilot.data.profile.business.rating_distribution).toHaveLength(5);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
