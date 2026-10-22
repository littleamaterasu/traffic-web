export interface SeRankingMetric {
  keywords_count: number | null;
  traffic_sum: number | null;
  price_sum: number | null;
}

export interface SeRankingOverview {
  organic: SeRankingMetric | null;
  paid: SeRankingMetric | null;
}

export interface SeRankingAdKeyword {
  keyword: string | null;
  position: number | null;
  volume: number | null;
  cpc: number | null;
  competition: number | null;
  url: string | null;
  block: string | null;
  block_position: number | null;
  snippet_title: string | null;
  snippet_description: string | null;
  snippet_display_url: string | null;
  traffic: number | null;
  price: number | null;
  difficulty: number | null;
}

export interface SeRankingCompetitor {
  domain: string | null;
  common_keywords: number | null;
  domain_relevance: number | null;
  total_keywords: number | null;
  missing_keywords: number | null;
  traffic_sum: number | null;
  price_sum: number | null;
}

export interface SeRankingAnchor {
  anchor: string;
  backlinks: number | null;
  refdomains: number | null;
}

export interface SeRankingBacklinks {
  target: string | null;
  backlinks: number | null;
  refdomains: number | null;
  dofollow_backlinks: number | null;
  nofollow_backlinks: number | null;
  dofollow_refdomains: number | null;
  domain_inlink_rank: number | null;
  inlink_rank: number | null;
  top_anchors_by_backlinks: SeRankingAnchor[];
  top_anchors_by_refdomains: SeRankingAnchor[];
}

export interface SeRankingSliceError {
  code: string;
  message: string;
}

export interface SeRankingSlice<T> {
  data: T | null;
  error: SeRankingSliceError | null;
}

export interface SeRankingResponse {
  domain: string;
  source: string;
  overview: SeRankingSlice<SeRankingOverview>;
  keywords: SeRankingSlice<SeRankingAdKeyword[]>;
  competitors: SeRankingSlice<SeRankingCompetitor[]>;
}

export interface SeRankingBacklinksResponse {
  domain: string;
  backlinks: SeRankingSlice<SeRankingBacklinks>;
}
