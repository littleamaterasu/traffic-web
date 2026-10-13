"use client";

import { useMemo, useState } from "react";
import { EmptyCell, MetricCard, Panel } from "@/components/panel";
import type { PanelInfo } from "@/components/panel";
import {
  ACTIVE_WINDOW_DAYS,
  getTimelineBar,
  getTimelineRange,
  groupByAdvertiser,
  isActive,
  isLongRunning,
  LONG_RUNNING_DAYS,
  summarizeAds,
} from "@/lib/ads-insights";
import type { AdCreative, AdDetail, AdsResponse } from "@/types/ads";
import type { ApiErrorBody } from "@/types/traffic";

const FORMAT_LABELS: Record<string, string> = {
  text: "Văn bản",
  image: "Hình ảnh",
  video: "Video",
  unknown: "Khác",
};

const FORMAT_COLORS: Record<string, string> = {
  text: "bg-[#ffdb1f]",
  image: "bg-[#b8f5cf]",
  video: "bg-[#ffb3c7]",
  unknown: "bg-[#f0ebd5]",
};

const ADS_INFO = {
  summary: "Tổng hợp các creative quảng cáo Google mà Ads Transparency Center ghi nhận cho tên miền này: ai quảng cáo, định dạng nào, trông như thế nào và chạy trong khoảng thời gian nào.",
  metrics: [
    { label: "Creative", meaning: "Một bản quảng cáo cụ thể (một ảnh, video hoặc quảng cáo văn bản). Một chiến dịch thường có nhiều creative vì có nhiều kích thước và biến thể." },
    { label: "Nhà quảng cáo", meaning: "Số nhà quảng cáo khác nhau đứng sau các creative; có thể là chính chủ website hoặc một bên khác (affiliate, đại lý) quảng cáo cho domain đó." },
    { label: "Đang chạy", meaning: `Creative có lần hiển thị gần nhất trong ${ACTIVE_WINDOW_DAYS} ngày qua.` },
    { label: "Chạy lâu", meaning: `Creative được hiển thị từ ${LONG_RUNNING_DAYS} ngày trở lên; chạy bền thường là dấu hiệu creative hiệu quả.` },
    { label: "Timeline", meaning: "Mỗi thanh là khoảng từ lần hiển thị đầu đến gần nhất của một creative, trên cùng một trục thời gian." },
    { label: "Chi tiết", meaning: "Tên sản phẩm trong quảng cáo và các quốc gia đang hiển thị. Mỗi lần xem tốn một lượt gọi SerpApi." },
  ],
  note: "Thống kê chỉ tính trên các creative đã tải, bấm “Tải thêm” để mở rộng mẫu. Ảnh chỉ có ở một phần creative; video và một số quảng cáo ảnh chỉ xem được trên Google. Nhà quảng cáo khác tên store chỉ là gợi ý cần kiểm tra thêm. Mỗi lần tải một trang tốn một lượt gọi SerpApi.",
} satisfies PanelInfo;

const buttonClass =
  "border-[3px] border-[#171710] bg-[#171710] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#fff8dc] shadow-[4px_4px_0_#ff7139] transition-transform hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70";

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    throw new Error(typeof body === "object" && body && "error" in body ? body.error.message : fallback);
  }
  return body as T;
}

function formatLabel(format: string | null): string {
  return FORMAT_LABELS[format ?? "unknown"] ?? format ?? "Khác";
}

function FormatMix({ formats }: { formats: Record<string, number> }) {
  const entries = Object.entries(formats).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;

  return (
    <div>
      <div className="flex h-4 w-full border-2 border-[#171710]" role="img" aria-label="Cơ cấu định dạng">
        {entries.map(([format, count]) => (
          <div
            key={format}
            className={FORMAT_COLORS[format] ?? "bg-[#f0ebd5]"}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs font-bold">
        {entries.map(([format, count]) => `${formatLabel(format)} ${count}`).join(" · ")}
      </p>
    </div>
  );
}

function StatusBadge({ creative, now }: { creative: AdCreative; now: number }) {
  const active = isActive(creative, now);
  return (
    <span className="flex flex-wrap gap-1">
      <span
        title={active ? `Còn hiển thị trong ${ACTIVE_WINDOW_DAYS} ngày gần đây` : `Không hiển thị trong ${ACTIVE_WINDOW_DAYS} ngày gần đây`}
        className={`border-2 border-[#171710] px-1.5 py-0.5 text-[10px] font-black uppercase ${active ? "bg-[#b8f5cf]" : "bg-[#f0ebd5]"}`}
      >
        {active ? "Đang chạy" : "Đã dừng"}
      </span>
      {isLongRunning(creative) ? (
        <span
          title={`Đã hiển thị từ ${LONG_RUNNING_DAYS} ngày trở lên`}
          className="border-2 border-[#171710] bg-[#ffdb1f] px-1.5 py-0.5 text-[10px] font-black uppercase"
        >
          Chạy lâu · ≥{LONG_RUNNING_DAYS} ngày
        </span>
      ) : null}
    </span>
  );
}

function TimelineLegend({ range }: { range: NonNullable<ReturnType<typeof getTimelineRange>> }) {
  const start = new Date(range.start).toISOString().slice(0, 10);
  const end = new Date(range.end - 1).toISOString().slice(0, 10);

  return (
    <div className="mb-4 space-y-2 border-2 border-[#171710] bg-[#f0ebd5] p-3 text-xs font-bold leading-relaxed">
      <p className="font-black uppercase">Cách đọc biểu đồ</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Mỗi dòng là <span className="font-black">một creative</span>. Ô dài nằm ngang là toàn bộ khoảng thời gian từ{" "}
          <span className="font-mono">{start}</span> đến <span className="font-mono">{end}</span>.
        </li>
        <li>
          <span className="font-black">Thanh màu</span> cho biết quảng cáo đó chạy vào khoảng nào trong thời gian trên:
          thanh nằm sát bên phải là mới chạy gần đây, thanh càng dài là chạy càng lâu.
        </li>
        <li>
          <span className="font-black">Màu thanh</span> là định dạng:{" "}
          {(["text", "image", "video"] as const).map((format) => (
            <span key={format} className="mr-2 inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-3 border-2 border-[#171710] ${FORMAT_COLORS[format]}`} />
              {FORMAT_LABELS[format]}
            </span>
          ))}
        </li>
        <li>
          <span className="font-black">Đang chạy</span>: có hiển thị trong {ACTIVE_WINDOW_DAYS} ngày gần đây;{" "}
          <span className="font-black">Đã dừng</span>: không còn hiển thị gần đây.{" "}
          <span className="font-black">Chạy lâu</span>: tổng cộng đã hiển thị từ {LONG_RUNNING_DAYS} ngày trở lên,
          thường là dấu hiệu quảng cáo hiệu quả vì nhà quảng cáo chịu trả tiền duy trì.
        </li>
      </ul>
    </div>
  );
}

function Thumbnail({ creative }: { creative: AdCreative }) {
  const [failed, setFailed] = useState(false);

  if (creative.image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh quảng cáo từ domain ngoài, không qua tối ưu của Next
      <img
        src={creative.image}
        alt={`Creative ${creative.ad_creative_id} của ${creative.advertiser}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-24 w-24 shrink-0 border-2 border-[#171710] bg-[#fffdf4] object-contain"
      />
    );
  }

  return (
    <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 border-2 border-dashed border-[#171710] bg-[#f0ebd5] p-1 text-center text-[10px] font-black uppercase leading-tight">
      <span>{formatLabel(creative.format)}</span>
      <span className="font-bold normal-case text-[#5e5b4d]">Không có ảnh xem trước</span>
    </div>
  );
}

function DetailBox({ detail }: { detail: AdDetail }) {
  const items = detail.items.filter((item) => item.snippet || item.image);

  return (
    <div className="mt-3 space-y-3 border-2 border-[#171710] bg-[#fffdf4] p-3 text-xs">
      <p className="font-bold">
        Đơn vị tài trợ: <span className="font-black">{detail.funded_by ?? "—"}</span>
      </p>
      <div>
        <p className="font-black uppercase">Thị trường đang hiển thị</p>
        {detail.regions.length ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {detail.regions.map((region) => (
              <li key={region.name} className="border-2 border-[#171710] bg-[#b8f5cf] px-2 py-0.5 font-bold">
                {region.name}
                {region.last_shown ? <span className="ml-1 font-mono text-[10px]">· {region.last_shown}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-bold text-[#5e5b4d]">Chưa có thông tin khu vực.</p>
        )}
      </div>
      <div>
        <p className="font-black uppercase">Nội dung / sản phẩm trong quảng cáo</p>
        {items.length ? (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <li key={`${index}-${item.snippet ?? item.image}`} className="flex gap-2 border-2 border-[#171710] p-2">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh quảng cáo từ domain ngoài, không qua tối ưu của Next
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 shrink-0 border border-[#171710] object-contain"
                  />
                ) : null}
                <p className="min-w-0 whitespace-pre-line break-words font-bold">{item.snippet ?? "—"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-bold text-[#5e5b4d]">Không có nội dung chi tiết.</p>
        )}
      </div>
    </div>
  );
}

function CreativeRow({
  creative,
  range,
  now,
}: {
  creative: AdCreative;
  range: NonNullable<ReturnType<typeof getTimelineRange>>;
  now: number;
}) {
  const [detail, setDetail] = useState<AdDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bar = getTimelineBar(creative, range);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/ads/detail?advertiser_id=${encodeURIComponent(creative.advertiser_id)}&creative_id=${encodeURIComponent(creative.ad_creative_id)}`,
        { headers: { "ngrok-skip-browser-warning": "true" } },
      );
      setDetail(await readJson<AdDetail>(response, "Không thể lấy chi tiết creative."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lấy chi tiết creative.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="border-b-2 border-[#171710]/20 pb-4 last:border-b-0">
      <div className="flex gap-3">
        <Thumbnail creative={creative} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-black">
              {creative.advertiser || "Không rõ tên"} · {formatLabel(creative.format)}
              {creative.width && creative.height ? (
                <span className="ml-1 font-mono font-bold text-[#5e5b4d]">{creative.width}×{creative.height}</span>
              ) : null}
            </span>
            <StatusBadge creative={creative} now={now} />
          </div>

          <div className="relative mt-2 h-5 border-2 border-[#171710] bg-[#f0ebd5]">
            {bar ? (
              <div
                className={`absolute inset-y-0 border-x-2 border-[#171710] ${FORMAT_COLORS[creative.format ?? "unknown"] ?? "bg-[#f0ebd5]"}`}
                style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                title={`${creative.first_shown} → ${creative.last_shown} (${creative.total_days_shown ?? "?"} ngày)`}
              >
                {bar.width >= 14 && creative.total_days_shown != null ? (
                  <span className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[10px] font-black">
                    {creative.total_days_shown} ngày
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-bold leading-snug">
            Bắt đầu <span className="font-mono">{creative.first_shown ?? "—"}</span> · hiển thị gần nhất{" "}
            <span className="font-mono">{creative.last_shown ?? "—"}</span> · tổng{" "}
            <span className="font-mono">{creative.total_days_shown ?? "—"}</span> ngày hiển thị
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {!detail ? (
              <button
                type="button"
                onClick={() => void loadDetail()}
                disabled={loading}
                className="border-2 border-[#171710] bg-[#fff8dc] px-2 py-1 font-black uppercase shadow-[2px_2px_0_#171710] hover:bg-[#b8f5cf] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Đang tải…" : "Sản phẩm & thị trường (1 lượt)"}
              </button>
            ) : null}
            {creative.details_link ? (
              <a href={creative.details_link} target="_blank" rel="noopener noreferrer" className="font-black underline">
                Xem trên Google ↗
              </a>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="mt-2 border-2 border-[#171710] bg-[#ffb3c7] px-2 py-1 text-xs font-black">{error}</p>
          ) : null}
        </div>
      </div>
      {detail ? <DetailBox detail={detail} /> : null}
    </li>
  );
}

function AdsResults({
  creatives,
  total,
  hasMore,
  loadingMore,
  moreError,
  onLoadMore,
}: {
  creatives: AdCreative[];
  total: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  onLoadMore: () => void;
}) {
  const [now] = useState(() => Date.now());
  const summary = useMemo(() => summarizeAds(creatives, now), [creatives, now]);
  const groups = useMemo(() => groupByAdvertiser(creatives, now), [creatives, now]);
  const range = useMemo(() => getTimelineRange(creatives), [creatives]);
  const timeline = useMemo(
    () => [...creatives].sort((a, b) => (b.last_shown ?? "").localeCompare(a.last_shown ?? "")),
    [creatives],
  );

  return (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Nhà quảng cáo"
          value={String(summary.advertisers)}
          accent="bg-[#ffdb1f]"
          hint="Số bên khác nhau đang chạy quảng cáo cho domain này."
        />
        <MetricCard
          label="Creative đã tải"
          value={`${summary.creatives}${total ? ` / ${total}` : ""}`}
          accent="bg-[#fffdf4]"
          hint="Mỗi creative là một bản quảng cáo (một ảnh, video hoặc dòng chữ). Chỉ tính phần đã tải."
        />
        <MetricCard
          label="Đang chạy"
          value={String(summary.active)}
          accent="bg-[#b8f5cf]"
          hint={`Số creative còn hiển thị trong ${ACTIVE_WINDOW_DAYS} ngày gần đây.`}
        />
        <MetricCard
          label="Chạy lâu nhất"
          value={summary.longest?.total_days_shown != null ? `${summary.longest.total_days_shown} ngày` : "—"}
          accent="bg-[#ffb3c7]"
          hint="Creative được hiển thị nhiều ngày nhất, thường là bản hiệu quả."
        />
      </div>

      <section aria-label="Theo nhà quảng cáo">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider">Theo nhà quảng cáo</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="border-[3px] border-[#171710] bg-[#fffdf4] p-4 shadow-[4px_4px_0_#171710]">
              <h4 className="break-words font-black">{group.name || "Không rõ tên"}</h4>
              <p className="mt-0.5 break-all font-mono text-[11px] font-bold text-[#5e5b4d]">{group.id}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="font-bold uppercase text-[#5e5b4d]">Creative</dt>
                  <dd className="font-mono text-lg font-black">{group.count}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase text-[#5e5b4d]">Đang chạy</dt>
                  <dd className="font-mono text-lg font-black">{group.active}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase text-[#5e5b4d]">Tổng ngày</dt>
                  <dd className="font-mono text-lg font-black">{group.totalDays}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <FormatMix formats={group.formats} />
              </div>
              <p className="mt-2 text-xs font-bold">Gần nhất: <span className="font-mono">{group.lastShown ?? "—"}</span></p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Timeline creative">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-wider">Timeline creative</h3>
          {range ? (
            <span className="font-mono text-xs font-bold">
              {new Date(range.start).toISOString().slice(0, 10)} → {new Date(range.end - 1).toISOString().slice(0, 10)}
            </span>
          ) : null}
        </div>
        {range ? <TimelineLegend range={range} /> : null}
        {range ? (
          <ul className="space-y-4">
            {timeline.map((creative) => (
              <CreativeRow key={creative.ad_creative_id} creative={creative} range={range} now={now} />
            ))}
          </ul>
        ) : (
          <EmptyCell>Các creative chưa có ngày hiển thị để vẽ timeline.</EmptyCell>
        )}
      </section>

      {hasMore ? (
        <div className="flex flex-col items-start gap-2">
          <button type="button" onClick={onLoadMore} disabled={loadingMore} className={buttonClass}>
            {loadingMore ? "Đang tải thêm…" : "Tải thêm creative (1 lượt) →"}
          </button>
          {moreError ? (
            <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">{moreError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdsPanel({ domain }: { domain: string }) {
  const [creatives, setCreatives] = useState<AdCreative[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(pageToken: string | null) {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ domain });
      if (pageToken) query.set("page_token", pageToken);
      const response = await fetch(`/api/ads?${query}`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const body = await readJson<AdsResponse>(response, "Không thể lấy dữ liệu quảng cáo.");

      setCreatives((current) => {
        const known = new Set((current ?? []).map((creative) => creative.ad_creative_id));
        return [...(current ?? []), ...body.creatives.filter((creative) => !known.has(creative.ad_creative_id))];
      });
      setTotal(body.total_results);
      setNextToken(body.next_page_token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lấy dữ liệu quảng cáo.");
    } finally {
      setLoading(false);
    }
  }

  const loadedCount = creatives?.length ?? 0;

  return (
    <Panel
      title="Google Ads Transparency"
      badge={creatives ? `${loadedCount}/${total ?? loadedCount} creative` : "Nguồn: SerpApi"}
      info={ADS_INFO}
    >
      {!creatives ? (
        <div className="flex flex-col items-start gap-3 p-5">
          <button type="button" onClick={() => void load(null)} disabled={loading} className={buttonClass}>
            {loading ? "Đang tải quảng cáo…" : "Tải dữ liệu quảng cáo →"}
          </button>
          {error ? (
            <p role="alert" className="border-2 border-[#171710] bg-[#ffb3c7] px-3 py-2 text-sm font-black">{error}</p>
          ) : null}
        </div>
      ) : creatives.length ? (
        <AdsResults
          creatives={creatives}
          total={total}
          hasMore={Boolean(nextToken)}
          loadingMore={loading}
          moreError={error}
          onLoadMore={() => void load(nextToken)}
        />
      ) : (
        <EmptyCell>Không tìm thấy quảng cáo nào cho tên miền này.</EmptyCell>
      )}
    </Panel>
  );
}
