import { isIP } from "node:net";

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class DomainValidationError extends Error {
  constructor(message = "Vui lòng nhập một tên miền hợp lệ.") {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function normalizeDomain(value: string | null | undefined): string {
  const input = value?.trim();

  if (!input) {
    throw new DomainValidationError("Vui lòng nhập tên miền cần kiểm tra.");
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new DomainValidationError();
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const labels = hostname.split(".");

  if (
    !hostname ||
    hostname === "localhost" ||
    isIP(hostname) !== 0 ||
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !DOMAIN_LABEL.test(label))
  ) {
    throw new DomainValidationError();
  }

  return hostname;
}
