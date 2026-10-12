import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trafficFixture } from "@/test/fixture";
import { TrafficDashboard } from "./traffic-dashboard";

describe("TrafficDashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
