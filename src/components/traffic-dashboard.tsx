"use client";

import { FormEvent, useState } from "react";
import { AdsPanel } from "@/components/ads-panel";
import { ReferringSitesPanel } from "@/components/referring-sites-panel";
import { SerankingPanel } from "@/components/seranking-panel";
import { WhoisPanel } from "@/components/whois-panel";
import { TrustpilotPanel } from "@/components/trustpilot-panel";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatDuration,
  formatMonth,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { ApiErrorBody, TrafficResponse, TrafficSources } from "@/types/traffic";

const EXAMPLES = ["vercel.com", "canva.com", "supabase.com"];

const SOURCE_LABELS: Array<[keyof TrafficSources, string]> = [
  ["direct", "Trực tiếp"],
  ["search", "Tìm kiếm"],
  ["search_organic", "Tìm kiếm tự nhiên"],
  ["search_paid", "Tìm kiếm trả phí"],
  ["social", "Mạng xã hội"],
  ["social_organic", "Social tự nhiên"],
  ["social_paid", "Social trả phí"],
  ["referrals", "Giới thiệu"],
  ["paid_referrals", "Giới thiệu trả phí"],
  ["mail", "Email"],
  ["gen_ai", "AI tạo sinh"],
  ["affiliate", "Affiliate"],
  ["other", "Khác"],
];

const PANEL_INFO = {
  monthlyVisits: {
    summary: "Cho biết quy mô traffic ước tính của website theo từng tháng và xu hướng tăng hoặc giảm so với tháng liền trước.",
    metrics: [
      { label: "Tháng", meaning: "Kỳ dữ liệu được dùng để tổng hợp traffic." },
      { label: "Lượt truy cập", meaning: "Tổng số phiên truy cập ước tính trong tháng; một người có thể tạo nhiều lượt truy cập." },
      { label: "So tháng trước", meaning: "Tỷ lệ tăng hoặc giảm của lượt truy cập so với tháng ngay trước đó." },
    ],
    note: "Dấu “—” nghĩa là chưa có tháng trước để so sánh hoặc nguồn dữ liệu chưa đủ.",
  },
  trafficSources: {
    summary: "Thể hiện website nhận traffic từ đâu và tỷ trọng của từng kênh trong tổng lượt truy cập ước tính.",
    metrics: [
      { label: "Trực tiếp", meaning: "Người dùng nhập URL, dùng bookmark hoặc nguồn truy cập không xác định được." },
      { label: "Tìm kiếm", meaning: "Traffic từ công cụ tìm kiếm, gồm tự nhiên và trả phí." },
      { label: "Mạng xã hội", meaning: "Traffic từ các nền tảng social, gồm tự nhiên và trả phí." },
      { label: "Giới thiệu", meaning: "Traffic qua liên kết trên website khác; paid referrals là lượt giới thiệu có trả phí." },
      { label: "Email / AI / Affiliate / Khác", meaning: "Traffic từ email, công cụ AI tạo sinh, đối tác tiếp thị liên kết hoặc các nguồn còn lại." },
      { label: "Tỷ trọng (%)", meaning: "Phần trăm lượt truy cập mà kênh đó đóng góp trong tổng traffic." },
    ],
    note: "Các nhóm tổng và nhóm con có thể cùng xuất hiện, vì vậy không nên cộng tất cả dòng để suy ra 100%.",
  },
  topRegions: {
    summary: "Cho biết những quốc gia mang lại nhiều lượt truy cập nhất cho website.",
    metrics: [
      { label: "Quốc gia", meaning: "Mã quốc gia và tên thị trường nơi người truy cập được ghi nhận." },
      { label: "Tỷ trọng lượt truy cập", meaning: "Phần trăm tổng traffic ước tính đến từ quốc gia đó." },
    ],
    note: "Đây là phân bổ theo vị trí địa lý ước tính, không phải số người dùng duy nhất.",
  },
  topKeywords: {
    summary: "Liệt kê các từ khóa tìm kiếm nổi bật có khả năng đưa người dùng đến website và giá trị quảng cáo ước tính của chúng.",
    metrics: [
      { label: "Từ khóa", meaning: "Cụm từ người dùng nhập trên công cụ tìm kiếm." },
      { label: "Lượt tìm kiếm/tháng", meaning: "Số lần từ khóa được tìm kiếm trung bình trong một tháng, không phải lượt click vào website." },
      { label: "CPC", meaning: "Chi phí quảng cáo ước tính cho một lượt click vào từ khóa, tính bằng USD." },
      { label: "Giá trị traffic", meaning: "Chi phí quảng cáo ước tính cần bỏ ra mỗi tháng để mua lượng traffic tự nhiên tương đương." },
    ],
    note: "Volume, CPC và giá trị traffic đều là số liệu ước tính theo thị trường và thời điểm thu thập.",
  },
  aiReferrals: {
    summary: "Theo dõi tỷ trọng traffic do từng trợ lý AI giới thiệu đến website và sự thay đổi qua các kỳ.",
    metrics: [
      { label: "Assistant", meaning: "Tên nền tảng hoặc trợ lý AI gửi người dùng đến website." },
      { label: "Mới nhất", meaning: "Tỷ trọng của assistant trong tổng AI traffic ở kỳ gần nhất." },
      { label: "Thay đổi", meaning: "Chênh lệch giữa hai kỳ gần nhất, tính bằng điểm phần trăm; không phải phần trăm tăng trưởng." },
      { label: "Lịch sử tỷ trọng", meaning: "Chuỗi tỷ trọng theo tháng để quan sát xu hướng của từng assistant." },
    ],
    note: "Ví dụ từ 20% lên 25% là tăng 5 điểm phần trăm, tương đương mức tăng tương đối 25%.",
  },
} satisfies Record<string, PanelInfo>;

const REPORT_NAVIGATION = [
  { id: "tong-quan", label: "Tổng quan", number: "01" },
  { id: "kenh-xu-huong", label: "Kênh & xu hướng", number: "02" },
  { id: "thi-truong-seo", label: "Thị trường & SEO", number: "03" },
  { id: "quang-cao", label: "Quảng cáo", number: "04" },
  { id: "uy-tin", label: "Uy tín", number: "05" },
  { id: "ten-mien", label: "Tên miền", number: "06" },
] as const;

type DashboardView = "tra-cuu" | (typeof REPORT_NAVIGATION)[number]["id"];

function DashboardNavigation({
  hasReport,
  activeView,
  onNavigate,
  compact = false,
}: {
  hasReport: boolean;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  compact?: boolean;
}) {
  const navigation: ReadonlyArray<{ id: DashboardView; label: string; number: string }> = [
    { id: "tra-cuu", label: "Tra cứu website", number: "00" },
    ...(hasReport ? REPORT_NAVIGATION : []),
  ];

  return (
    <nav role="tablist" aria-label="Điều hướng dashboard" className={compact ? "dashboard-mobile-nav" : "space-y-2"}>
      {navigation.map((item) => {
        const active = item.id === activeView;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${item.id}-panel`}
            onClick={() => onNavigate(item.id)}
            className={
              compact
                ? `dashboard-mobile-nav-item ${active ? "bg-[#ffdb1f]" : "bg-[#fffdf4]"}`
                : `group flex w-full items-center gap-3 border-2 border-[#171710] px-3 py-2.5 text-left text-sm font-black uppercase shadow-[3px_3px_0_#171710] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                    active ? "bg-[#ffdb1f]" : "bg-[#fffdf4]"
                  }`
            }
          >
            <span className="font-mono text-[0.65rem] font-black text-[#5e5b4d]">{item.number}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeading({
  id,
  number,
  eyebrow,
  title,
  description,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="dashboard-section-heading">
      <span className="dashboard-section-number">{number}</span>
      <div className="min-w-0">
        <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#6b6656]">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-2xl font-black uppercase tracking-[-0.045em] sm:text-3xl">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-[#5e5b4d]">{description}</p>
      </div>
    </header>
  );
}

function Results({ data, activeView }: { data: TrafficResponse; activeView: DashboardView }) {
  const hasCoverage =
    data.overview.visits != null ||
    data.monthly_visits.length > 0 ||
    data.top_keywords.length > 0 ||
    data.top_regions.length > 0;

  const aiTrends = data.ai_traffic?.trends ?? [];
  const sources = SOURCE_LABELS.map(([key, label]) => ({ key, label, value: data.traffic_sources[key] }))
    .filter((source) => source.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="mt-8" aria-live="polite">
      {activeView === "tong-quan" ? (
      <section id="tong-quan-panel" role="tabpanel" aria-label="Tổng quan" className="space-y-5">
        <SectionHeading
          id="tong-quan-title"
          number="01"
          eyebrow="Bức tranh nhanh"
          title="Tổng quan hiệu suất"
          description="Các tín hiệu quan trọng nhất để đánh giá quy mô, mức độ tương tác và vị thế của website."
        />
        <div className="border-[3px] border-[#171710] bg-[#171710] text-[#fff8dc] shadow-[8px_8px_0_#ff7139]">
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#ffdb1f]">
              Báo cáo / {formatMonth(data.overview.month)}
            </p>
            <h3 className="break-all text-3xl font-black tracking-[-0.06em] sm:text-5xl">{data.domain}</h3>
            {data.title ? <p className="mt-3 max-w-3xl text-base font-bold text-[#d9d3b8]">{data.title}</p> : null}
          </div>
          <span className="w-fit rotate-[-2deg] border-2 border-[#fff8dc] bg-[#ffdb1f] px-3 py-2 text-xs font-black uppercase text-[#171710]">
            Dữ liệu ước tính
          </span>
          </div>
        </div>

      {!hasCoverage ? (
        <div className="border-[3px] border-[#171710] bg-[#ffb3c7] p-6 text-center shadow-[7px_7px_0_#171710]">
          <p className="text-2xl font-black uppercase">Không tìm thấy độ phủ traffic</p>
          <p className="mt-2 font-bold">TabAPI chưa có đủ dữ liệu cho tên miền này.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Lượt truy cập / tháng"
          value={data.overview.visits == null ? "—" : `${formatCompactNumber(data.overview.visits)} lượt`}
          accent="bg-[#ffdb1f]"
        />
        <MetricCard label="Xếp hạng toàn cầu (vị trí)" value={data.overview.global_rank == null ? "—" : `#${formatNumber(data.overview.global_rank)}`} accent="bg-[#fffdf4]" />
        <MetricCard
          label={`Xếp hạng ${data.overview.country_rank?.country ?? "quốc gia"} (vị trí)`}
          value={data.overview.country_rank ? `#${formatNumber(data.overview.country_rank.rank)}` : "—"}
          accent="bg-[#b8f5cf]"
        />
        <MetricCard label="Tỷ lệ thoát (% phiên)" value={formatPercent(data.overview.bounce_rate)} accent="bg-[#ffb3c7]" />
        <MetricCard
          label="Số trang / phiên"
          value={data.overview.pages_per_visit == null ? "—" : `${data.overview.pages_per_visit.toFixed(2)} trang`}
          accent="bg-[#c8c5ff]"
        />
        <MetricCard label="Thời gian trung bình / phiên" value={formatDuration(data.overview.time_on_site_seconds)} accent="bg-[#ffb26b]" />
      </div>

      <aside className="border-[3px] border-[#171710] bg-[#fffdf4] px-4 py-3 text-xs font-bold leading-relaxed shadow-[4px_4px_0_#171710] sm:text-sm">
        <span className="font-black uppercase">Cách đọc đơn vị:</span>{" "}
        <span><strong>lượt/tháng</strong> là visits ước tính trong tháng; <strong>trang/phiên</strong> là số trang trung bình mỗi lần truy cập; <strong>CPC</strong> là chi phí ước tính cho một click; <strong>điểm %</strong> là chênh lệch giữa hai tỷ lệ phần trăm.</span>
      </aside>
      </section>
      ) : null}

      {activeView === "kenh-xu-huong" ? (
      <section id="kenh-xu-huong-panel" role="tabpanel" aria-label="Kênh và xu hướng" className="space-y-5">
        <SectionHeading
          id="kenh-xu-huong-title"
          number="02"
          eyebrow="Thu hút truy cập"
          title="Kênh & xu hướng"
          description="Theo dõi biến động lượt truy cập và cơ cấu các kênh đang đưa người dùng đến website."
        />
        <div className="grid items-start gap-6 min-[1400px]:grid-cols-2">
          <Panel className="h-full" title="Lượt truy cập theo tháng" badge="Đơn vị: lượt/tháng" info={PANEL_INFO.monthlyVisits}>
          {data.monthly_visits.length ? (
            <div className="responsive-table-wrap">
              <table className="responsive-table text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Tháng</th>
                    <th className="px-5 py-3 text-right">Lượt truy cập (lượt/tháng)</th>
                    <th className="px-5 py-3 text-right">So tháng trước (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly_visits.map((item, index) => {
                    const previous = data.monthly_visits[index - 1]?.visits;
                    const change = previous ? (item.visits - previous) / previous : null;
                    return (
                      <tr key={item.month} className="border-b-2 border-[#171710] last:border-b-0">
                        <td data-label="Tháng" className="px-5 py-4 font-black">{formatMonth(item.month)}</td>
                        <td data-label="Lượt truy cập/tháng" className="px-5 py-4 text-right font-mono font-bold">{formatNumber(item.visits)}</td>
                        <td data-label="So tháng trước" className="px-5 py-4 text-right font-black">
                          {change == null ? "—" : `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCell />
          )}
          </Panel>

          <Panel className="h-full" title="Nguồn traffic" badge={`Tỷ trọng lượt truy cập (%) · ${sources.length}/13 kênh`} info={PANEL_INFO.trafficSources}>
          {sources.length ? (
            <div className="divide-y-2 divide-[#171710]">
              {sources.map((source) => (
                <div key={source.key} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(120px,1fr)_2fr_64px]">
                  <span className="min-w-0 text-sm font-black">{source.label}</span>
                  <div className="order-3 col-span-2 h-5 border-2 border-[#171710] bg-[#f0ebd5] sm:order-none sm:col-span-1" aria-hidden="true">
                    <div className="h-full bg-[#ff7139]" style={{ width: `${Math.min((source.value ?? 0) * 100, 100)}%` }} />
                  </div>
                  <span className="order-2 text-right font-mono text-sm font-bold sm:order-none">{formatPercent(source.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCell />
          )}
        </Panel>
        </div>

        <Panel title="AI assistant referrals" badge="Tỷ trọng trong AI traffic (%)" info={PANEL_INFO.aiReferrals}>
          {aiTrends.length ? (
            <div className="responsive-table-wrap">
              <table className="responsive-table text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Assistant</th>
                    <th className="px-5 py-3 text-right">Mới nhất (%)</th>
                    <th className="px-5 py-3 text-right">Thay đổi (điểm %)</th>
                    <th className="px-5 py-3">Lịch sử tỷ trọng (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {aiTrends.map((trend) => {
                    const sorted = [...trend.history].sort((a, b) => b.date.localeCompare(a.date));
                    const latest = sorted[0]?.value;
                    const previous = sorted[1]?.value;
                    const delta = latest != null && previous != null ? latest - previous : null;
                    return (
                      <tr key={trend.name} className="border-b-2 border-[#171710] last:border-b-0">
                        <td data-label="Assistant" className="px-5 py-4 font-black">{trend.name}</td>
                        <td data-label="Tỷ trọng mới nhất" className="px-5 py-4 text-right font-mono font-bold">{latest == null ? "—" : `${latest.toFixed(1)}%`}</td>
                        <td data-label="Thay đổi (điểm %)" className="px-5 py-4 text-right font-mono font-black">
                          {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pt`}
                        </td>
                        <td data-label="Lịch sử tỷ trọng" data-stack="true" className="px-5 py-4 font-mono text-xs font-bold">
                          {sorted.map((point) => `${point.date.slice(0, 7)}: ${point.value.toFixed(1)}%`).join("  /  ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCell>Chưa có dữ liệu referral từ AI assistants.</EmptyCell>
          )}
          </Panel>
      </section>
      ) : null}

      {activeView === "thi-truong-seo" ? (
      <section id="thi-truong-seo-panel" role="tabpanel" aria-label="Thị trường và SEO" className="space-y-5">
        <SectionHeading
          id="thi-truong-seo-title"
          number="03"
          eyebrow="Khám phá thị trường"
          title="Thị trường & SEO"
          description="Xác định thị trường trọng điểm, chủ đề tìm kiếm và hệ sinh thái website đang liên kết đến domain."
        />
        <div className="grid items-start gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <Panel className="h-full" title="Quốc gia hàng đầu" badge="Tỷ trọng lượt truy cập (%)" info={PANEL_INFO.topRegions}>
          {data.top_regions.length ? (
            <div className="responsive-table-wrap">
              <table className="responsive-table text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Quốc gia</th>
                    <th className="px-5 py-3 text-right">Tỷ trọng lượt truy cập (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_regions.map((region) => (
                    <tr key={region.country} className="border-b-2 border-[#171710] last:border-b-0">
                      <td data-label="Quốc gia" className="px-5 py-4 font-bold">
                        <span className="mr-3 border-2 border-[#171710] bg-[#b8f5cf] px-2 py-1 font-mono text-xs font-black">{region.country}</span>
                        {region.name}
                      </td>
                      <td data-label="Tỷ trọng lượt truy cập" className="px-5 py-4 text-right font-mono font-bold">{formatPercent(region.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCell />
          )}
          </Panel>

          <Panel className="h-full" title="Từ khóa hàng đầu" info={PANEL_INFO.topKeywords}>
          {data.top_keywords.length ? (
            <div className="responsive-table-wrap">
              <table className="responsive-table text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Từ khóa</th>
                    <th className="px-5 py-3 text-right">Lượt tìm kiếm/tháng</th>
                    <th className="px-5 py-3 text-right">CPC (USD/click)</th>
                    <th className="px-5 py-3 text-right">Giá trị traffic (USD/tháng)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_keywords.map((keyword) => (
                    <tr key={keyword.name} className="border-b-2 border-[#171710] last:border-b-0">
                      <td data-label="Từ khóa" className="px-5 py-4 font-black">{keyword.name}</td>
                      <td data-label="Lượt tìm kiếm/tháng" className="px-5 py-4 text-right font-mono font-bold">{formatCompactNumber(keyword.volume)}</td>
                      <td data-label="CPC (USD/click)" className="px-5 py-4 text-right font-mono font-bold">{formatCurrency(keyword.cpc)}</td>
                      <td data-label="Giá trị traffic (USD/tháng)" className="px-5 py-4 text-right font-mono font-bold">{formatCompactCurrency(keyword.estimated_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCell />
          )}
          </Panel>
        </div>
        <ReferringSitesPanel key={`referring-sites-${data.domain}`} domain={data.domain} />
      </section>
      ) : null}

      {activeView === "quang-cao" ? (
      <section id="quang-cao-panel" role="tabpanel" aria-label="Quảng cáo" className="space-y-5">
        <SectionHeading
          id="quang-cao-title"
          number="04"
          eyebrow="Dữ liệu quảng cáo"
          title="Quảng cáo"
          description="Kiểm tra dấu hiệu chạy quảng cáo, mẫu nội dung, trang đích và các đối thủ đang cạnh tranh."
        />
        <div className="space-y-6">
          <AdsPanel key={`ads-${data.domain}`} domain={data.domain} />
          <SerankingPanel key={`seranking-${data.domain}`} domain={data.domain} />
        </div>
      </section>
      ) : null}

      {activeView === "uy-tin" ? (
      <section id="uy-tin-panel" role="tabpanel" aria-label="Uy tín" className="space-y-5">
        <SectionHeading
          id="uy-tin-title"
          number="05"
          eyebrow="Tín hiệu uy tín"
          title="Uy tín thương hiệu"
          description="Đối chiếu tín hiệu đánh giá công khai để hiểu chất lượng trải nghiệm và mức độ tin cậy của thương hiệu."
        />
        <TrustpilotPanel key={`trustpilot-${data.domain}`} domain={data.domain} />
      </section>
      ) : null}

      {activeView === "ten-mien" ? (
      <section id="ten-mien-panel" role="tabpanel" aria-label="Tên miền" className="space-y-5">
        <SectionHeading
          id="ten-mien-title"
          number="06"
          eyebrow="Dữ liệu tên miền"
          title="Hồ sơ tên miền"
          description="Kiểm tra tuổi đời, nhà đăng ký, trạng thái vận hành và lịch sử thay đổi của domain."
        />
        <WhoisPanel key={`whois-${data.domain}`} domain={data.domain} />
      </section>
      ) : null}
    </div>
  );
}

export function TrafficDashboard({ trafficMonths = 3 }: { trafficMonths?: number }) {
  const [domain, setDomain] = useState("");
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("tra-cuu");

  async function search(value: string) {
    const query = value.trim();
    if (!query) {
      setError("Hãy nhập một tên miền để bắt đầu.");
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(`/api/traffic?domain=${encodeURIComponent(query)}`, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
        signal: controller.signal,
      });
      const body = (await response.json()) as TrafficResponse | ApiErrorBody;

      if (!response.ok) {
        throw new Error("error" in body ? body.error.message : "Không thể lấy dữ liệu website.");
      }

      setData(body as TrafficResponse);
      setActiveView("tong-quan");
    } catch (cause) {
      setData(null);
      setError(
        cause instanceof DOMException && cause.name === "AbortError"
          ? "Yêu cầu mất quá nhiều thời gian. Hãy kiểm tra kết nối và thử lại."
          : cause instanceof Error
            ? cause.message
            : "Không thể lấy dữ liệu website.",
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(domain);
  }

  return (
    <div className="dashboard-shell">
      <a href="#noi-dung-chinh" className="dashboard-skip-link">Bỏ qua điều hướng</a>

      <aside className="dashboard-sidebar" aria-label="Thanh bên dashboard">
        <button
          type="button"
          onClick={() => setActiveView("tra-cuu")}
          className="block w-full border-b-[5px] border-[#171710] px-5 py-6 text-left"
        >
          <span className="inline-flex rotate-[-2deg] border-[3px] border-[#171710] bg-[#ff7139] px-2 py-1 font-mono text-[0.65rem] font-black uppercase shadow-[3px_3px_0_#171710]">
            Website intelligence / {trafficMonths} tháng
          </span>
          <span className="mt-5 block text-4xl font-black uppercase leading-[0.82] tracking-[-0.075em]">
            Traffic<br />Check<span className="text-[#ff7139]">!</span>
          </span>
        </button>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
          <p className="mb-3 font-mono text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#6b6656]">
            Không gian làm việc
          </p>
          <DashboardNavigation
            hasReport={Boolean(data && !loading)}
            activeView={activeView}
            onNavigate={setActiveView}
          />
          <div className="mt-auto border-[3px] border-[#171710] bg-[#b8f5cf] p-3 shadow-[4px_4px_0_#171710]">
            <p className="font-mono text-[0.65rem] font-black uppercase tracking-wider">Phạm vi dữ liệu</p>
            <p className="mt-1 text-lg font-black">{trafficMonths} tháng</p>
            <p className="mt-2 text-xs font-bold leading-relaxed">Dữ liệu ước tính, dùng để nghiên cứu và so sánh.</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="dashboard-mobile-header lg:hidden">
          <button
            type="button"
            onClick={() => setActiveView("tra-cuu")}
            className="text-xl font-black uppercase tracking-[-0.06em]"
          >
            Traffic Check<span className="text-[#ff7139]">!</span>
          </button>
          <span className="border-2 border-[#171710] bg-[#b8f5cf] px-2 py-1 font-mono text-[0.65rem] font-black uppercase">
            {trafficMonths} tháng
          </span>
        </header>

        <main id="noi-dung-chinh" className="px-4 py-5 sm:px-6 sm:py-7 xl:px-8 2xl:px-10">
          <div className="mx-auto max-w-[1540px]">
            <header className="dashboard-page-header">
              <div>
                <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[#6b6656]">
                  Không gian nghiên cứu website
                </p>
                <h1 className="mt-2 max-w-4xl text-4xl font-black uppercase leading-[0.92] tracking-[-0.065em] sm:text-5xl xl:text-6xl">
                  Bảng điều khiển nghiên cứu website
                </h1>
              </div>
              <div className="max-w-md border-l-[5px] border-[#171710] pl-4">
                <p className="text-sm font-bold leading-relaxed sm:text-base">
                  Một báo cáo tổng hợp về traffic, thị trường, quảng cáo, uy tín và hồ sơ tên miền.
                </p>
                <span className="mt-3 inline-flex border-2 border-[#171710] bg-[#fffdf4] px-2 py-1 font-mono text-[0.65rem] font-black uppercase shadow-[2px_2px_0_#171710]">
                  {data && !loading ? `Đang xem: ${data.domain}` : "Sẵn sàng tra cứu"}
                </span>
              </div>
            </header>

            <div className="mb-6 lg:hidden">
              <DashboardNavigation
                hasReport={Boolean(data && !loading)}
                activeView={activeView}
                onNavigate={setActiveView}
                compact
              />
            </div>

            {activeView === "tra-cuu" ? (
            <div id="tra-cuu-panel" role="tabpanel" aria-label="Tra cứu website">
            <section className="border-[4px] border-[#171710] bg-[#ffdb1f] p-4 shadow-[8px_8px_0_#171710] sm:p-5 xl:p-6" aria-labelledby="tra-cuu-title">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.16em]">Điểm bắt đầu</p>
                  <h2 id="tra-cuu-title" className="text-xl font-black uppercase tracking-[-0.04em] sm:text-2xl">Tra cứu website</h2>
                </div>
                <p className="text-xs font-bold">Nhập domain hoặc URL đầy đủ</p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
                <label htmlFor="domain" className="sr-only">Tên miền hoặc URL website</label>
                <input
                  id="domain"
                  type="text"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="example.com hoặc https://example.com/blog"
                  autoComplete="url"
                  disabled={loading}
                  className="min-w-0 flex-1 border-[3px] border-[#171710] bg-[#fffdf4] px-4 py-3.5 text-base font-bold shadow-[4px_4px_0_#171710] placeholder:text-[#777261] disabled:opacity-70 sm:text-lg"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="border-[3px] border-[#171710] bg-[#171710] px-7 py-3.5 text-base font-black uppercase tracking-wide text-[#fff8dc] shadow-[4px_4px_0_#ff7139] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
                >
                  {loading ? "Đang phân tích…" : "Phân tích ngay →"}
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-black uppercase">Thử nhanh:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setDomain(example);
                      void search(example);
                    }}
                    className="border-2 border-[#171710] bg-[#fff8dc] px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_#171710] hover:bg-[#b8f5cf] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </section>

            {loading ? (
              <div className="mt-7 border-[3px] border-[#171710] bg-[#fffdf4] p-5 shadow-[6px_6px_0_#171710]" role="status">
                <div className="loading-stripes h-5 border-2 border-[#171710]" />
                <p className="mt-3 text-center font-black uppercase">Đang gọi dữ liệu traffic…</p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-7 border-[3px] border-[#171710] bg-[#ffb3c7] p-5 shadow-[6px_6px_0_#171710]" role="alert">
                <p className="text-xs font-black uppercase tracking-widest">Có lỗi xảy ra</p>
                <p className="mt-1 text-lg font-black">{error}</p>
              </div>
            ) : null}

            {!data && !loading && !error ? (
              <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Hướng dẫn sử dụng">
                {[
                  ["01", "Nhập domain", "Dán tên miền hoặc URL đầy đủ. Hệ thống sẽ tự chuẩn hóa."],
                  ["02", "Gọi dữ liệu", "API key chỉ được sử dụng ở backend và không xuất hiện trên trình duyệt."],
                  ["03", "Đọc báo cáo", "Di chuyển theo từng nhóm: tổng quan, kênh, SEO, quảng cáo, uy tín và tên miền."],
                ].map(([number, title, description], index) => (
                  <article
                    key={number}
                    className={`border-[3px] border-[#171710] p-5 shadow-[5px_5px_0_#171710] ${index === 1 ? "bg-[#b8f5cf]" : "bg-[#fffdf4]"}`}
                  >
                    <span className="font-mono text-3xl font-black">{number}</span>
                    <h2 className="mt-5 text-xl font-black uppercase">{title}</h2>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{description}</p>
                  </article>
                ))}
              </section>
            ) : null}
            </div>
            ) : null}

            {data && !loading && activeView !== "tra-cuu" ? <Results data={data} activeView={activeView} /> : null}

            <footer className="mt-14 flex flex-col gap-2 border-t-[3px] border-[#171710] py-5 text-xs font-bold uppercase sm:flex-row sm:justify-between">
              <span>Traffic Check / Local dashboard</span>
              <span>Dữ liệu là ước tính — không thay thế analytics first-party</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
