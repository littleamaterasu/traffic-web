import type {
  SeRankingBacklinksResponse,
  SeRankingCompetitor,
  SeRankingCompetitorsResponse,
  SeRankingResponse,
} from "@/types/seranking";

const COMPETITOR_ROWS: SeRankingCompetitor[] = [
  {
    domain: "rival-one.com",
    common_keywords: 120,
    domain_relevance: 85,
    total_keywords: 400,
    missing_keywords: 40,
    traffic_sum: 45678,
    price_sum: 1234.5,
  },
  {
    domain: "rival-two.com",
    common_keywords: 60,
    domain_relevance: 70,
    total_keywords: 300,
    missing_keywords: 25,
    traffic_sum: 12345,
    price_sum: 567.8,
  },
];

export const serankingFixture: SeRankingResponse = {
  domain: "acme.com",
  source: "us",
  overview: {
    data: {
      organic: { keywords_count: 534575, traffic_sum: 531195, price_sum: 274754.56 },
      paid: { keywords_count: 335, traffic_sum: 2916, price_sum: 658.06 },
    },
    error: null,
  },
};

export const serankingCompetitorsFixture: SeRankingCompetitorsResponse = {
  domain: "acme.com",
  source: "us",
  competitors: {
    data: COMPETITOR_ROWS,
    error: null,
  },
};

export const serankingBacklinksFixture: SeRankingBacklinksResponse = {
  domain: "acme.com",
  backlinks: {
    data: {
      target: "acme.com",
      backlinks: 1000,
      refdomains: 150,
      dofollow_backlinks: 750,
      nofollow_backlinks: 250,
      dofollow_refdomains: 120,
      domain_inlink_rank: 87.5,
      inlink_rank: 89.1,
      top_anchors_by_backlinks: [
        { anchor: "click here", backlinks: 400, refdomains: 60 },
        { anchor: "acme", backlinks: 250, refdomains: 45 },
      ],
      top_anchors_by_refdomains: [{ anchor: "read more", backlinks: null, refdomains: 30 }],
    },
    error: null,
  },
};
