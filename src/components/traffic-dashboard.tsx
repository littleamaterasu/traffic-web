"use client";

import { FormEvent, useState } from "react";
import {
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

function Panel({
  title,
  badge,
  children,
  className = "",
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-[3px] border-[#171710] bg-[#fffdf4] shadow-[7px_7px_0_#171710] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-[#171710] bg-[#ffdb1f] px-4 py-3 sm:px-5">
        <h2 className="text-lg font-black uppercase tracking-[-0.03em] sm:text-xl">{title}</h2>
        {badge ? (
          <span className="border-2 border-[#171710] bg-[#fff8dc] px-2 py-1 text-xs font-black uppercase">{badge}</span>
        ) : null}
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
        <MetricCard label="Visits / tháng" value={formatCompactNumber(data.overview.visits)} accent="bg-[#ffdb1f]" />
        <MetricCard label="Global rank" value={data.overview.global_rank == null ? "—" : `#${formatNumber(data.overview.global_rank)}`} accent="bg-[#fffdf4]" />
        <MetricCard
          label={`${data.overview.country_rank?.country ?? "Quốc gia"} rank`}
          value={data.overview.country_rank ? `#${formatNumber(data.overview.country_rank.rank)}` : "—"}
          accent="bg-[#b8f5cf]"
        />
        <MetricCard label="Bounce rate" value={formatPercent(data.overview.bounce_rate)} accent="bg-[#ffb3c7]" />
        <MetricCard
          label="Pages / visit"
          value={data.overview.pages_per_visit == null ? "—" : data.overview.pages_per_visit.toFixed(2)}
          accent="bg-[#c8c5ff]"
        />
        <MetricCard label="Avg. visit" value={formatDuration(data.overview.time_on_site_seconds)} accent="bg-[#ffb26b]" />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel title="Lượt truy cập theo tháng" badge="3 tháng">
          {data.monthly_visits.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Tháng</th>
                    <th className="px-5 py-3 text-right">Lượt truy cập</th>
                    <th className="px-5 py-3 text-right">Thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly_visits.map((item, index) => {
                    const previous = data.monthly_visits[index - 1]?.visits;
                    const change = previous ? (item.visits - previous) / previous : null;
                    return (
                      <tr key={item.month} className="border-b-2 border-[#171710] last:border-b-0">
                        <td className="px-5 py-4 font-black">{formatMonth(item.month)}</td>
                        <td className="px-5 py-4 text-right font-mono font-bold">{formatNumber(item.visits)}</td>
                        <td className="px-5 py-4 text-right font-black">
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

        <Panel title="Nguồn traffic" badge={`${sources.length}/13 kênh`}>
          {sources.length ? (
            <div className="divide-y-2 divide-[#171710]">
              {sources.map((source) => (
                <div key={source.key} className="grid grid-cols-[minmax(120px,1fr)_2fr_64px] items-center gap-3 px-4 py-3">
                  <span className="text-sm font-black">{source.label}</span>
                  <div className="h-5 border-2 border-[#171710] bg-[#f0ebd5]" aria-hidden="true">
                    <div className="h-full bg-[#ff7139]" style={{ width: `${Math.min((source.value ?? 0) * 100, 100)}%` }} />
                  </div>
                  <span className="text-right font-mono text-sm font-bold">{formatPercent(source.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCell />
          )}
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Quốc gia hàng đầu">
          {data.top_regions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Quốc gia</th>
                    <th className="px-5 py-3 text-right">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_regions.map((region) => (
                    <tr key={region.country} className="border-b-2 border-[#171710] last:border-b-0">
                      <td className="px-5 py-4 font-bold">
                        <span className="mr-3 border-2 border-[#171710] bg-[#b8f5cf] px-2 py-1 font-mono text-xs font-black">{region.country}</span>
                        {region.name}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold">{formatPercent(region.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCell />
          )}
        </Panel>

        <Panel title="Từ khóa hàng đầu">
          {data.top_keywords.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                    <th className="px-5 py-3">Từ khóa</th>
                    <th className="px-5 py-3 text-right">Volume</th>
                    <th className="px-5 py-3 text-right">CPC</th>
                    <th className="px-5 py-3 text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_keywords.map((keyword) => (
                    <tr key={keyword.name} className="border-b-2 border-[#171710] last:border-b-0">
                      <td className="px-5 py-4 font-black">{keyword.name}</td>
                      <td className="px-5 py-4 text-right font-mono font-bold">{formatCompactNumber(keyword.volume)}</td>
                      <td className="px-5 py-4 text-right font-mono font-bold">{formatCurrency(keyword.cpc)}</td>
                      <td className="px-5 py-4 text-right font-mono font-bold">{formatCompactNumber(keyword.estimated_value)}</td>
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

      <Panel title="AI assistant referrals" badge="Tỷ trọng trong AI traffic">
        {aiTrends.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#171710] bg-[#f0ebd5] text-xs uppercase tracking-wider">
                  <th className="px-5 py-3">Assistant</th>
                  <th className="px-5 py-3 text-right">Mới nhất</th>
                  <th className="px-5 py-3 text-right">Thay đổi</th>
                  <th className="px-5 py-3">Lịch sử</th>
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
                      <td className="px-5 py-4 font-black">{trend.name}</td>
                      <td className="px-5 py-4 text-right font-mono font-bold">{latest == null ? "—" : `${latest.toFixed(1)}%`}</td>
                      <td className="px-5 py-4 text-right font-mono font-black">
                        {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pt`}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold">
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

export function TrafficDashboard() {
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
              Website intelligence / 3 tháng
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
