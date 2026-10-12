import type { TrafficResponse } from "@/types/traffic";

export const trafficFixture: TrafficResponse = {
  domain: "vercel.com",
  title: "Agentic Infrastructure - Vercel",
  description: "The autonomous stack.",
  overview: {
    global_rank: 1379,
    country_rank: { country: "US", rank: 1751 },
    visits: 30173255,
    bounce_rate: 0.3183,
    pages_per_visit: 6.511,
    time_on_site_seconds: 428.87,
    month: "2026-08",
  },
  monthly_visits: [
    { month: "2026-06", visits: 28727146 },
    { month: "2026-07", visits: 30777447 },
    { month: "2026-08", visits: 30173255 },
  ],
  traffic_sources: {
    direct: 0.7092,
    search: 0.1347,
    search_organic: 0.129,
    search_paid: 0.0057,
    social: 0.0452,
    social_organic: 0.0449,
    social_paid: 0.0003,
    referrals: 0.0665,
    paid_referrals: 0.0026,
    mail: 0.0178,
    gen_ai: 0.024,
    affiliate: 0,
    other: 0,
  },
  top_keywords: [
    { name: "vercel", volume: 2802320, cpc: 1.1, estimated_value: 2800450 },
  ],
  top_regions: [
    { country: "US", name: "United States", share: 0.1998 },
  ],
  ai_traffic: {
    trends: [
      {
        name: "chatgpt.com",
        history: [
          { date: "2026-08-01", value: 71.7 },
          { date: "2026-07-01", value: 53.5 },
        ],
      },
    ],
  },
};
