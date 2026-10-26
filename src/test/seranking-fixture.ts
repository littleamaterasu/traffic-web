import type {
  SeRankingAdKeyword,
  SeRankingAdsResponse,
  SeRankingCompetitor,
  SeRankingCompetitorsResponse,
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

const AD_ROWS: SeRankingAdKeyword[] = Array.from({ length: 11 }, (_, index) => ({
  keyword: `từ khóa ${index + 1}`,
  position: index + 1,
  block: index % 2 === 0 ? "top" : "bottom",
  url: `https://acme.com/trang-${index + 1}`,
  snippet_title: `Tiêu đề quảng cáo ${index + 1}`,
  snippet_description: `Mô tả quảng cáo ${index + 1}`,
  snippet_display_url: `acme.com/trang-${index + 1}`,
}));

AD_ROWS[1] = {
  ...AD_ROWS[1],
  url: "acme.com/trang-2",
  snippet_title: "Giày chạy bộ giá tốt - Acme https://www.acme.com",
};

export const serankingAdsFixture: SeRankingAdsResponse = {
  domain: "acme.com",
  source: "us",
  ads: {
    data: AD_ROWS,
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
