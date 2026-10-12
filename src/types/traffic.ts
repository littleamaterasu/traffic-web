export type NullableMetric = number | null;

export interface CountryRank {
  country: string;
  rank: number;
}

export interface TrafficOverview {
  global_rank: NullableMetric;
  country_rank: CountryRank | null;
  visits: NullableMetric;
  bounce_rate: NullableMetric;
  pages_per_visit: NullableMetric;
  time_on_site_seconds: NullableMetric;
  month: string | null;
}

export interface MonthlyVisit {
  month: string;
  visits: number;
}

export interface TrafficSources {
  direct: NullableMetric;
  search: NullableMetric;
  search_organic: NullableMetric;
  search_paid: NullableMetric;
  social: NullableMetric;
  social_organic: NullableMetric;
  social_paid: NullableMetric;
  referrals: NullableMetric;
  paid_referrals: NullableMetric;
  mail: NullableMetric;
  gen_ai: NullableMetric;
  affiliate: NullableMetric;
  other: NullableMetric;
}

export interface TopKeyword {
  name: string;
  volume: number;
  cpc: number;
  estimated_value: number;
}

export interface TopRegion {
  country: string;
  name: string;
  share: number;
}

export interface AiHistoryPoint {
  date: string;
  value: number;
}

export interface AiTrend {
  name: string;
  history: AiHistoryPoint[];
}

export interface AiTraffic {
  trends: AiTrend[];
}

export interface TrafficResponse {
  domain: string;
  title: string | null;
  description: string | null;
  overview: TrafficOverview;
  monthly_visits: MonthlyVisit[];
  traffic_sources: TrafficSources;
  top_keywords: TopKeyword[];
  top_regions: TopRegion[];
  ai_traffic: AiTraffic | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
