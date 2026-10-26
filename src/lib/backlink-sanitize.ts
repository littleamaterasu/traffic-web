const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function capString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(INVISIBLE_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const characters = Array.from(cleaned);
  return characters.length > max ? characters.slice(0, max).join("") : cleaned;
}

export function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function clampCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

export function safeHttpUrl(value: unknown, maxChars = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function extractHostname(value: unknown): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "")
    .slice(0, 253);
  return hostname || null;
}

export function displayPath(value: unknown, max = 80): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  const path = `${parsed.pathname || "/"}${parsed.search}`;
  return path.length > max ? `${path.slice(0, max - 1)}…` : path;
}

export function domainInitial(hostname: string | null | undefined): string {
  const match = hostname?.match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : "?";
}
