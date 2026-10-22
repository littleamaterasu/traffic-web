import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trafficFixture } from "@/test/fixture";
import { serankingFixture } from "@/test/seranking-fixture";
import { TrafficDashboard } from "./traffic-dashboard";

describe("TrafficDashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hiển thị số tháng lịch sử đã cấu hình", () => {
    render(<TrafficDashboard trafficMonths={6} />);
    expect(screen.getByText("Website intelligence / 6 tháng")).toBeInTheDocument();
  });

  it("tìm kiếm và hiển thị toàn bộ nhóm dữ liệu", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => trafficFixture }),
    );

    const { container } = render(<TrafficDashboard />);
    await user.type(screen.getByLabelText("Tên miền hoặc URL website"), "vercel.com");
    await user.click(screen.getByRole("button", { name: /phân tích ngay/i }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/traffic?domain=vercel.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.getByText("Lượt truy cập theo tháng")).toBeInTheDocument();
    expect(screen.getByText("Nguồn traffic")).toBeInTheDocument();
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getAllByText("vercel").length).toBeGreaterThan(0);
    expect(screen.getByText("chatgpt.com")).toBeInTheDocument();
    expect(screen.getByText("31.8%")).toBeInTheDocument();
    expect(screen.getByText("7 phút 09 giây")).toBeInTheDocument();
    expect(screen.getByText("CPC (USD/click)")).toBeInTheDocument();
    expect(screen.getByText("Giá trị traffic (USD/tháng)")).toBeInTheDocument();
    expect(container.querySelectorAll(".responsive-table")).toHaveLength(4);
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
    expect(container.querySelectorAll("td[data-label]").length).toBeGreaterThan(0);
  });

  it("mở phần giải thích ý nghĩa và thông số của từng bảng", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => trafficFixture }),
    );

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    const monthlyInfoButton = await screen.findByRole("button", {
      name: "Giải thích bảng Lượt truy cập theo tháng",
    });
    expect(monthlyInfoButton).toHaveAttribute("aria-expanded", "false");

    await user.click(monthlyInfoButton);
    expect(monthlyInfoButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[calc(100dvh-2rem)]", "overflow-y-auto");
    expect(screen.getByText(/một người có thể tạo nhiều lượt truy cập/i)).toBeInTheDocument();
    expect(screen.getByText(/chưa có tháng trước để so sánh/i)).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Đóng giải thích bảng Lượt truy cập theo tháng" })[1],
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Giải thích bảng Từ khóa hàng đầu" }),
    );
    expect(screen.getByText(/không phải lượt click vào website/i)).toBeInTheDocument();
    expect(screen.getByText(/chi phí quảng cáo ước tính cho một lượt click/i)).toBeInTheDocument();
  });

  it("hiển thị lỗi từ API", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: "insufficient_credits", message: "Tài khoản TabAPI không đủ credits." } }),
      }),
    );

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản TabAPI không đủ credits.");
  });

  it("hiển thị empty state khi domain không có coverage", async () => {
    const user = userEvent.setup();
    const emptyFixture = {
      ...trafficFixture,
      overview: {
        global_rank: null,
        country_rank: null,
        visits: null,
        bounce_rate: null,
        pages_per_visit: null,
        time_on_site_seconds: null,
        month: null,
      },
      monthly_visits: [],
      top_keywords: [],
      top_regions: [],
      ai_traffic: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => emptyFixture }));

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Không tìm thấy độ phủ traffic")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu referral từ AI assistants.")).toBeInTheDocument();
  });

  it("gọi /api/seranking và hiển thị phần SE Ranking bên dưới các panel TabAPI sau khi báo cáo tải xong", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith("/api/seranking")) {
          return Promise.resolve({ ok: true, json: async () => serankingFixture });
        }
        return Promise.resolve({ ok: true, json: async () => trafficFixture });
      }),
    );

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/seranking?domain=vercel.com",
      expect.objectContaining({
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: expect.any(AbortSignal),
      }),
    );
    await screen.findByText("534.575");
    expect(screen.getByRole("heading", { level: 2, name: "SEO & quảng cáo trả phí (SE Ranking)" })).toBeInTheDocument();
  });

  it("giữ nguyên báo cáo TabAPI và hiển thị alert của phần SE Ranking khi yêu cầu SE Ranking thất bại", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith("/api/seranking")) {
          return Promise.reject(new Error("mạng lỗi"));
        }
        return Promise.resolve({ ok: true, json: async () => trafficFixture });
      }),
    );

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(screen.getByText("Lượt truy cập theo tháng")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu SE Ranking lúc này.");
  });
});
