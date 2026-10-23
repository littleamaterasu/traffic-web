import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_PROFILE_TTL_MS,
  MAX_CONCURRENT_SCRAPES,
  TrustpilotApiError,
  clearTrustpilotCache,
  fetchTrustpilotProfile,
  getTrustpilotProfile,
  normalizeTrustpilotBody,
} from "@/lib/trustpilot";
import { trustpilotFixture, trustpilotUpstreamFixture } from "@/test/trustpilot-fixture";

const BASE_URL = "http://scraper.test:5000";
const NOW = new Date("2026-10-23T00:00:00.000Z");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function withBusiness(overrides: Record<string, unknown>) {
  return {
    ...trustpilotUpstreamFixture,
    business: { ...trustpilotUpstreamFixture.business, ...overrides },
  };
}

function withReview(overrides: Record<string, unknown>) {
  return {
    ...trustpilotUpstreamFixture,
    reviews: [{ ...trustpilotUpstreamFixture.reviews[0], ...overrides }],
  };
}

function firstReview(body: unknown) {
  return normalizeTrustpilotBody(body, NOW).profile!.reviews[0];
}

function business(body: unknown) {
  return normalizeTrustpilotBody(body, NOW).profile!.business;
}

async function failureOf(promise: Promise<unknown>): Promise<TrustpilotApiError> {
  try {
    await promise;
  } catch (error) {
    return error as TrustpilotApiError;
  }
  throw new Error("Không có lỗi được ném ra");
}

beforeEach(() => clearTrustpilotCache());
afterEach(() => clearTrustpilotCache());

describe("normalizeTrustpilotBody", () => {
  it("chuẩn hóa body scraper hợp lệ thành hồ sơ đã whitelist", () => {
    expect(normalizeTrustpilotBody(trustpilotUpstreamFixture, NOW)).toEqual(
      trustpilotFixture.trustpilot.data,
    );
  });

  it("trả về trạng thái rỗng khi thiếu business hoặc business không hợp lệ", () => {
    const empty = { fetched_at: NOW.toISOString(), profile: null };
    expect(normalizeTrustpilotBody({ success: true }, NOW)).toEqual(empty);
    expect(normalizeTrustpilotBody({ success: true, business: "x" }, NOW)).toEqual(empty);
    expect(normalizeTrustpilotBody({ success: true, business: { name: "   " } }, NOW)).toEqual(empty);
  });

  it("giới hạn trustScore, stars, numberOfReviews và rating", () => {
    expect(business(withBusiness({ trustScore: 7 })).trust_score).toBe(5);
    expect(business(withBusiness({ trustScore: -1 })).trust_score).toBe(0);
    expect(business(withBusiness({ trustScore: "4.9" })).trust_score).toBeNull();
    expect(business(withBusiness({ stars: 9 })).stars).toBe(5);
    expect(business(withBusiness({ stars: -2 })).stars).toBe(0);
    expect(business(withBusiness({ numberOfReviews: -3 })).review_count).toBeNull();
    expect(business(withBusiness({ numberOfReviews: Infinity })).review_count).toBeNull();
    expect(business(withBusiness({ numberOfReviews: "12" })).review_count).toBeNull();
    expect(business(withBusiness({ numberOfReviews: 15255.7 })).review_count).toBe(15255);
    expect(business(withBusiness({ numberOfReviews: 0 })).review_count).toBe(0);
    expect(firstReview(withReview({ rating: 9 })).rating).toBe(5);
    expect(firstReview(withReview({ rating: 0 })).rating).toBeNull();
    expect(firstReview(withReview({ rating: -2 })).rating).toBeNull();
    expect(firstReview(withReview({ rating: NaN })).rating).toBeNull();
    expect(firstReview(withReview({ rating: null })).rating).toBeNull();
    expect(firstReview(withReview({ rating: 3 })).rating).toBe(3);
    expect(firstReview(withReview({ rating: "x" })).rating).toBeNull();
  });

  it("cắt chuỗi theo độ dài tối đa và bỏ chuỗi chỉ có khoảng trắng", () => {
    const review = firstReview(
      withReview({
        heading: ` ${"h".repeat(300)} `,
        body: "b".repeat(3000),
        author: "a".repeat(200),
        location: "l".repeat(50),
      }),
    );
    expect(review.heading).toHaveLength(200);
    expect(review.body).toHaveLength(2000);
    expect(review.author).toHaveLength(100);
    expect(review.location).toHaveLength(20);
    expect(business(withBusiness({ name: "n".repeat(400) })).name).toHaveLength(200);
    expect(firstReview(withReview({ heading: "   ", body: "" })).heading).toBeNull();
    expect(firstReview(withReview({ body: "" })).body).toBeNull();
  });

  it("chuẩn hóa ngày về YYYY-MM-DD hoặc null", () => {
    expect(firstReview(withReview({ date: "2026-10-23T10:00:00Z" })).date).toBe("2026-10-23");
    expect(firstReview(withReview({ date: "yesterday" })).date).toBeNull();
  });

  it("chỉ giữ website và trustpilot_url có scheme http hoặc https", () => {
    for (const unsafe of ["javascript:alert(1)", "//evil.test", "data:text/html,x", "not a url"]) {
      expect(business(withBusiness({ website: unsafe })).website).toBeNull();
      expect(
        normalizeTrustpilotBody({ ...trustpilotUpstreamFixture, trustpilot_url: unsafe }, NOW)
          .profile!.trustpilot_url,
      ).toBeNull();
    }
    expect(business(withBusiness({ website: `https://a.test/${"x".repeat(600)}` })).website).toBeNull();
    expect(business(withBusiness({ website: "http://a.test" })).website).toBe("http://a.test");
  });

  it("chỉ giữ tối đa 5 đánh giá và bỏ phần tử không phải object", () => {
    const base = trustpilotUpstreamFixture.reviews[0];
    const many = {
      ...trustpilotUpstreamFixture,
      reviews: [null, "x", ...Array.from({ length: 8 }, (_, index) => ({ ...base, id: `r${index}` }))],
    };
    const reviews = normalizeTrustpilotBody(many, NOW).profile!.reviews;
    expect(reviews).toHaveLength(5);
    expect(reviews[0].id).toBe("r0");
    const notArray = { ...trustpilotUpstreamFixture, reviews: "oops" };
    expect(normalizeTrustpilotBody(notArray, NOW).profile!.reviews).toEqual([]);
  });

  it("không bao giờ chuyển tiếp trường lạ", () => {
    const body = {
      ...trustpilotUpstreamFixture,
      secret_token: "SENTINEL-TOP",
      business: {
        ...trustpilotUpstreamFixture.business,
        email: "SENTINEL-BIZ",
        extra: { nested: "SENTINEL-NESTED" },
      },
      reviews: [{ ...trustpilotUpstreamFixture.reviews[0], html: "SENTINEL-REVIEW" }],
    };
    expect(JSON.stringify(normalizeTrustpilotBody(body, NOW))).not.toContain("SENTINEL");
  });

  it("chuẩn hóa các trường tùy chọn khi có và bỏ khóa khi không có", () => {
    const absent = business(trustpilotUpstreamFixture);
    for (const key of ["logo_url", "claimed_since", "categories", "rating_distribution"]) {
      expect(key in absent).toBe(false);
    }
    const present = business(
      withBusiness({
        logo_url: "https://cdn.test/logo.png",
        claimed_since: "Aug 2018",
        categories: ["Software", " ", "a".repeat(100), "b", "c", "d", "e"],
        rating_distribution: [
          { stars: 5, percent: 80 },
          { stars: 9, percent: 10 },
          { stars: 1, percent: 140 },
        ],
      }),
    );
    expect(present.logo_url).toBe("https://cdn.test/logo.png");
    expect(present.claimed_since).toBe("Aug 2018");
    expect(present.categories).toHaveLength(5);
    expect(present.categories![1]).toHaveLength(60);
    expect(present.rating_distribution).toEqual([
      { stars: 5, percent: 80 },
      { stars: 1, percent: 100 },
    ]);
    expect("logo_url" in business(withBusiness({ logo_url: "javascript:x" }))).toBe(false);
  });

  it("ném lỗi khi success khác true hoặc body không phải object", () => {
    expect(() => normalizeTrustpilotBody({ success: false }, NOW)).toThrow(TrustpilotApiError);
    expect(() => normalizeTrustpilotBody({ success: false }, NOW)).toThrowError(
      expect.objectContaining({ status: 502, code: "scraper_failed" }),
    );
    expect(() => normalizeTrustpilotBody("text", NOW)).toThrowError(
      expect.objectContaining({ status: 502, code: "invalid_response" }),
    );
    expect(() => normalizeTrustpilotBody(null, NOW)).toThrow(TrustpilotApiError);
  });
});

describe("fetchTrustpilotProfile", () => {
  it("gửi POST cố định tới /api/reviews với body cố định", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    const result = await fetchTrustpilotProfile(
      "acme.com",
      "http://user:pw@scraper.test:5000/some/path?q=1",
      fetchImpl as unknown as typeof fetch,
      NOW,
    );
    expect(result).toEqual(trustpilotFixture.trustpilot.data);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://scraper.test:5000/api/reviews");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ domain: "acme.com", max_pages: 1, limit: 5 });
    expect(init.signal).toBeDefined();
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
  });

  it("từ chối base URL không hợp lệ mà không gọi fetch", async () => {
    for (const base of ["ftp://scraper.test", "not a url", ""]) {
      const fetchImpl = vi.fn();
      const error = await failureOf(
        fetchTrustpilotProfile("acme.com", base, fetchImpl as unknown as typeof fetch, NOW),
      );
      expect(error).toMatchObject({ status: 500, code: "invalid_scraper_url" });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("ánh xạ lỗi mạng sang scraper_unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed scraper.test"));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "scraper_unreachable" });
    expect(error.message).not.toContain("scraper.test");
  });

  it("ánh xạ timeout và abort sang scraper_timeout", async () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      const fetchImpl = vi.fn().mockRejectedValue(new DOMException("x", name));
      const error = await failureOf(
        fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
      );
      expect(error).toMatchObject({ status: 504, code: "scraper_timeout" });
    }
  });

  it("ánh xạ phản hồi non-2xx sang scraper_error mà không lộ nội dung upstream", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret upstream text", { status: 500 }));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "scraper_error" });
    expect(error.message).not.toContain("secret");
    expect(error.message).not.toContain("scraper.test");
  });

  it("ánh xạ body không phải JSON sang invalid_response", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "invalid_response" });
  });

  it("từ chối body JSON hợp lệ vượt 1.000.000 byte và hủy luồng đọc", async () => {
    const cancel = vi.fn();
    const chunk = new TextEncoder().encode(JSON.stringify({ success: true, pad: "x".repeat(600_000) }));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel,
    });
    const fetchImpl = vi.fn(async () => new Response(stream, { status: 200 }));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "response_too_large" });
    expect(cancel).toHaveBeenCalled();
  });

  it("tính theo byte chứ không theo ký tự", async () => {
    const body = JSON.stringify({ success: true, pad: "€".repeat(400_000) });
    expect(body.length).toBeLessThan(1_000_000);
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200 }));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "response_too_large" });
  });

  it("từ chối theo content-length trước khi đọc body", async () => {
    const text = vi.fn(async () => "{}");
    const getReader = vi.fn();
    const fake = {
      ok: true,
      headers: new Headers({ "content-length": "1000001" }),
      body: { getReader, cancel: vi.fn(async () => undefined) },
      text,
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => fake);
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "response_too_large" });
    expect(getReader).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("chấp nhận body ngay dưới ngưỡng", async () => {
    const pad = "x".repeat(900_000);
    const fetchImpl = vi.fn(async () => jsonResponse({ ...trustpilotUpstreamFixture, pad }));
    const result = await fetchTrustpilotProfile(
      "acme.com",
      BASE_URL,
      fetchImpl as unknown as typeof fetch,
      NOW,
    );
    expect(result).toEqual(trustpilotFixture.trustpilot.data);
  });

  it("dùng text() với kiểm tra byte khi response.body là null", async () => {
    const make = (text: string) =>
      ({
        ok: true,
        headers: new Headers(),
        body: null,
        text: async () => text,
      }) as unknown as Response;

    const small = vi.fn(async () => make(JSON.stringify(trustpilotUpstreamFixture)));
    await expect(
      fetchTrustpilotProfile("acme.com", BASE_URL, small as unknown as typeof fetch, NOW),
    ).resolves.toEqual(trustpilotFixture.trustpilot.data);

    const big = vi.fn(async () => make(JSON.stringify({ success: true, pad: "€".repeat(400_000) })));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, big as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "response_too_large" });
  });

  it("ánh xạ success false sang scraper_failed với thông báo tiếng Việt", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, error: "boom" }));
    const error = await failureOf(
      fetchTrustpilotProfile("acme.com", BASE_URL, fetchImpl as unknown as typeof fetch, NOW),
    );
    expect(error).toMatchObject({ status: 502, code: "scraper_failed" });
    expect(error.message).toBe("Không lấy được đánh giá Trustpilot cho tên miền này.");
  });

  it("trả về trạng thái rỗng khi success true nhưng không có business", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, target: "acme.com" }));
    const result = await fetchTrustpilotProfile(
      "acme.com",
      BASE_URL,
      fetchImpl as unknown as typeof fetch,
      NOW,
    );
    expect(result).toEqual({ fetched_at: NOW.toISOString(), profile: null });
  });
});

describe("getTrustpilotProfile", () => {
  it("gộp các lệnh gọi song song và lặp lại thành một lần gọi upstream", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    const impl = fetchImpl as unknown as typeof fetch;
    const [first, second] = await Promise.all([
      getTrustpilotProfile("Acme.com", BASE_URL, impl),
      getTrustpilotProfile("acme.com", BASE_URL, impl),
    ]);
    const third = await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(third).toBe(first);
  });

  it("tách riêng các tên miền khác nhau", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    const impl = fetchImpl as unknown as typeof fetch;
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    await getTrustpilotProfile("other.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("không cache lỗi và cho phép xóa cache", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("down"))
      .mockImplementation(async () => jsonResponse(trustpilotUpstreamFixture));
    const impl = fetchImpl as unknown as typeof fetch;
    await expect(getTrustpilotProfile("acme.com", BASE_URL, impl)).rejects.toBeInstanceOf(
      TrustpilotApiError,
    );
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    clearTrustpilotCache();
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("getTrustpilotProfile hồ sơ rỗng", () => {
  afterEach(() => vi.useRealTimers());

  const emptyFetch = () => vi.fn(async () => jsonResponse({ success: true, business: {} }));

  it("chỉ cache hồ sơ rỗng trong EMPTY_PROFILE_TTL_MS rồi tải lại", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchImpl = emptyFetch();
    const impl = fetchImpl as unknown as typeof fetch;

    const first = await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(first.profile).toBeNull();
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(NOW.getTime() + EMPTY_PROFILE_TTL_MS + 1));
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("vẫn cache dài hạn hồ sơ có dữ liệu", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchImpl = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    const impl = fetchImpl as unknown as typeof fetch;

    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    vi.setSystemTime(new Date(NOW.getTime() + EMPTY_PROFILE_TTL_MS * 2));
    await getTrustpilotProfile("acme.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("chia sẻ kết quả rỗng cho các lệnh gọi song song cùng tên miền", async () => {
    const fetchImpl = emptyFetch();
    const impl = fetchImpl as unknown as typeof fetch;
    const [first, second] = await Promise.all([
      getTrustpilotProfile("acme.com", BASE_URL, impl),
      getTrustpilotProfile("acme.com", BASE_URL, impl),
    ]);
    expect(first.profile).toBeNull();
    expect(second.profile).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("getTrustpilotProfile giới hạn đồng thời", () => {
  function deferredFetch() {
    const resolvers: Array<(response: Response) => void> = [];
    const rejecters: Array<(reason: unknown) => void> = [];
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        }),
    );
    return { fetchImpl, resolvers, rejecters, impl: fetchImpl as unknown as typeof fetch };
  }

  it("từ chối lệnh thứ ba bằng 429 scraper_busy mà không gọi upstream", async () => {
    expect(MAX_CONCURRENT_SCRAPES).toBe(2);
    const { fetchImpl, resolvers, impl } = deferredFetch();
    const first = getTrustpilotProfile("a.com", BASE_URL, impl);
    const second = getTrustpilotProfile("b.com", BASE_URL, impl);
    const error = await failureOf(getTrustpilotProfile("c.com", BASE_URL, impl));
    expect(error).toMatchObject({ status: 429, code: "scraper_busy" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    resolvers.forEach((resolve) => resolve(jsonResponse(trustpilotUpstreamFixture)));
    await Promise.all([first, second]);
  });

  it("giải phóng slot khi thành công và khi thất bại", async () => {
    const { fetchImpl, resolvers, rejecters, impl } = deferredFetch();
    const first = getTrustpilotProfile("a.com", BASE_URL, impl);
    const second = getTrustpilotProfile("b.com", BASE_URL, impl);
    await failureOf(getTrustpilotProfile("c.com", BASE_URL, impl));

    resolvers[0](jsonResponse(trustpilotUpstreamFixture));
    await first;
    const third = getTrustpilotProfile("c.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    rejecters[1](new TypeError("down"));
    await failureOf(second);
    const fourth = getTrustpilotProfile("d.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    resolvers[2](jsonResponse(trustpilotUpstreamFixture));
    resolvers[3](jsonResponse(trustpilotUpstreamFixture));
    await Promise.all([third, fourth]);
  });

  it("giải phóng slot khi timeout", async () => {
    const { fetchImpl, rejecters, impl } = deferredFetch();
    const first = getTrustpilotProfile("a.com", BASE_URL, impl);
    const second = getTrustpilotProfile("b.com", BASE_URL, impl);
    rejecters[0](new DOMException("x", "TimeoutError"));
    expect(await failureOf(first)).toMatchObject({ code: "scraper_timeout" });

    const third = getTrustpilotProfile("c.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    rejecters[1](new TypeError("down"));
    rejecters[2](new TypeError("down"));
    await failureOf(second);
    await failureOf(third);
  });

  it("hai lệnh song song cùng tên miền chỉ gọi fetch một lần và dùng một slot", async () => {
    const { fetchImpl, resolvers, impl } = deferredFetch();
    const sameA = getTrustpilotProfile("a.com", BASE_URL, impl);
    const sameB = getTrustpilotProfile("a.com", BASE_URL, impl);
    const other = getTrustpilotProfile("b.com", BASE_URL, impl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    resolvers.forEach((resolve) => resolve(jsonResponse(trustpilotUpstreamFixture)));
    await Promise.all([sameA, sameB, other]);
  });

  it("không cache lỗi busy nên lần sau gọi lại được upstream", async () => {
    const { resolvers, impl } = deferredFetch();
    const first = getTrustpilotProfile("a.com", BASE_URL, impl);
    const second = getTrustpilotProfile("b.com", BASE_URL, impl);
    await failureOf(getTrustpilotProfile("c.com", BASE_URL, impl));
    resolvers.forEach((resolve) => resolve(jsonResponse(trustpilotUpstreamFixture)));
    await Promise.all([first, second]);

    const ok = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    await getTrustpilotProfile("c.com", BASE_URL, ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("clearTrustpilotCache đặt lại bộ đếm slot", async () => {
    const { impl } = deferredFetch();
    void getTrustpilotProfile("a.com", BASE_URL, impl).catch(() => undefined);
    void getTrustpilotProfile("b.com", BASE_URL, impl).catch(() => undefined);
    clearTrustpilotCache();

    const ok = vi.fn(async () => jsonResponse(trustpilotUpstreamFixture));
    await getTrustpilotProfile("c.com", BASE_URL, ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
