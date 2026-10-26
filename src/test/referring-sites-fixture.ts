import type { ReferringSitesResponse } from "@/types/referring-sites";

const ROW_COUNT = 12;

export const referringSitesUpstreamFixture = {
  domain: "acme.com",
  overview: {
    domain_rating: 93,
    backlinks: 58347754,
    referring_domains: 449624,
    dofollow_backlinks_pct: 91,
    dofollow_referring_domains_pct: 89,
  },
  backlinks: Array.from({ length: ROW_COUNT }, (_, index) => {
    const n = index + 1;
    return {
      from_url: `https://site-${n}.example.com/blog/post-${n}`,
      to_url: `https://acme.com/trang-${n}`,
      title: `Bài viết ${n}`,
      anchor: `anchor ${n}`,
      domain_rating: 90 - n,
      spam_score: 7,
    };
  }),
};

export const referringSitesFixture: ReferringSitesResponse = {
  domain: "acme.com",
  referring_sites: {
    data: {
      fetched_at: "2026-10-26T00:00:00.000Z",
      overview: {
        domain_rating: 93,
        backlinks: 58347754,
        referring_domains: 449624,
        dofollow_backlinks_pct: 91,
        dofollow_referring_domains_pct: 89,
      },
      backlinks: Array.from({ length: ROW_COUNT }, (_, index) => {
        const n = index + 1;
        return {
          from_url: `https://site-${n}.example.com/blog/post-${n}`,
          from_domain: `site-${n}.example.com`,
          to_url: `https://acme.com/trang-${n}`,
          to_path: `/trang-${n}`,
          title: `Bài viết ${n}`,
          anchor: `anchor ${n}`,
          domain_rating: 90 - n,
        };
      }),
    },
    error: null,
  },
};
