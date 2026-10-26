import { StrictMode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferringSitesPanel } from "./referring-sites-panel";
import { referringSitesFixture } from "@/test/referring-sites-fixture";
import type { ReferringSitesResponse } from "@/types/referring-sites";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function clone(): ReferringSitesResponse {
  return structuredClone(referringSitesFixture);
}

function withData(patch: Partial<NonNullable<ReferringSitesResponse["referring_sites"]["data"]>>) {
  const copy = clone();
  Object.assign(copy.referring_sites.data!, patch);
  return copy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReferringSitesPanel", () => {
  it("ban đầu chỉ hiện tiêu đề, nhãn và nút tải, chưa gọi fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReferringSitesPanel domain="acme.com" />);

    expect(screen.getByRole("heading", { level: 2, name: "Tên miền giới thiệu" })).toBeInTheDocument();
    expect(screen.getByText("Backlink — không phải lượt truy cập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải backlink" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giải thích bảng Tên miền giới thiệu" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gọi API đúng một lần khi bấm và hiện chỉ số cùng 10 backlink đầu", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReferringSitesPanel domain="acme.com" />);

    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/referring-sites?domain=acme.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    const list = await screen.findByRole("list", { name: "Top backlink" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("58.347.754")).toBeInTheDocument();
    expect(screen.getByText("449.624")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("89%")).toBeInTheDocument();
    expect(screen.getByText("site-10.example.com")).toBeInTheDocument();
    expect(screen.queryByText("site-11.example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải backlink" })).not.toBeInTheDocument();
  });

  it("nút Xem thêm hiện đủ 12 backlink và Ẩn bớt thu lại còn 10", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture)));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    await screen.findByRole("list", { name: "Top backlink" });

    await user.click(screen.getByRole("button", { name: "Xem thêm 2 backlink" }));
    expect(within(screen.getByRole("list", { name: "Top backlink" })).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByText("site-11.example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ẩn bớt" }));
    expect(within(screen.getByRole("list", { name: "Top backlink" })).getAllByRole("listitem")).toHaveLength(10);
  });

  it("mục đầu tiên hiện chữ cái, DR, tiêu đề, anchor và liên kết trang đích", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture)));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    const list = await screen.findByRole("list", { name: "Top backlink" });
    const first = within(list).getAllByRole("listitem")[0];

    expect(within(first).getByText("S")).toBeInTheDocument();
    expect(within(first).getByText("DR 89")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Bài viết 1" })).toHaveAttribute(
      "href",
      "https://site-1.example.com/blog/post-1",
    );
    expect(within(first).getByText("anchor 1")).toBeInTheDocument();
    expect(within(first).getByText("→")).toBeInTheDocument();
    const target = within(first).getByRole("link", { name: "/trang-1" });
    expect(target).toHaveAttribute("href", "https://acme.com/trang-1");
    expect(target).toHaveAttribute("rel", "noopener noreferrer");
    expect(target).toHaveAttribute("target", "_blank");
  });

  it("không tạo liên kết javascript: và hiện tiêu đề HTML dưới dạng văn bản thuần", async () => {
    const user = userEvent.setup();
    const payload = clone();
    const first = payload.referring_sites.data!.backlinks[0];
    first.from_url = "javascript:alert(1)";
    first.to_url = "javascript:alert(1)";
    first.title = "<img src=x onerror=alert(1)>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
    const { container } = render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    await screen.findByRole("list", { name: "Top backlink" });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    }
  });

  it("hiện trạng thái đang tải và vô hiệu hóa nút trong lúc chờ", async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((r) => (resolve = r))));
    render(<ReferringSitesPanel domain="acme.com" />);

    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải backlink");
    expect(screen.getByRole("button", { name: "Tải backlink" })).toBeDisabled();

    await act(async () => {
      resolve(jsonResponse(referringSitesFixture));
    });
    expect(await screen.findByRole("list", { name: "Top backlink" })).toBeInTheDocument();
  });

  it("hiện trạng thái trống và nút Thử lại khi không có dữ liệu", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(withData({ overview: null, backlinks: [] }))));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByText(/Chưa phát hiện backlink nào cho tên miền này/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("có tổng quan nhưng không có backlink mẫu thì hiện chỉ số và thông báo mẫu trống", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(withData({ backlinks: [] }))));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByText("Chưa có backlink mẫu nào được ghi nhận.")).toBeInTheDocument();
    expect(screen.getByText("58.347.754")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Top backlink" })).not.toBeInTheDocument();
  });

  it("hiện lỗi HTTP và thử lại thành công ở lần gọi thứ hai", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "missing_api_key", message: "Thiếu key." } }, false))
      .mockResolvedValueOnce(jsonResponse(referringSitesFixture));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu key.");

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("list", { name: "Top backlink" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hiện thông báo lỗi của slice, dữ liệu sai dạng và lỗi mạng", async () => {
    const user = userEvent.setup();
    const sliceError = {
      domain: "acme.com",
      referring_sites: { data: null, error: { code: "insufficient_credits", message: "Hết credit." } },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sliceError))
      .mockResolvedValueOnce(jsonResponse({ foo: "bar" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hết credit.");

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Không thể tải dữ liệu backlink lúc này.");

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Không thể tải dữ liệu backlink lúc này.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("hiện lỗi dự phòng thay vì crash khi dữ liệu sai dạng", async () => {
    const user = userEvent.setup();
    const bad = [
      { domain: "acme.com", referring_sites: { data: { fetched_at: "x", overview: null, backlinks: "x" }, error: null } },
      { domain: "acme.com", referring_sites: { data: { fetched_at: "x", overview: null }, error: null } },
      { domain: "acme.com", referring_sites: { data: { fetched_at: "x", overview: "oops", backlinks: [] }, error: null } },
      { domain: "acme.com", referring_sites: { data: { fetched_at: "x", overview: { domain_rating: "93" }, backlinks: [] }, error: null } },
      { domain: "acme.com", referring_sites: { data: { fetched_at: "x", overview: null, backlinks: [null] }, error: null } },
      { domain: "acme.com", referring_sites: { data: { overview: null, backlinks: [] }, error: null } },
      { domain: "acme.com", referring_sites: { data: [], error: null } },
      { domain: "acme.com", referring_sites: { data: null, error: { code: "x", message: 5 } } },
    ];
    const fetchMock = vi.fn();
    for (const body of bad) fetchMock.mockResolvedValueOnce(jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReferringSitesPanel domain="acme.com" />);

    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    for (let index = 0; index < bad.length; index += 1) {
      expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu backlink lúc này.");
      expect(screen.queryByRole("list", { name: "Top backlink" })).not.toBeInTheDocument();
      if (index < bad.length - 1) await user.click(screen.getByRole("button", { name: "Thử lại" }));
    }
    expect(fetchMock).toHaveBeenCalledTimes(bad.length);
  });

  it("nút Xem thêm có aria-expanded và aria-controls trỏ tới danh sách", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture)));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    const list = await screen.findByRole("list", { name: "Top backlink" });

    const toggle = screen.getByRole("button", { name: "Xem thêm 2 backlink" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(list.id).not.toBe("");
    expect(toggle).toHaveAttribute("aria-controls", list.id);

    await user.click(toggle);
    const collapse = screen.getByRole("button", { name: "Ẩn bớt" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(collapse).toHaveAttribute("aria-controls", list.id);
  });

  it("chỉ có một vùng thông báo: không có aria-live bao ngoài, lỗi chỉ qua role alert", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Lỗi." } }, false)));
    const { container } = render(<ReferringSitesPanel domain="acme.com" />);
    expect(container.querySelector("[aria-live]")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(1);
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("DR dạng số lẻ được định dạng theo vi-VN", async () => {
    const user = userEvent.setup();
    const payload = clone();
    payload.referring_sites.data!.backlinks[0].domain_rating = 83.5;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    const list = await screen.findByRole("list", { name: "Top backlink" });

    expect(within(list).getByText("DR 83,5")).toBeInTheDocument();
  });

  it("anchor và URL dài không tràn: chip anchor có class ngắt từ và min-w-0", async () => {
    const user = userEvent.setup();
    const payload = clone();
    payload.referring_sites.data!.backlinks[0].anchor = "x".repeat(120);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    const list = await screen.findByRole("list", { name: "Top backlink" });

    const chip = within(list).getByText("x".repeat(120));
    expect(chip).toHaveClass("break-all", "min-w-0", "max-w-full");
    expect(chip.className).toContain("[overflow-wrap:anywhere]");
    const target = within(list).getAllByRole("link", { name: "/trang-1" })[0];
    expect(target).toHaveClass("break-all", "min-w-0");
  });

  it("ghi chú và gợi ý nêu đúng thời gian cache 24 giờ và 10 phút cho kết quả trống", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<ReferringSitesPanel domain="acme.com" />);

    expect(screen.getByText(/Kết quả được lưu cache 24 giờ, kết quả trống chỉ 10 phút/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Giải thích bảng Tên miền giới thiệu" }));
    expect(screen.getByText(/kết quả trống chỉ lưu 10 phút/)).toBeInTheDocument();
  });

  it("hiện thông báo quá thời gian khi fetch bị hủy bởi timeout", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Yêu cầu mất quá nhiều thời gian");
  });

  it("đổi tên miền đưa panel về trạng thái chờ và không tự gọi fetch", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    await screen.findByRole("list", { name: "Top backlink" });

    rerender(<ReferringSitesPanel domain="other.com/path" />);

    expect(screen.queryByRole("list", { name: "Top backlink" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/referring-sites?domain=other.com%2Fpath");
  });

  it("hoạt động trong StrictMode mà không báo lỗi hủy", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(referringSitesFixture)));
    render(
      <StrictMode>
        <ReferringSitesPanel domain="acme.com" />
      </StrictMode>,
    );
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    expect(await screen.findByRole("list", { name: "Top backlink" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gỡ panel khi đang tải không gây cảnh báo cập nhật state", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((r) => (resolve = r))));
    const { unmount } = render(<ReferringSitesPanel domain="acme.com" />);
    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    unmount();
    await act(async () => {
      resolve(jsonResponse(referringSitesFixture));
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
