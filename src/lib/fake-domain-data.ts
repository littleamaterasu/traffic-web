import fakeDomainData from "@/data/fake-domain-data.json";
import type { AdCreative, AdDetail, AdsResponse } from "@/types/ads";
import type { ReferringSitesResponse } from "@/types/referring-sites";
import type { SeRankingAdsResponse, SeRankingCompetitorsResponse } from "@/types/seranking";
import type { TrustpilotProfile, TrustpilotResponse } from "@/types/trustpilot";
import type { WhoisHistoryResponse, WhoisResponse } from "@/types/whois";

function withDomain(value: string | null, domain: string): string | null {
  return value?.replaceAll("example.com", domain) ?? null;
}

export function getFakeAds(domain: string): AdsResponse {
  return {
    domain,
    total_results: fakeDomainData.ads.total_results,
    creatives: fakeDomainData.ads.creatives.map((creative) => ({
      ...creative,
      target_domain: domain,
      image: withDomain(creative.image, domain),
    })) as AdCreative[],
    next_page_token: null,
  };
}

export function getFakeAdDetail(advertiserId: string, creativeId: string): AdDetail {
  const detail = fakeDomainData.ads.details.find(
    (item) => item.advertiser_id === advertiserId && item.creative_id === creativeId,
  ) ?? fakeDomainData.ads.details[0];

  return {
    ...detail,
    advertiser_id: advertiserId,
    creative_id: creativeId,
  } as AdDetail;
}

export function getFakeReferringSites(domain: string): ReferringSitesResponse {
  return {
    domain,
    referring_sites: {
      data: {
        ...fakeDomainData.referring_sites,
        backlinks: fakeDomainData.referring_sites.backlinks.map((backlink) => ({
          ...backlink,
          to_url: withDomain(backlink.to_url, domain),
        })),
      },
      error: null,
    },
  };
}

export function getFakeSeRankingAds(domain: string, source: string): SeRankingAdsResponse {
  return {
    domain,
    source,
    ads: {
      data: fakeDomainData.seranking.ads.map((ad) => ({
        ...ad,
        url: withDomain(ad.url, domain),
        snippet_display_url: withDomain(ad.snippet_display_url, domain),
      })) as SeRankingAdsResponse["ads"]["data"],
      error: null,
    },
  };
}

export function getFakeSeRankingCompetitors(
  domain: string,
  source: string,
): SeRankingCompetitorsResponse {
  return {
    domain,
    source,
    competitors: {
      data: fakeDomainData.seranking.competitors,
      error: null,
    },
  };
}

export function getFakeWhois(domain: string): WhoisResponse {
  return {
    domain,
    whois: {
      data: {
        ...fakeDomainData.whois,
        name_servers: fakeDomainData.whois.name_servers.map((item) => withDomain(item, domain) as string),
      } as WhoisResponse["whois"]["data"],
      error: null,
    },
  };
}

export function getFakeWhoisHistory(domain: string): WhoisHistoryResponse {
  return {
    domain,
    history: {
      data: {
        ...fakeDomainData.whois_history,
        events: fakeDomainData.whois_history.events.map((event) => ({
          ...event,
          from: withDomain(event.from, domain),
          to: withDomain(event.to, domain),
        })),
      } as WhoisHistoryResponse["history"]["data"],
      error: null,
    },
  };
}

export function getFakeTrustpilot(domain: string): TrustpilotResponse {
  const profile = fakeDomainData.trustpilot.profile;
  return {
    domain,
    trustpilot: {
      data: {
        fetched_at: fakeDomainData.trustpilot.fetched_at,
        profile: {
          ...profile,
          target: domain,
          trustpilot_url: withDomain(profile.trustpilot_url, domain),
          business: {
            ...profile.business,
            name: domain,
            website: withDomain(profile.business.website, domain),
          },
        } as TrustpilotProfile,
      },
      error: null,
    },
  };
}
