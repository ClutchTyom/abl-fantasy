import { describe, expect, it } from "vitest";
import { nextSaturday9amUtc } from "@/lib/fantasyWeeks";

// Блокировка — суббота 09:00 по Москве (UTC+3) = 06:00 UTC.
const iso = (d: Date) => d.toISOString();

describe("nextSaturday9amUtc", () => {
  it("в понедельник возвращает ближайшую субботу 06:00 UTC", () => {
    // 2026-10-26 — понедельник
    expect(iso(nextSaturday9amUtc(new Date("2026-10-26T12:00:00Z")))).toBe(
      "2026-10-31T06:00:00.000Z"
    );
  });

  it("в субботу до 09:00 по Москве возвращает эту же субботу", () => {
    // 05:59 UTC = 08:59 МСК
    expect(iso(nextSaturday9amUtc(new Date("2026-10-31T05:59:00Z")))).toBe(
      "2026-10-31T06:00:00.000Z"
    );
  });

  it("ровно в 09:00 по Москве уже переносит на следующую неделю", () => {
    expect(iso(nextSaturday9amUtc(new Date("2026-10-31T06:00:00Z")))).toBe(
      "2026-11-07T06:00:00.000Z"
    );
  });

  it("в субботу после 09:00 возвращает следующую субботу", () => {
    expect(iso(nextSaturday9amUtc(new Date("2026-10-31T20:00:00Z")))).toBe(
      "2026-11-07T06:00:00.000Z"
    );
  });

  it("учитывает московскую дату, а не UTC: пятница 22:00 UTC уже суббота по Москве", () => {
    // 2026-10-30 22:00 UTC = 2026-10-31 01:00 МСК (суббота, до 09:00)
    expect(iso(nextSaturday9amUtc(new Date("2026-10-30T22:00:00Z")))).toBe(
      "2026-10-31T06:00:00.000Z"
    );
  });

  it("в воскресенье возвращает субботу через шесть дней", () => {
    expect(iso(nextSaturday9amUtc(new Date("2026-11-01T10:00:00Z")))).toBe(
      "2026-11-07T06:00:00.000Z"
    );
  });
});
