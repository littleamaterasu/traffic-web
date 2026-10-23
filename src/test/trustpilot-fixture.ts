import type { TrustpilotResponse } from "@/types/trustpilot";

export const trustpilotUpstreamFixture = {
  success: true,
  target: "acme.com",
  total: 5,
  trustpilot_url: "https://www.trustpilot.com/review/acme.com",
  business: {
    id: "biz-001",
    name: "Acme",
    numberOfReviews: 1234,
    stars: 4.5,
    trustScore: 4.4,
    website: "https://www.acme.com",
  },
  reviews: [
    {
      id: "rev-1",
      author: "Linh Tran",
      heading: "Dịch vụ rất tốt",
      body: "Hỗ trợ nhanh và nhiệt tình.",
      date: "2026-10-23",
      location: "VN",
      rating: 5,
    },
    {
      id: "rev-2",
      author: "John Doe",
      heading: "Good value",
      body: "Works as described.",
      date: "2026-10-22",
      location: "US",
      rating: 4,
    },
    {
      id: "rev-3",
      author: "Mai Le",
      heading: "Tạm ổn",
      body: "Có vài lỗi nhỏ nhưng chấp nhận được.",
      date: "2026-10-20",
      location: "VN",
      rating: 3,
    },
    {
      id: "rev-4",
      author: "Sam Smith",
      heading: "Slow support",
      body: "Waited two days for a reply.",
      date: "2026-10-18",
      location: "GB",
      rating: 2,
    },
    {
      id: "rev-5",
      author: "An Nguyen",
      heading: "Không như kỳ vọng",
      body: "Tính năng thiếu so với quảng cáo.",
      date: "2026-10-15",
      location: "VN",
      rating: 1,
    },
  ],
};

export const trustpilotFixture: TrustpilotResponse = {
  domain: "acme.com",
  trustpilot: {
    data: {
      fetched_at: "2026-10-23T00:00:00.000Z",
      profile: {
        target: "acme.com",
        trustpilot_url: "https://www.trustpilot.com/review/acme.com",
        business: {
          name: "Acme",
          review_count: 1234,
          trust_score: 4.4,
          stars: 4.5,
          website: "https://www.acme.com",
        },
        reviews: [
          {
            id: "rev-1",
            author: "Linh Tran",
            heading: "Dịch vụ rất tốt",
            body: "Hỗ trợ nhanh và nhiệt tình.",
            date: "2026-10-23",
            location: "VN",
            rating: 5,
          },
          {
            id: "rev-2",
            author: "John Doe",
            heading: "Good value",
            body: "Works as described.",
            date: "2026-10-22",
            location: "US",
            rating: 4,
          },
          {
            id: "rev-3",
            author: "Mai Le",
            heading: "Tạm ổn",
            body: "Có vài lỗi nhỏ nhưng chấp nhận được.",
            date: "2026-10-20",
            location: "VN",
            rating: 3,
          },
          {
            id: "rev-4",
            author: "Sam Smith",
            heading: "Slow support",
            body: "Waited two days for a reply.",
            date: "2026-10-18",
            location: "GB",
            rating: 2,
          },
          {
            id: "rev-5",
            author: "An Nguyen",
            heading: "Không như kỳ vọng",
            body: "Tính năng thiếu so với quảng cáo.",
            date: "2026-10-15",
            location: "VN",
            rating: 1,
          },
        ],
      },
    },
    error: null,
  },
};

export const trustpilotEmptyFixture: TrustpilotResponse = {
  domain: "acme.com",
  trustpilot: {
    data: { fetched_at: "2026-10-23T00:00:00.000Z", profile: null },
    error: null,
  },
};
