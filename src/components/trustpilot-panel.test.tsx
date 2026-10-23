import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustpilotPanel } from "./trustpilot-panel";
import { trustpilotEmptyFixture, trustpilotFixture } from "@/test/trustpilot-fixture";
import type { TrustpilotResponse } from "@/types/trustpilot";

function okResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

function cloneFixture(): TrustpilotResponse {
  return structuredClone(trustpilotFixture);
}

function withBusiness(patch: Record<string, unknown>): TrustpilotResponse {
  const clone = cloneFixture();
  Object.assign(clone.trustpilot.data!.profile!.business, patch);
  return clone;
}

async function loadReady(body: unknown = trustpilotFixture) {
  const fetchMock = vi.fn().mockResolvedValue(okResponse(body));
  vi.stubGlobal("fetch", fetchMock);
  render(<TrustpilotPanel domain="acme.com" />);
  fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));
  await screen.findByRole("heading", { name: "Acme", level: 3 });
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TrustpilotPanel", () => {
  it("ban đầu chỉ hiện tiêu đề, nguồn và nút tải, chưa gọi fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<TrustpilotPanel domain="acme.com" />);

    expect(screen.getByRole("heading", { level: 2, name: "Đánh giá Trustpilot" })).toBeInTheDocument();
    expect(screen.getByText("Nguồn: Trustpilot (scraper nội bộ)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giải thích bảng Đánh giá Trustpilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("gọi API đúng một lần khi bấm và hiện trạng thái đang tải", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    render(<TrustpilotPanel domain="acme.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/trustpilot?domain=acme.com");
    expect(options.headers).toEqual({ "ngrok-skip-browser-warning": "true" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Đang tải");
    expect(status).toHaveTextContent("một phút");
    expect(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" })).toBeDisabled();

    await act(async () => {
      resolve(okResponse(trustpilotFixture));
    });
    await screen.findByRole("heading", { name: "Acme", level: 3 });
  });

  it("hiển thị hồ sơ, 5 đánh giá, liên kết, nguồn và thời gian cập nhật", async () => {
    await loadReady(withBusiness({ review_count: 15255, trust_score: 4.4 }));

    expect(screen.getByText("4,4")).toBeInTheDocument();
    expect(screen.getByText("15.255 đánh giá")).toBeInTheDocument();
    const profileLink = screen.getByRole("link", { name: "Xem trên Trustpilot" });
    expect(profileLink).toHaveAttribute("href", "https://www.trustpilot.com/review/acme.com");
    expect(profileLink).toHaveAttribute("target", "_blank");
    expect(profileLink).toHaveAttribute("rel", "noopener noreferrer");
    const siteLink = screen.getByRole("link", { name: "Truy cập website" });
    expect(siteLink).toHaveAttribute("href", "https://www.acme.com");
    expect(siteLink).toHaveAttribute("rel", "noopener noreferrer");

    const reviews = within(screen.getByRole("list", { name: "Đánh giá gần nhất" })).getAllByRole("listitem");
    expect(reviews).toHaveLength(5);
    expect(within(reviews[0]).getByRole("heading", { name: "Dịch vụ rất tốt" })).toBeInTheDocument();
    expect(within(reviews[0]).getByText("Hỗ trợ nhanh và nhiệt tình.")).toBeInTheDocument();
    expect(within(reviews[0]).getByText(/Linh Tran/)).toHaveTextContent("Linh Tran · VN · 23/10/2026");
    expect(within(reviews[0]).getByRole("img", { name: "Đánh giá 5 trên 5" })).toBeInTheDocument();

    expect(screen.getByText(/Nguồn: Trustpilot qua scraper nội bộ/)).toHaveTextContent("23/10/2026");
    expect(screen.getByText(/Cập nhật/)).toHaveTextContent("00:00");
    expect(screen.queryByRole("button", { name: "Tải đánh giá Trustpilot" })).not.toBeInTheDocument();
  });

  it("sao tiêu đề theo stars còn số TrustScore theo trust_score", async () => {
    await loadReady(withBusiness({ stars: 4.5, trust_score: 4.9 }));

    const boxes = screen.getByRole("img", { name: "Điểm 4,5 trên 5" });
    const fills = Array.from(boxes.children).map((box) => box.getAttribute("data-fill"));
    expect(fills).toEqual(["1", "1", "1", "1", "0.5"]);
    expect(screen.getByText("4,9")).toBeInTheDocument();
  });

  it("dùng trust_score cho sao khi thiếu stars", async () => {
    await loadReady(withBusiness({ stars: null, trust_score: 4.9 }));

    const boxes = screen.getByRole("img", { name: "Điểm 4,9 trên 5" });
    const fills = Array.from(boxes.children).map((box) => box.getAttribute("data-fill"));
    expect(fills).toEqual(["1", "1", "1", "1", "1"]);
  });

  it("không hiện logo, xác nhận, danh mục, phân bố khi thiếu trường tùy chọn", async () => {
    await loadReady();

    expect(screen.queryByRole("img", { name: "Acme" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Hồ sơ đã xác nhận/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Danh mục/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Phân bố đánh giá" })).not.toBeInTheDocument();
  });

  it("hiện logo, xác nhận, danh mục, phân bố khi có trường tùy chọn", async () => {
    await loadReady(
      withBusiness({
        logo_url: "https://cdn.example.com/logo.png",
        claimed_since: "tháng 3 năm 2020",
        categories: ["Phần mềm", "Marketing"],
        rating_distribution: [
          { stars: 5, percent: 80 },
          { stars: 4, percent: 10 },
          { stars: 1, percent: 10 },
        ],
      }),
    );

    const logo = screen.getByRole("img", { name: "Acme" });
    expect(logo).toHaveAttribute("src", "https://cdn.example.com/logo.png");
    expect(logo).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByText(/Hồ sơ đã xác nhận • tháng 3 năm 2020/)).toBeInTheDocument();
    expect(screen.getByText(/Phần mềm, Marketing/)).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Phân bố đánh giá" })).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("5 sao");
    expect(rows[0]).toHaveTextContent("80%");
  });

  it("không hiện logo khi URL logo không an toàn", async () => {
    await loadReady(withBusiness({ logo_url: "javascript:alert(1)" }));

    expect(screen.queryByRole("img", { name: "Acme" })).not.toBeInTheDocument();
  });

  it("hiện thông báo chưa có hồ sơ và không còn nút tải", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(trustpilotEmptyFixture)));
    render(<TrustpilotPanel domain="acme.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    expect(await screen.findByText("Chưa có hồ sơ Trustpilot cho tên miền này.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tải đánh giá Trustpilot|Thử lại/ })).not.toBeInTheDocument();
  });

  it("hiện lỗi HTTP bằng role alert và cho thử lại thành công", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { code: "x", message: "Scraper đang bận." } }) })
      .mockResolvedValueOnce(okResponse(trustpilotFixture));
    vi.stubGlobal("fetch", fetchMock);
    render(<TrustpilotPanel domain="acme.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Scraper đang bận.");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("heading", { name: "Acme", level: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hiện lỗi của slice trustpilot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({ domain: "acme.com", trustpilot: { data: null, error: { code: "scraper_unavailable", message: "Dịch vụ scraper không phản hồi." } } }),
      ),
    );
    render(<TrustpilotPanel domain="acme.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Dịch vụ scraper không phản hồi.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("dùng thông báo mặc định khi phản hồi sai định dạng", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ foo: "bar" })));
    render(<TrustpilotPanel domain="acme.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải đánh giá Trustpilot lúc này.");
  });

  it("không hiện liên kết có giao thức không an toàn", async () => {
    const clone = cloneFixture();
    clone.trustpilot.data!.profile!.trustpilot_url = "javascript:alert(1)";
    clone.trustpilot.data!.profile!.business.website = "data:text/html,x";
    await loadReady(clone);

    expect(screen.queryByRole("link", { name: "Xem trên Trustpilot" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Truy cập website" })).not.toBeInTheDocument();
  });

  it("hiển thị HTML bị scrape như văn bản thuần", async () => {
    const clone = cloneFixture();
    clone.trustpilot.data!.profile!.reviews[0].heading = "<img src=x onerror=alert(1)>";
    await loadReady(clone);

    expect(screen.getByRole("heading", { name: "<img src=x onerror=alert(1)>" })).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("đổi domain thì quay về trạng thái ban đầu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(trustpilotFixture)));
    const { rerender } = render(<TrustpilotPanel domain="acme.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));
    await screen.findByRole("heading", { name: "Acme", level: 3 });

    rerender(<TrustpilotPanel domain="other.com" />);

    expect(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Acme", level: 3 })).not.toBeInTheDocument();
  });

  it("không hủy request khi unmount và không phát sinh lỗi", async () => {
    let captured: AbortSignal | undefined;
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        captured = options.signal;
        return new Promise((r) => (resolve = r));
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<TrustpilotPanel domain="acme.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    unmount();
    await act(async () => {
      resolve(okResponse(trustpilotFixture));
    });

    expect(captured?.aborted).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("hiện thông báo hết thời gian sau 60 giây", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );
    render(<TrustpilotPanel domain="acme.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Tải đánh giá Trustpilot" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Yêu cầu mất quá nhiều thời gian");
  });
});
