import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serankingFixture, serankingBacklinksFixture } from "@/test/seranking-fixture";
import type { SeRankingBacklinksResponse, SeRankingResponse } from "@/types/seranking";
import { SerankingPanel } from "./seranking-panel";

type FetchPayload = SeRankingResponse | SeRankingBacklinksResponse | Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function jsonResponse(body: FetchPayload, ok = true) {
  return { ok, json: async () => body };
}

describe("SerankingPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gọi /api/seranking với domain, header ngrok-skip-browser-warning và AbortSignal khi mount", () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serankingFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/seranking?domain=acme.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("hiển thị trạng thái đang tải với role=status và nội dung tiếng Việt nhắc đến SE Ranking", async () => {
    let resolveFetch: (value: ReturnType<typeof jsonResponse>) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve as typeof resolveFetch;
          }),
      ),
    );

    render(<SerankingPanel domain="acme.com" />);

    expect(screen.getByRole("status")).toHaveTextContent("SE Ranking");

    resolveFetch(jsonResponse(serankingFixture));
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");
  });

  it("gọi lại /api/seranking khi domain thay đổi và mã hóa domain trong URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serankingFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");

    rerender(<SerankingPanel domain="other.com/path" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/seranking?domain=other.com%2Fpath",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("hủy yêu cầu đang chờ khi component unmount", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    const { unmount } = render(<SerankingPanel domain="acme.com" />);
    expect(fetch).toHaveBeenCalled();

    unmount();

    const signal = (vi.mocked(fetch).mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(signal.aborted).toBe(true);
  });

  it("hiển thị alert với thông điệp máy chủ khi thiếu key (missing_api_key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "missing_api_key", message: "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." } },
          false,
        ),
      ),
    );

    render(<SerankingPanel domain="acme.com" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.",
    );
    expect(screen.queryByRole("heading", { name: "Đối thủ quảng cáo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Backlink (SE Ranking)" })).not.toBeInTheDocument();
  });

  it("hiển thị đủ ba panel SE Ranking với badge nguồn và toàn cầu khi dữ liệu sẵn sàng", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(serankingFixture)));

    render(<SerankingPanel domain="acme.com" />);

    expect(await screen.findByText("534.575")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "SEO & quảng cáo trả phí (SE Ranking)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Từ khóa quảng cáo & mẫu quảng cáo" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Backlink (SE Ranking)" })).toBeInTheDocument();
    expect(screen.getByText("SE Ranking · toàn cầu")).toBeInTheDocument();
    expect(screen.getAllByText(/SE Ranking/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("button", { name: /Giải thích bảng/ })).toHaveLength(3);
  });

  it("hiển thị sáu thẻ chỉ số tổng quan với định dạng vi-VN/en-US", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(serankingFixture)));

    render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");

    expect(screen.getByText("Từ khóa tự nhiên")).toBeInTheDocument();
    expect(screen.getByText("534.575")).toBeInTheDocument();
    expect(screen.getByText("Traffic tự nhiên")).toBeInTheDocument();
    expect(screen.getByText("531,2 N")).toBeInTheDocument();
    expect(screen.getByText("Giá trị traffic tự nhiên")).toBeInTheDocument();
    expect(screen.getByText("$274,754.56")).toBeInTheDocument();
    expect(screen.getByText("Từ khóa quảng cáo")).toBeInTheDocument();
    expect(screen.getByText("335")).toBeInTheDocument();
    expect(screen.getByText("Traffic quảng cáo")).toBeInTheDocument();
    expect(screen.getByText("2,9 N")).toBeInTheDocument();
    expect(screen.getByText("Giá trị traffic quảng cáo")).toBeInTheDocument();
    expect(screen.getByText("$658.06")).toBeInTheDocument();
  });

  it("hiển thị — cho chỉ số null trong tổng quan", async () => {
    const payload = clone(serankingFixture);
    payload.overview = {
      data: {
        organic: { keywords_count: null, traffic_sum: null, price_sum: null },
        paid: { keywords_count: 335, traffic_sum: 2916, price_sum: 658.06 },
      },
      error: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");

    expect(screen.getByText("Từ khóa tự nhiên").closest("div")).toHaveTextContent("—");
    expect(screen.getByText("Traffic tự nhiên").closest("div")).toHaveTextContent("—");
    expect(screen.getByText("Giá trị traffic tự nhiên").closest("div")).toHaveTextContent("—");
    expect(screen.getByText("335")).toBeInTheDocument();
  });

  it("hiển thị EmptyCell tiếng Việt khi tổng quan thiếu cả organic lẫn paid", async () => {
    const payload = clone(serankingFixture);
    payload.overview = { data: { organic: null, paid: null }, error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);

    expect(
      await screen.findByText("SE Ranking chưa có dữ liệu tổng quan cho tên miền này."),
    ).toBeInTheDocument();
  });

  it("hiển thị bảng đối thủ dùng responsive-table với td data-label", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(serankingFixture)));

    const { container } = render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("rival-one.com");

    expect(screen.getByText("rival-two.com")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("45.678")).toBeInTheDocument();
    expect(screen.getByText("12.345")).toBeInTheDocument();
    expect(screen.getByText("rival-one.com")).toHaveAttribute("data-label", "Tên miền");
    expect(container.querySelector(".responsive-table")).toBeInTheDocument();
    expect(container.querySelectorAll("td[data-label]").length).toBeGreaterThan(0);
  });

  it("hiển thị EmptyCell khi không có đối thủ quảng cáo", async () => {
    const payload = clone(serankingFixture);
    payload.competitors = { data: [], error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);

    expect(
      await screen.findByText("Chưa phát hiện đối thủ quảng cáo nào cho tên miền này."),
    ).toBeInTheDocument();
  });

  it("hiển thị lỗi của từng slice trong panel tương ứng trong khi các panel khác vẫn renders", async () => {
    const payload = clone(serankingFixture);
    payload.competitors = {
      data: null,
      error: { code: "rate_limited", message: "SE Ranking đang quá tải, thử lại sau." },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("SE Ranking đang quá tải, thử lại sau.")).toBeInTheDocument();
    expect(screen.getByText("534.575")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải backlink" })).toBeInTheDocument();
  });

  it("đáp ứng không đúng dạng SeRankingResponse hiển thị lỗi fallback và không làm treo giao diện", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ khong_dung: true })));

    render(<SerankingPanel domain="acme.com" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải dữ liệu SE Ranking lúc này.",
    );
  });

  it("lỗi mạng hiển thị thông báo fallback tiếng Việt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<SerankingPanel domain="acme.com" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải dữ liệu SE Ranking lúc này.",
    );
  });

  it("không bao giờ gọi /api/seranking/backlinks khi mount hay khi domain không đổi", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serankingFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await screen.findByText("SEO & quảng cáo trả phí (SE Ranking)");

    rerender(<SerankingPanel domain="acme.com" />);
    expect(fetchMock).toHaveBeenCalledWith("/api/seranking?domain=acme.com", expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("/api/seranking/backlinks");
    }
  });

  it("bấm Tải backlink gọi đúng một lần /api/seranking/backlinks và hiển thị tỷ lệ dofollow 75.0%", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockResolvedValueOnce(jsonResponse(serankingBacklinksFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByText("75.0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/seranking/backlinks?domain=acme.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.queryByRole("button", { name: "Tải backlink" })).not.toBeInTheDocument();
    expect(screen.getByText("1.000")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("87,5")).toBeInTheDocument();
    expect(screen.getByText("click here")).toBeInTheDocument();
  });

  it("vô hiệu nút và hiển thị role=status trong khi đang tải backlink", async () => {
    const user = userEvent.setup();
    let resolveBacklinks: (value: ReturnType<typeof jsonResponse>) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveBacklinks = resolve as typeof resolveBacklinks;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    const button = await screen.findByRole("button", { name: "Tải backlink" });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/backlink/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    resolveBacklinks(jsonResponse(serankingBacklinksFixture));
    expect(await screen.findByText("75.0%")).toBeInTheDocument();
  });

  it("lỗi khi tải backlink hiển thị alert và nút Thử lại để thử lại", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockRejectedValueOnce(new TypeError("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải dữ liệu SE Ranking lúc này.",
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse(serankingBacklinksFixture));
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("75.0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lỗi slice backlinks hiển thị alert với thông điệp máy chủ và nút Thử lại", async () => {
    const user = userEvent.setup();
    const errorBacklinks = clone(serankingBacklinksFixture);
    errorBacklinks.backlinks = {
      data: null,
      error: { code: "insufficient_credits", message: "Tài khoản SE Ranking không đủ credits." },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockResolvedValueOnce(jsonResponse(errorBacklinks));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tài khoản SE Ranking không đủ credits.",
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByText("75.0%")).not.toBeInTheDocument();
  });

  it("hiển thị EmptyCell khi backlinks trả về null mà không có lỗi", async () => {
    const user = userEvent.setup();
    const nullBacklinks = clone(serankingBacklinksFixture);
    nullBacklinks.backlinks = { data: null, error: null };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockResolvedValueOnce(jsonResponse(nullBacklinks));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));

    expect(
      await screen.findByText("SE Ranking chưa có dữ liệu backlink cho tên miền này."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải backlink" })).not.toBeInTheDocument();
  });

  it("hiển thị tối đa 5 anchor hàng đầu theo backlinks", async () => {
    const user = userEvent.setup();
    const payload = clone(serankingBacklinksFixture);
    const anchorData = payload.backlinks.data;
    if (anchorData) {
      anchorData.top_anchors_by_backlinks = Array.from({ length: 7 }, (_, index) => ({
        anchor: `anchor ${index + 1}`,
        backlinks: 100 - index,
        refdomains: 10 + index,
      }));
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serankingFixture))
      .mockResolvedValueOnce(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));

    const anchorList = await screen.findByRole("list", { name: "Anchor hàng đầu" });
    expect(within(anchorList).getAllByRole("listitem")).toHaveLength(5);
    expect(within(anchorList).getByText("anchor 5")).toBeInTheDocument();
    expect(within(anchorList).queryByText("anchor 6")).not.toBeInTheDocument();
  });

  it("đặt lại về nút Tải backlink khi domain thay đổi và không tự gọi lại backlinks", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      const url = String(args[0]);
      if (url.includes("/api/seranking/backlinks")) {
        return jsonResponse(serankingBacklinksFixture);
      }
      return jsonResponse(serankingFixture);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await user.click(await screen.findByRole("button", { name: "Tải backlink" }));
    await screen.findByText("75.0%");

    const backlinkCalls = () =>
      fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/seranking/backlinks"));
    expect(backlinkCalls()).toHaveLength(1);

    rerender(<SerankingPanel domain="other.com" />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/seranking?domain=other.com", expect.anything()),
    );

    const resetButton = await screen.findByRole("button", { name: "Tải backlink" });
    expect(resetButton).toBeEnabled();
    expect(screen.queryByText("75.0%")).not.toBeInTheDocument();
    expect(backlinkCalls()).toHaveLength(1);
  });
});
