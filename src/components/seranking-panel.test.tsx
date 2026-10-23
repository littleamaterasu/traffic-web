import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  serankingAdsFixture,
  serankingBacklinksFixture,
  serankingCompetitorsFixture,
} from "@/test/seranking-fixture";
import type {
  SeRankingAdsResponse,
  SeRankingBacklinksResponse,
  SeRankingCompetitorsResponse,
} from "@/types/seranking";
import { SerankingPanel } from "./seranking-panel";

type FetchPayload =
  | SeRankingAdsResponse
  | SeRankingBacklinksResponse
  | SeRankingCompetitorsResponse
  | Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function jsonResponse(body: FetchPayload, ok = true) {
  return { ok, json: async () => body };
}

describe("SerankingPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("không gọi fetch khi mount và hiển thị ba phần cùng ba nút tải", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2, name: "Mẫu quảng cáo & trang đích (SE Ranking)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Backlink (SE Ranking)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải mẫu quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải backlink" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Giải thích bảng/ })).toHaveLength(3);
  });

  it("hiển thị dòng giải thích credits và badge nguồn cho mẫu quảng cáo", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<SerankingPanel domain="acme.com" />);

    expect(screen.getByText(/Mẫu quảng cáo và trang đích do SE Ranking cung cấp/)).toHaveTextContent(
      "tốn credits của tài khoản SE Ranking",
    );
    expect(screen.getByText("Nguồn: SE Ranking · cơ sở dữ liệu us")).toBeInTheDocument();
  });

  it("bấm Tải mẫu quảng cáo gọi đúng một lần /api/seranking/ads và hiển thị tối đa 10 thẻ", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serankingAdsFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));

    const list = await screen.findByRole("list", { name: "Mẫu quảng cáo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/seranking/ads?domain=acme.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(within(list).getByText("từ khóa 10")).toBeInTheDocument();
    expect(within(list).queryByText("từ khóa 11")).not.toBeInTheDocument();
    expect(within(list).getAllByText("Trên cùng").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("Cuối trang").length).toBeGreaterThan(0);
    expect(within(list).getByText("Vị trí 1")).toBeInTheDocument();
    expect(within(list).getByText("Mô tả quảng cáo 1")).toBeInTheDocument();
    expect(within(list).getByText("acme.com/trang-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải mẫu quảng cáo" })).not.toBeInTheDocument();
  });

  it("làm sạch tiêu đề dính URL, chỉ link http(s) mới là thẻ a với rel an toàn, không hiển thị volume/CPC", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(serankingAdsFixture)));

    const { container } = render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));
    const list = await screen.findByRole("list", { name: "Mẫu quảng cáo" });

    expect(within(list).getByText("Giày chạy bộ giá tốt - Acme")).toBeInTheDocument();
    expect(within(list).queryByText(/https:\/\/www\.acme\.com/)).not.toBeInTheDocument();

    const link = within(list).getByRole("link", { name: "https://acme.com/trang-1" });
    expect(link).toHaveAttribute("href", "https://acme.com/trang-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    expect(within(list).getByText("acme.com/trang-2", { selector: "span" })).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: "acme.com/trang-2" })).not.toBeInTheDocument();
    expect(within(list).getAllByRole("link")).toHaveLength(9);

    expect(container).not.toHaveTextContent(/volume/i);
    expect(container).not.toHaveTextContent(/cpc/i);
  });

  it("vô hiệu nút và hiển thị role=status trong khi đang tải mẫu quảng cáo", async () => {
    const user = userEvent.setup();
    let resolveAds: (value: ReturnType<typeof jsonResponse>) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAds = resolve as typeof resolveAds;
          }),
      ),
    );

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải mẫu quảng cáo từ SE Ranking");
    expect(screen.getByRole("button", { name: "Tải mẫu quảng cáo" })).toBeDisabled();

    resolveAds(jsonResponse(serankingAdsFixture));
    await screen.findByRole("list", { name: "Mẫu quảng cáo" });
  });

  it("hiển thị EmptyCell khi không có mẫu quảng cáo", async () => {
    const user = userEvent.setup();
    const payload = clone(serankingAdsFixture);
    payload.ads = { data: [], error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));

    expect(
      await screen.findByText("SE Ranking chưa ghi nhận mẫu quảng cáo nào cho tên miền này."),
    ).toBeInTheDocument();
  });

  it("lỗi HTTP khi tải mẫu quảng cáo hiển thị alert, nút Thử lại và thử lại thành công", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "missing_api_key", message: "Thiếu key." } }, false),
      )
      .mockResolvedValueOnce(jsonResponse(serankingAdsFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu key.");
    expect(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("list", { name: "Mẫu quảng cáo" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lỗi slice mẫu quảng cáo hiển thị thông điệp máy chủ trong role=alert", async () => {
    const user = userEvent.setup();
    const failing = clone(serankingAdsFixture);
    failing.ads = {
      data: null,
      error: { code: "rate_limited", message: "SE Ranking đang quá tải, thử lại sau." },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(failing)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SE Ranking đang quá tải, thử lại sau.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("đáp ứng sai dạng hiển thị lỗi fallback, lỗi mạng hiển thị thông báo tiếng Việt", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ khong_dung: true }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu SE Ranking lúc này.");

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu SE Ranking lúc này.");
  });

  it("đổi domain đưa panel mẫu quảng cáo về trạng thái idle và mã hóa domain trong URL", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serankingAdsFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));
    await screen.findByRole("list", { name: "Mẫu quảng cáo" });

    rerender(<SerankingPanel domain="other.com/path" />);

    expect(await screen.findByRole("button", { name: "Tải mẫu quảng cáo" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Mẫu quảng cáo" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Tải mẫu quảng cáo" }));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/seranking/ads?domain=other.com%2Fpath",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("không gọi /api/seranking/competitors khi mount và hiển thị nút Tải đối thủ quảng cáo cùng dòng giải thích credits", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);

    expect(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByText(/Danh sách đối thủ quảng cáo do SE Ranking cung cấp/)).toHaveTextContent(
      "tốn credits của tài khoản SE Ranking",
    );
    expect(screen.queryByText("rival-one.com")).not.toBeInTheDocument();
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("/api/seranking/competitors");
    }
  });

  it("bấm Tải đối thủ quảng cáo gọi đúng một lần /api/seranking/competitors và hiển thị bảng responsive-table với data-label", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(serankingCompetitorsFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));
    await screen.findByText("rival-one.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/seranking/competitors?domain=acme.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.getByText("rival-two.com")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("45.678")).toBeInTheDocument();
    expect(screen.getByText("12.345")).toBeInTheDocument();
    expect(screen.getByText("rival-one.com")).toHaveAttribute("data-label", "Tên miền");
    expect(container.querySelector(".responsive-table")).toBeInTheDocument();
    expect(container.querySelectorAll("td[data-label]").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Tải đối thủ quảng cáo" })).not.toBeInTheDocument();
  });

  it("vô hiệu nút và hiển thị role=status trong khi đang tải đối thủ", async () => {
    const user = userEvent.setup();
    let resolveCompetitors: (value: ReturnType<typeof jsonResponse>) => void = () => {};
    const fetchMock = vi.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCompetitors = resolve as typeof resolveCompetitors;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải danh sách đối thủ từ SE Ranking");
    expect(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeDisabled();

    resolveCompetitors(jsonResponse(serankingCompetitorsFixture));
    await screen.findByText("rival-one.com");
  });

  it("hiển thị EmptyCell khi không có đối thủ quảng cáo", async () => {
    const user = userEvent.setup();
    const payload = clone(serankingCompetitorsFixture);
    payload.competitors = { data: [], error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));

    expect(
      await screen.findByText("Chưa phát hiện đối thủ quảng cáo nào cho tên miền này."),
    ).toBeInTheDocument();
  });

  it("lỗi slice đối thủ hiển thị role=alert và Thử lại; các panel khác vẫn hiển thị và thử lại thành công", async () => {
    const user = userEvent.setup();
    const failing = clone(serankingCompetitorsFixture);
    failing.competitors = {
      data: null,
      error: { code: "rate_limited", message: "SE Ranking đang quá tải, thử lại sau." },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(failing))
        .mockResolvedValueOnce(jsonResponse(serankingCompetitorsFixture)),
    );

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SE Ranking đang quá tải, thử lại sau.");
    expect(screen.getByRole("button", { name: "Tải backlink" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("rival-one.com")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("lỗi HTTP khi tải đối thủ hiển thị thông điệp máy chủ trong role=alert", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: "missing_api_key", message: "Thiếu key." } }, false),
        ),
    );

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu key.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("đổi domain đưa panel đối thủ về trạng thái idle, không còn bảng", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(serankingCompetitorsFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" }));
    await screen.findByText("rival-one.com");

    rerender(<SerankingPanel domain="other.com" />);

    expect(await screen.findByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.queryByText("rival-one.com")).not.toBeInTheDocument();
  });

  it("không bao giờ gọi /api/seranking/backlinks khi mount hay khi domain không đổi", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    rerender(<SerankingPanel domain="acme.com" />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bấm Tải backlink gọi đúng một lần /api/seranking/backlinks và hiển thị tỷ lệ dofollow 75.0%", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(serankingBacklinksFixture));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByText("75.0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    const fetchMock = vi.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBacklinks = resolve as typeof resolveBacklinks;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    const button = screen.getByRole("button", { name: "Tải backlink" });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/backlink/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    resolveBacklinks(jsonResponse(serankingBacklinksFixture));
    expect(await screen.findByText("75.0%")).toBeInTheDocument();
  });

  it("lỗi khi tải backlink hiển thị alert và nút Thử lại để thử lại", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải dữ liệu SE Ranking lúc này.",
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse(serankingBacklinksFixture));
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("75.0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lỗi slice backlinks hiển thị alert với thông điệp máy chủ và nút Thử lại", async () => {
    const user = userEvent.setup();
    const errorBacklinks = clone(serankingBacklinksFixture);
    errorBacklinks.backlinks = {
      data: null,
      error: { code: "insufficient_credits", message: "Tài khoản SE Ranking không đủ credits." },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(errorBacklinks)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(nullBacklinks)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(payload)));

    render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    const anchorList = await screen.findByRole("list", { name: "Anchor hàng đầu" });
    expect(within(anchorList).getAllByRole("listitem")).toHaveLength(5);
    expect(within(anchorList).getByText("anchor 5")).toBeInTheDocument();
    expect(within(anchorList).queryByText("anchor 6")).not.toBeInTheDocument();
  });

  it("đặt lại về nút Tải backlink khi domain thay đổi và không tự gọi lại backlinks", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse(serankingBacklinksFixture));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<SerankingPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    await screen.findByText("75.0%");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(<SerankingPanel domain="other.com" />);

    const resetButton = await screen.findByRole("button", { name: "Tải backlink" });
    expect(resetButton).toBeEnabled();
    expect(screen.queryByText("75.0%")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
