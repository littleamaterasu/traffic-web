import type { AdCreative } from "@/types/ads";

export const ACTIVE_WINDOW_DAYS = 7;
export const LONG_RUNNING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdvertiserGroup {
  id: string;
  name: string;
  count: number;
  active: number;
  totalDays: number;
  formats: Record<string, number>;
  lastShown: string | null;
}

export interface AdsSummary {
  advertisers: number;
  creatives: number;
  active: number;
  formats: Record<string, number>;
  longest: AdCreative | null;
}

export interface TimelineRange {
  start: number;
  end: number;
}

function toMs(date: string | null): number | null {
  if (!date) return null;
  const value = Date.parse(date);
  return Number.isNaN(value) ? null : value;
}

export function isActive(creative: AdCreative, now: number): boolean {
  const last = toMs(creative.last_shown);
  return last != null && last + DAY_MS >= now - ACTIVE_WINDOW_DAYS * DAY_MS;
}

export function isLongRunning(creative: AdCreative): boolean {
  return (creative.total_days_shown ?? 0) >= LONG_RUNNING_DAYS;
}

function countFormat(formats: Record<string, number>, format: string | null) {
  const key = format ?? "unknown";
  formats[key] = (formats[key] ?? 0) + 1;
}

export function summarizeAds(creatives: AdCreative[], now: number): AdsSummary {
  const formats: Record<string, number> = {};
  const advertisers = new Set<string>();
  let longest: AdCreative | null = null;

  for (const creative of creatives) {
    advertisers.add(creative.advertiser_id || creative.advertiser);
    countFormat(formats, creative.format);
    if ((creative.total_days_shown ?? 0) > (longest?.total_days_shown ?? -1)) longest = creative;
  }

  return {
    advertisers: advertisers.size,
    creatives: creatives.length,
    active: creatives.filter((creative) => isActive(creative, now)).length,
    formats,
    longest,
  };
}

export function groupByAdvertiser(creatives: AdCreative[], now: number): AdvertiserGroup[] {
  const groups = new Map<string, AdvertiserGroup>();

  for (const creative of creatives) {
    const id = creative.advertiser_id || creative.advertiser;
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        name: creative.advertiser,
        count: 0,
        active: 0,
        totalDays: 0,
        formats: {},
        lastShown: null,
      };
      groups.set(id, group);
    }

    group.count += 1;
    if (isActive(creative, now)) group.active += 1;
    group.totalDays += creative.total_days_shown ?? 0;
    countFormat(group.formats, creative.format);
    if (creative.last_shown && (!group.lastShown || creative.last_shown > group.lastShown)) {
      group.lastShown = creative.last_shown;
    }
  }

  return [...groups.values()].sort((a, b) => b.count - a.count || b.totalDays - a.totalDays);
}

export function getTimelineRange(creatives: AdCreative[]): TimelineRange | null {
  let start = Infinity;
  let end = -Infinity;

  for (const creative of creatives) {
    const first = toMs(creative.first_shown);
    const last = toMs(creative.last_shown);
    if (first == null || last == null) continue;
    start = Math.min(start, first);
    end = Math.max(end, last + DAY_MS);
  }

  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

export function getTimelineBar(
  creative: AdCreative,
  range: TimelineRange,
): { left: number; width: number } | null {
  const first = toMs(creative.first_shown);
  const last = toMs(creative.last_shown);
  if (first == null || last == null) return null;

  const span = range.end - range.start || DAY_MS;
  const left = ((first - range.start) / span) * 100;
  const width = Math.max(((last + DAY_MS - first) / span) * 100, 1.5);
  return { left, width: Math.min(width, 100 - left) };
}
