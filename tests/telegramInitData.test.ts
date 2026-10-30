import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramInitData } from "@/lib/telegramInitData";

const FAKE_TOKEN = "123456:fake-test-token";
const NOW = 1_700_000_000;

function sign(fields: Record<string, string>, token = FAKE_TOKEN): string {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const baseFields = {
  auth_date: String(NOW - 60),
  query_id: "AAH",
  user: JSON.stringify({ id: 42, username: "tester" }),
};

describe("verifyTelegramInitData", () => {
  it("принимает корректно подписанные данные", () => {
    const user = verifyTelegramInitData(sign(baseFields), FAKE_TOKEN, 86400, NOW);
    expect(user?.id).toBe(42);
  });

  it("отклоняет подпись другим токеном", () => {
    const data = sign(baseFields, "999:other");
    expect(verifyTelegramInitData(data, FAKE_TOKEN, 86400, NOW)).toBeNull();
  });

  it("отклоняет изменённые данные", () => {
    const tampered = sign(baseFields).replace("42", "43");
    expect(verifyTelegramInitData(tampered, FAKE_TOKEN, 86400, NOW)).toBeNull();
  });

  it("отклоняет устаревшие данные", () => {
    const old = sign({ ...baseFields, auth_date: String(NOW - 100_000) });
    expect(verifyTelegramInitData(old, FAKE_TOKEN, 86400, NOW)).toBeNull();
  });

  it("отклоняет данные без hash", () => {
    expect(verifyTelegramInitData("auth_date=1", FAKE_TOKEN, 86400, NOW)).toBeNull();
  });
});
