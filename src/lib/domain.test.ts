import { describe, expect, it } from "vitest";
import { DomainValidationError, normalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it.each([
    ["Example.COM", "example.com"],
    ["https://www.example.com/blog?q=1", "www.example.com"],
    ["http://example.com:8080/path", "example.com"],
    ["  sub.example.co.uk  ", "sub.example.co.uk"],
  ])("chuẩn hóa %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([null, "", "localhost", "127.0.0.1", "http://[::1]", "not-a-domain", "bad_domain.com"])(
    "từ chối input %s",
    (input) => {
      expect(() => normalizeDomain(input)).toThrow(DomainValidationError);
    },
  );
});
