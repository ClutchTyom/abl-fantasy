"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/useUser";
import {
  hasValidPrivacyConsent,
  PRIVACY_POLICY_VERSION_LABEL,
} from "@/lib/privacy";

// Блокирующее окно согласия: показывается залогиненному пользователю, у
// которого нет согласия с текущей редакцией политики — например, у аккаунта,
// автоматически созданного при первом запуске Telegram Mini App, или у
// пользователя, согласившегося со старой редакцией.
export default function ConsentGate() {
  const { user } = useUser();
  const pathname = usePathname();
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setNeedsConsent(false));
      return;
    }

    let cancelled = false;
    supabase
      .from("profiles")
      .select("privacy_consent_at")
      .eq("id", user.id)
      .single()
      .then(({ data, error: loadError }) => {
        if (cancelled || loadError || !data) return;
        setNeedsConsent(!hasValidPrivacyConsent(data.privacy_consent_at));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Саму политику нужно дать прочитать до согласия.
  if (!user || !needsConsent || pathname === "/privacy") return null;

  async function accept() {
    if (!user) return;
    setError(null);
    setIsSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ privacy_consent_at: new Date().toISOString() })
      .eq("id", user.id);
    setIsSaving(false);

    if (updateError) {
      setError("Не удалось сохранить согласие. Попробуйте ещё раз.");
      return;
    }
    setNeedsConsent(false);
  }

  async function decline() {
    await supabase.auth.signOut();
    setNeedsConsent(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="consent-title" className="text-xl font-bold text-gray-900">
          Согласие на обработку данных
        </h2>
        <p className="mt-3 text-sm text-gray-700">
          Чтобы продолжить, нужно согласиться на обработку персональных данных:
          никнейма, данных аккаунта и, если вы заходите через Telegram,
          вашего Telegram ID и username. Данные нужны для входа, сохранения
          составов и общего рейтинга.
        </p>
        <p className="mt-3 text-sm text-gray-700">
          Подробности — в{" "}
          <Link href="/privacy" className="text-abl-600 hover:underline">
            политике конфиденциальности
          </Link>{" "}
          (редакция от {PRIVACY_POLICY_VERSION_LABEL}). Согласие можно отозвать,
          написав на bloodybattle777@gmail.com.
        </p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={accept}
            disabled={isSaving}
            className="rounded-xl bg-abl-600 px-4 py-3 font-semibold text-white transition hover:bg-abl-700 disabled:opacity-60"
          >
            {isSaving ? "Сохраняем..." : "Согласен(на)"}
          </button>
          <button
            type="button"
            onClick={decline}
            disabled={isSaving}
            className="rounded-xl px-4 py-3 font-medium text-gray-600 hover:bg-gray-100"
          >
            Не согласен(на), выйти
          </button>
        </div>
      </div>
    </div>
  );
}
