"use client";

import Link from "next/link";
import { useRatingConsent } from "@/lib/useRatingConsent";

// Отдельная галочка: по умолчанию выключена, не обязательна для игры.
export default function RatingConsentToggle() {
  const { hasConsent, isSaving, error, setConsent } = useRatingConsent();

  if (hasConsent === null) return null;

  return (
    <div className="mb-6 border rounded-xl p-4 bg-white shadow-sm text-sm">
      <label className="flex items-start gap-3 text-gray-700">
        <input
          type="checkbox"
          checked={hasConsent}
          disabled={isSaving}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Разрешаю показывать мой никнейм, очки и место в общем рейтинге
          другим пользователям и в Telegram-боте.{" "}
          <Link href="/privacy" className="text-abl-600 hover:underline">
            Подробнее в политике
          </Link>
          . Без согласия вы участвуете в рейтинге как «Скрытый игрок». Согласие
          можно отозвать в любой момент.
        </span>
      </label>
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
