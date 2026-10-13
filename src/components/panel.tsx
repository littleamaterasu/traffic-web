"use client";

import { useId, useState } from "react";

export type PanelInfo = {
  summary: string;
  metrics: Array<{ label: string; meaning: string }>;
  note?: string;
};

export function InfoButton({ title, info }: { title: string; info: PanelInfo }) {
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

export function Panel({
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

export function EmptyCell({ children = "Chưa có dữ liệu" }: { children?: React.ReactNode }) {
  return <div className="p-6 text-center font-bold text-[#5e5b4d]">{children}</div>;
}

export function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`border-[3px] border-[#171710] p-4 shadow-[5px_5px_0_#171710] ${accent}`}>
      <p className="mb-3 text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      <p className="break-words text-2xl font-black tracking-[-0.05em] sm:text-3xl">{value}</p>
    </div>
  );
}
