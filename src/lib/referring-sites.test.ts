import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReferringSitesApiError,
  clearReferringSitesCache,
  fetchReferringSites,
  getReferringSites,
  isEmptyReferringSites,
  normalizeReferringSitesBody,
} from "./referring-sites";
import {
  referringSitesFixture,
  referringSitesUpstreamFixture,
} from "@/test/referring-sites-fixture";

const KEY = "test-key-123";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function mockFetch(factory: () => Response | Promise<Response>) {
  return vi.fn(async () => factory());
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch;
}

async function catchError(promise: Promise<unknown>): Promise<ReferringSitesApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ReferringSitesApiError);
    return error as ReferringSitesApiError;
  }
  throw new Error("expected rejection");
}

beforeEach(() => {
  clearReferringSitesCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchReferringSites", () => {
  it("gọi đúng endpoint TabAPI với header và tùy chọn an toàn", async () => {
    const fetchMock = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    await fetchReferringSites("acme.com", KEY, asFetch(fetchMock));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://tabapi.com/api/v1/domains/acme.com/backlinks");
    expect(init.headers).toEqual({
      Accept: "application/json",
      Authorization: `Bearer ${KEY}`,
    });
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("mã hóa phần trăm tên miền độc hại trong đường dẫn", async () => {
    const fetchMock = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    await fetchReferringSites("a.com/../x", KEY, asFetch(fetchMock));
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://tabapi.com/api/v1/domains/a.com%2F..%2Fx/backlinks");
  });

  it("chuẩn hóa kết quả theo danh sách trường cho phép và loại trường lạ", async () => {
    const fetchMock = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    const result = await fetchReferringSites("acme.com", KEY, asFetch(fetchMock));

    expect(result.overview).toEqual(referringSitesFixture.referring_sites.data?.overview);
    expect(result.backlinks).toEqual(referringSitesFixture.referring_sites.data?.backlinks);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("spam_score");
    expect(serialized).not.toContain(KEY);
  });

  it.each([
    [400, 400, "invalid_domain"],
    [401, 401, "invalid_api_key"],
    [403, 401, "invalid_api_key"],
    [402, 402, "insufficient_credits"],
    [429, 429, "rate_limited"],
    [500, 502, "upstream_error"],
    [404, 502, "upstream_error"],
  ])("ánh xạ trạng thái upstream %i sang %i %s với thông báo tiếng Việt", async (upstream, status, code) => {
    const fetchMock = mockFetch(() =>
      jsonResponse({ error: { message: `secret ${KEY} leak` } }, { status: upstream }),
    );
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toMatch(/[ạảãàáâăđêôơưọệịộụ]|TabAPI|Tên miền/);
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain("secret");
  });

  it("báo network_error khi fetch bị từ chối", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError(`failed with ${KEY}`);
    });
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.status).toBe(502);
    expect(error.code).toBe("network_error");
    expect(error.message).not.toContain(KEY);
  });

  it("báo timeout khi fetch bị hủy do quá hạn", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.status).toBe(504);
    expect(error.code).toBe("timeout");
  });

  it("từ chối phản hồi khai báo content-length quá lớn", async () => {
    const fetchMock = mockFetch(
      () =>
        new Response("{}", {
          status: 200,
          headers: { "content-length": "1000001" },
        }),
    );
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.status).toBe(502);
    expect(error.code).toBe("response_too_large");
  });

  it("từ chối phản hồi streaming vượt giới hạn khi không có content-length", async () => {
    const chunk = new Uint8Array(600_000).fill(97);
    const fetchMock = mockFetch(() => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.code).toBe("response_too_large");
  });

  it("báo invalid_response khi JSON không hợp lệ", async () => {
    const fetchMock = mockFetch(() => new Response("not json", { status: 200 }));
    const error = await catchError(fetchReferringSites("acme.com", KEY, asFetch(fetchMock)));
    expect(error.status).toBe(502);
    expect(error.code).toBe("invalid_response");
  });
});

describe("normalizeReferringSitesBody", () => {
  const now = new Date("2026-10-26T00:00:00.000Z");

  it("giữ tối đa 20 backlink và giới hạn số liệu", () => {
    const body = {
      overview: {
        domain_rating: 250,
        backlinks: -4,
        referring_domains: 12.9,
        dofollow_backlinks_pct: 500,
        dofollow_referring_domains_pct: -1,
      },
      backlinks: Array.from({ length: 30 }, (_, index) => ({
        from_url: `https://s${index}.example.com/p`,
        to_url: "https://acme.com/",
        title: "t".repeat(500),
        anchor: "a".repeat(500),
        domain_rating: 999,
      })),
    };
    const result = normalizeReferringSitesBody(body, now);
    expect(result.backlinks).toHaveLength(20);
    expect(result.overview).toEqual({
      domain_rating: 100,
      backlinks: 0,
      referring_domains: 12,
      dofollow_backlinks_pct: 100,
      dofollow_referring_domains_pct: 0,
    });
    expect(result.backlinks[0].title).toHaveLength(200);
    expect(result.backlinks[0].anchor).toHaveLength(120);
    expect(result.backlinks[0].domain_rating).toBe(100);
    expect(result.fetched_at).toBe("2026-10-26T00:00:00.000Z");
  });

  it("loại backlink có from_url không phải http/https", () => {
    const result = normalizeReferringSitesBody({
      overview: null,
      backlinks: [
        { from_url: "javascript:alert(1)", to_url: "https://acme.com/", title: "x" },
        { from_url: "https://ok.example.com/a", to_url: "https://acme.com/", title: "y" },
      ],
    });
    expect(result.backlinks).toHaveLength(1);
    expect(result.backlinks[0].from_domain).toBe("ok.example.com");
  });

  it("chỉ giữ backlink đầu tiên của mỗi tên miền nguồn (không phân biệt hoa thường)", () => {
    const result = normalizeReferringSitesBody({
      backlinks: [
        { from_url: "https://Dup.example.com/a", title: "đầu" },
        { from_url: "https://other.example.com/x", title: "khác" },
        { from_url: "https://www.dup.example.com/b", title: "trùng" },
        { from_url: "https://dup.EXAMPLE.com/c", title: "trùng nữa" },
      ],
    });
    expect(result.backlinks.map((item) => item.title)).toEqual(["đầu", "khác"]);
  });

  it("loại trùng trước khi áp giới hạn 20 mục", () => {
    const backlinks = [
      ...Array.from({ length: 10 }, () => ({ from_url: "https://same.example.com/p" })),
      ...Array.from({ length: 25 }, (_, index) => ({ from_url: `https://s${index}.example.com/p` })),
    ];
    const result = normalizeReferringSitesBody({ backlinks });
    expect(result.backlinks).toHaveLength(20);
    expect(result.backlinks[0].from_domain).toBe("same.example.com");
    expect(result.backlinks[19].from_domain).toBe("s18.example.com");
  });

  it("làm sạch tiêu đề và anchor chứa ký tự bidi", () => {
    const result = normalizeReferringSitesBody({
      backlinks: [{ from_url: "https://a.example.com/", title: "x‮y", anchor: "​" }],
    });
    expect(result.backlinks[0].title).toBe("xy");
    expect(result.backlinks[0].anchor).toBeNull();
  });

  it("đặt to_url và to_path về null khi to_url không an toàn nhưng giữ mục", () => {
    const result = normalizeReferringSitesBody({
      backlinks: [
        { from_url: "https://ok.example.com/a", to_url: "javascript:alert(1)", title: "y" },
      ],
    });
    expect(result.backlinks).toHaveLength(1);
    expect(result.backlinks[0].to_url).toBeNull();
    expect(result.backlinks[0].to_path).toBeNull();
  });

  it("trả overview null khi thiếu hoặc toàn giá trị không phải số", () => {
    expect(normalizeReferringSitesBody({ backlinks: [] }).overview).toBeNull();
    expect(normalizeReferringSitesBody({ overview: "x", backlinks: [] }).overview).toBeNull();
    expect(
      normalizeReferringSitesBody({
        overview: {
          domain_rating: "1",
          backlinks: "2",
          referring_domains: null,
          dofollow_backlinks_pct: "x",
          dofollow_referring_domains_pct: undefined,
        },
      }).overview,
    ).toBeNull();
  });

  it("trả mảng rỗng khi backlinks thiếu hoặc không phải mảng", () => {
    expect(normalizeReferringSitesBody({}).backlinks).toEqual([]);
    expect(normalizeReferringSitesBody({ backlinks: "x" }).backlinks).toEqual([]);
  });

  it("ném invalid_response khi body không phải object", () => {
    for (const body of [null, "x", 5, []]) {
      try {
        normalizeReferringSitesBody(body);
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ReferringSitesApiError);
        expect((error as ReferringSitesApiError).code).toBe("invalid_response");
        expect((error as ReferringSitesApiError).status).toBe(502);
      }
    }
  });

  it("nhận diện kết quả rỗng", () => {
    expect(isEmptyReferringSites(normalizeReferringSitesBody({}))).toBe(true);
    expect(isEmptyReferringSites(normalizeReferringSitesBody(referringSitesUpstreamFixture))).toBe(false);
  });
});

describe("getReferringSites", () => {
  it("chỉ gọi upstream một lần cho hai lần tra cứu tuần tự (không phân biệt hoa thường)", async () => {
    const fetchMock = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    await getReferringSites("Acme.com", KEY, asFetch(fetchMock));
    await getReferringSites("acme.COM", KEY, asFetch(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gộp các lần tra cứu đồng thời thành một lần gọi", async () => {
    const fetchMock = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    const [a, b] = await Promise.all([
      getReferringSites("acme.com", KEY, asFetch(fetchMock)),
      getReferringSites("acme.com", KEY, asFetch(fetchMock)),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("không cache lỗi: lỗi rồi thành công thì gọi hai lần", async () => {
    let call = 0;
    const fetchMock = mockFetch(() => {
      call += 1;
      return call === 1
        ? jsonResponse({}, { status: 500 })
        : jsonResponse(referringSitesUpstreamFixture);
    });
    await catchError(getReferringSites("acme.com", KEY, asFetch(fetchMock)));
    const result = await getReferringSites("acme.com", KEY, asFetch(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.backlinks).toHaveLength(12);
  });

  it("cache kết quả rỗng chỉ 10 phút", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T00:00:00.000Z"));
    const fetchMock = mockFetch(() => jsonResponse({ overview: null, backlinks: [] }));

    const first = await getReferringSites("acme.com", KEY, asFetch(fetchMock));
    expect(isEmptyReferringSites(first)).toBe(true);
    await getReferringSites("acme.com", KEY, asFetch(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-26T00:11:00.000Z"));
    await getReferringSites("acme.com", KEY, asFetch(fetchMock));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clearReferringSitesCache xóa cả hai bộ nhớ đệm", async () => {
    const full = mockFetch(() => jsonResponse(referringSitesUpstreamFixture));
    const empty = mockFetch(() => jsonResponse({}));
    await getReferringSites("full.com", KEY, asFetch(full));
    await getReferringSites("empty.com", KEY, asFetch(empty));

    clearReferringSitesCache();
    await getReferringSites("full.com", KEY, asFetch(full));
    await getReferringSites("empty.com", KEY, asFetch(empty));
    expect(full).toHaveBeenCalledTimes(2);
    expect(empty).toHaveBeenCalledTimes(2);
  });
});
