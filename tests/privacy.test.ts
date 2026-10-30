import { describe, expect, it } from "vitest";
import { hasValidPrivacyConsent } from "@/lib/privacy";

describe("hasValidPrivacyConsent", () => {
  it("требует согласие, если его нет", () => {
    expect(hasValidPrivacyConsent(null)).toBe(false);
  });

  it("считает устаревшим согласие до новой редакции", () => {
    expect(hasValidPrivacyConsent("2026-10-29T23:59:59Z")).toBe(false);
  });

  it("принимает согласие после даты редакции", () => {
    expect(hasValidPrivacyConsent("2026-10-30T10:00:00Z")).toBe(true);
  });

  it("не падает на мусорной дате", () => {
    expect(hasValidPrivacyConsent("not-a-date")).toBe(false);
  });
});
