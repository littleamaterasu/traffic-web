"use client";

import { FormEvent, useId, useState } from "react";
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

type PanelInfo = {
  summary: string;
  metrics: Array<{ label: string; meaning: string }>;
  note?: string;
};

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

function InfoButton({ title, info }: { title: string; info: PanelInfo }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Giải thích bảng ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#171710] bg-[#fff8dc] font-serif text-base font-black lowercase leading-none shadow-[2px_2px_0_#171710] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        i
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label={`Đóng giải thích bảng ${title}`}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#171710]/55"
          />
          <div
            id={id}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto border-[3px] border-[#171710] bg-[#fffdf4] p-4 text-left normal-case tracking-normal shadow-[7px_7px_0_#ff7139] sm:max-h-[calc(100dvh-3rem)] sm:p-5"
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#171710] pb-3">
              <h3 id={titleId} className="text-base font-black uppercase leading-tight sm:text-lg">
                Giải thích: {title}
              </h3>
              <button
                type="button"
                aria-label={`Đóng giải thích bảng ${title}`}
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#171710] bg-[#ffb3c7] text-lg font-black leading-none shadow-[2px_2px_0_#171710] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm font-bold leading-relaxed">{info.summary}</p>
            <dl className="mt-3 space-y-2 border-t-2 border-[#171710] pt-3">
              {info.metrics.map((metric) => (
                <div key={metric.label} className="text-xs leading-relaxed sm:text-sm">
                  <dt className="inline font-black">{metric.label}: </dt>
                  <dd className="inline font-semibold">{metric.meaning}</dd>
                </div>
              ))}
            </dl>
            {info.note ? (
              <p className="mt-3 border-l-4 border-[#ff7139] pl-3 text-xs font-bold leading-relaxed">
                Lưu ý: {info.note}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  badge,
  info,
  children,
  className = "",
}: {
  title: string;
  badge?: string;
  info?: PanelInfo;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-[3px] border-[#171710] bg-[#fffdf4] shadow-[7px_7px_0_#171710] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-[#171710] bg-[#ffdb1f] px-4 py-3 sm:px-5">
        <h2 className="text-lg font-black uppercase tracking-[-0.03em] sm:text-xl">{title}</h2>
        <div className="flex max-w-full items-center gap-2">
          {badge ? (
            <span className="max-w-full border-2 border-[#171710] bg-[#fff8dc] px-2 py-1 text-right text-xs font-black uppercase">{badge}</span>
          ) : null}
          {info ? <InfoButton title={title} info={info} /> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyCell({ children = "Chưa có dữ liệu" }: { children?: React.ReactNode }) {
  return <div className="p-6 text-center font-bold text-[#5e5b4d]">{children}</div>;
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`border-[3px] border-[#171710] p-4 shadow-[5px_5px_0_#171710] ${accent}`}>
      <p className="mb-3 text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      <p className="break-words text-2xl font-black tracking-[-0.05em] sm:text-3xl">{value}</p>
    </div>
  );
}

function Results({ data }: { data: TrafficResponse }) {
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
    <div className="mt-10 space-y-8" aria-live="polite">
      <section className="border-[3px] border-[#171710] bg-[#171710] text-[#fff8dc] shadow-[8px_8px_0_#ff7139]">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#ffdb1f]">
              Báo cáo / {formatMonth(data.overview.month)}
            </p>
            <h1 className="break-all text-3xl font-black tracking-[-0.06em] sm:text-5xl">{data.domain}</h1>
            {data.title ? <p className="mt-3 max-w-3xl text-base font-bold text-[#d9d3b8]">{data.title}</p> : null}
          </div>
          <span className="w-fit rotate-[-2deg] border-2 border-[#fff8dc] bg-[#ffdb1f] px-3 py-2 text-xs font-black uppercase text-[#171710]">
            Dữ liệu ước tính
          </span>
        </div>
      </section>

      {!hasCoverage ? (
        <div className="border-[3px] border-[#171710] bg-[#ffb3c7] p-6 text-center shadow-[7px_7px_0_#171710]">
          <p className="text-2xl font-black uppercase">Không tìm thấy độ phủ traffic</p>
          <p className="mt-2 font-bold">TabAPI chưa có đủ dữ liệu cho tên miền này.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
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

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="Lượt truy cập theo tháng" badge="Đơn vị: lượt/tháng" info={PANEL_INFO.monthlyVisits}>
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

        <Panel title="Nguồn traffic" badge={`Tỷ trọng lượt truy cập (%) · ${sources.length}/13 kênh`} info={PANEL_INFO.trafficSources}>
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

      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Quốc gia hàng đầu" badge="Tỷ trọng lượt truy cập (%)" info={PANEL_INFO.topRegions}>
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

        <Panel title="Từ khóa hàng đầu" info={PANEL_INFO.topKeywords}>
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
    </div>
  );
}

export function TrafficDashboard({ trafficMonths = 3 }: { trafficMonths?: number }) {
  const [domain, setDomain] = useState("");
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-8 flex flex-col gap-5 border-b-[5px] border-[#171710] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex rotate-[-2deg] border-[3px] border-[#171710] bg-[#ff7139] px-3 py-2 font-mono text-xs font-black uppercase shadow-[4px_4px_0_#171710]">
              Website intelligence / {trafficMonths} tháng
            </div>
            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.86] tracking-[-0.075em] sm:text-7xl lg:text-8xl">
              Traffic<br />Check<span className="text-[#ff7139]">!</span>
            </h1>
          </div>
          <p className="max-w-sm border-l-[5px] border-[#171710] pl-4 text-sm font-bold leading-relaxed sm:text-base">
            Kiểm tra traffic, thứ hạng và nguồn truy cập của bất kỳ website nào bằng dữ liệu ước tính từ TabAPI.
          </p>
        </header>

        <section className="border-[4px] border-[#171710] bg-[#ffdb1f] p-4 shadow-[9px_9px_0_#171710] sm:p-6 lg:p-8">
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
              className="min-w-0 flex-1 border-[3px] border-[#171710] bg-[#fffdf4] px-4 py-4 text-base font-bold shadow-[4px_4px_0_#171710] placeholder:text-[#777261] disabled:opacity-70 sm:text-lg"
            />
            <button
              type="submit"
              disabled={loading}
              className="border-[3px] border-[#171710] bg-[#171710] px-7 py-4 text-base font-black uppercase tracking-wide text-[#fff8dc] shadow-[4px_4px_0_#ff7139] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70 sm:text-lg"
            >
              {loading ? "Đang phân tích…" : "Phân tích ngay →"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2">
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
          <div className="mt-8 border-[3px] border-[#171710] bg-[#fffdf4] p-5 shadow-[6px_6px_0_#171710]" role="status">
            <div className="loading-stripes h-5 border-2 border-[#171710]" />
            <p className="mt-3 text-center font-black uppercase">Đang gọi dữ liệu traffic…</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 border-[3px] border-[#171710] bg-[#ffb3c7] p-5 shadow-[6px_6px_0_#171710]" role="alert">
            <p className="text-xs font-black uppercase tracking-widest">Có lỗi xảy ra</p>
            <p className="mt-1 text-lg font-black">{error}</p>
          </div>
        ) : null}

        {!data && !loading && !error ? (
          <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Hướng dẫn sử dụng">
            {[
              ["01", "Nhập domain", "Dán tên miền hoặc URL đầy đủ. Hệ thống sẽ tự chuẩn hóa."],
              ["02", "Gọi dữ liệu", "API key chỉ được sử dụng ở backend và không xuất hiện trên trình duyệt."],
              ["03", "Đọc báo cáo", "Xem traffic, rank, nguồn truy cập, quốc gia, từ khóa và AI referrals."],
            ].map(([number, title, description], index) => (
              <article
                key={number}
                className={`border-[3px] border-[#171710] p-5 shadow-[5px_5px_0_#171710] ${index === 1 ? "bg-[#b8f5cf]" : "bg-[#fffdf4]"}`}
              >
                <span className="font-mono text-3xl font-black">{number}</span>
                <h2 className="mt-6 text-xl font-black uppercase">{title}</h2>
                <p className="mt-2 text-sm font-bold leading-relaxed">{description}</p>
              </article>
            ))}
          </section>
        ) : null}

        {data && !loading ? <Results data={data} /> : null}

        <footer className="mt-14 flex flex-col gap-2 border-t-[3px] border-[#171710] py-5 text-xs font-bold uppercase sm:flex-row sm:justify-between">
          <span>Traffic Check / Local dashboard</span>
          <span>Dữ liệu là ước tính — không thay thế analytics first-party</span>
        </footer>
      </div>
    </main>
  );
}
