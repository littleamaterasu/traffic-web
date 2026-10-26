import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trafficFixture } from "@/test/fixture";
import { referringSitesFixture } from "@/test/referring-sites-fixture";
import { trustpilotFixture } from "@/test/trustpilot-fixture";
import { whoisFixture } from "@/test/whois-fixture";
import { TrafficDashboard } from "./traffic-dashboard";

function trafficFetch(payload: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => {
      const url = String(input);
      if (url.startsWith("/api/trustpilot")) return trustpilotFixture;
      if (url.startsWith("/api/whois")) return whoisFixture;
      if (url.startsWith("/api/referring-sites")) return referringSitesFixture;
      return payload;
    },
  }));
}

describe("TrafficDashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hiển thị số tháng lịch sử đã cấu hình", () => {
    render(<TrafficDashboard trafficMonths={6} />);
    expect(screen.getByText("Website intelligence / 6 tháng")).toBeInTheDocument();
  });

  it("tìm kiếm và hiển thị toàn bộ nhóm dữ liệu", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", trafficFetch(trafficFixture));

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
    vi.stubGlobal("fetch", trafficFetch(trafficFixture));

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
    vi.stubGlobal("fetch", trafficFetch(emptyFixture));

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Không tìm thấy độ phủ traffic")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu referral từ AI assistants.")).toBeInTheDocument();
  });

  it("hiển thị các phần SE Ranking và WHOIS bên dưới panel TabAPI, chỉ tải WHOIS hiện tại và không gọi /api/seranking hay lịch sử WHOIS", async () => {
    const user = userEvent.setup();
    const fetchMock = trafficFetch(trafficFixture);
    vi.stubGlobal("fetch", fetchMock);

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Mẫu quảng cáo & trang đích (SE Ranking)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải mẫu quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải đối thủ quảng cáo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tuổi thọ & lịch sử domain (WhoisXML)" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Tải lịch sử domain" })).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.startsWith("/api/whois?domain=vercel.com"))).toBe(true);
    for (const url of urls) {
      expect(url.startsWith("/api/seranking")).toBe(false);
      expect(url.startsWith("/api/whois/history")).toBe(false);
    }
  });

  it("hiển thị panel Trustpilot, chỉ gọi /api/trustpilot sau khi bấm nút", async () => {
    const user = userEvent.setup();
    const fetchMock = trafficFetch(trafficFixture);
    vi.stubGlobal("fetch", fetchMock);

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Đánh giá Trustpilot" })).toBeInTheDocument();
    const loadButton = screen.getByRole("button", { name: "Tải đánh giá Trustpilot" });
    const trustpilotCalls = () =>
      fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith("/api/trustpilot"));
    expect(trustpilotCalls()).toHaveLength(0);

    await user.click(loadButton);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(trustpilotCalls()).toEqual(["/api/trustpilot?domain=vercel.com"]);
  });

  it("hiển thị panel Tên miền giới thiệu, chỉ gọi /api/referring-sites sau khi bấm Tải backlink", async () => {
    const user = userEvent.setup();
    const fetchMock = trafficFetch(trafficFixture);
    vi.stubGlobal("fetch", fetchMock);

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tên miền giới thiệu" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Tải backlink" })).toHaveLength(1);
    const referringCalls = () =>
      fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith("/api/referring-sites"));
    expect(referringCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Tải backlink" }));

    const list = await screen.findByRole("list", { name: "Top backlink" });
    expect(list).toHaveTextContent("site-1.example.com");
    expect(referringCalls()).toEqual(["/api/referring-sites?domain=vercel.com"]);
  });

  it("lỗi WHOIS không làm hỏng phần còn lại của báo cáo", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).startsWith("/api/whois")
          ? {
              ok: false,
              json: async () => ({
                error: { code: "missing_api_key", message: "Chưa cấu hình WHOIS_API_KEY trên máy chủ." },
              }),
            }
          : {
              ok: true,
              json: async () =>
                String(input).startsWith("/api/trustpilot") ? trustpilotFixture : trafficFixture,
            },
      ),
    );

    render(<TrafficDashboard />);
    await user.click(screen.getByRole("button", { name: "vercel.com" }));

    expect(await screen.findByText("Agentic Infrastructure - Vercel")).toBeInTheDocument();
    const alert = await screen.findByText("Chưa cấu hình WHOIS_API_KEY trên máy chủ.");
    expect(alert.closest('[role="alert"]')).not.toBeNull();
  });
});
