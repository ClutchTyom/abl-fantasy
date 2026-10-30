"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/useUser";

// Отдельное согласие на показ ника и результатов в общем рейтинге. Его можно
// дать и отозвать в любой момент (п. 4.8 политики).
export function useRatingConsent() {
  const { user, isLoading: userLoading } = useUser();
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      queueMicrotask(() => setHasConsent(null));
      return;
    }

    let cancelled = false;
    supabase
      .from("profiles")
      .select("rating_consent_at")
      .eq("id", user.id)
      .single()
      .then(({ data, error: loadError }) => {
        if (cancelled || loadError || !data) return;
        setHasConsent(Boolean(data.rating_consent_at));
      });

    return () => {
      cancelled = true;
    };
  }, [user, userLoading]);

  const setConsent = useCallback(
    async (value: boolean) => {
      if (!user) return;
      setError(null);
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ rating_consent_at: value ? new Date().toISOString() : null })
        .eq("id", user.id);
      setIsSaving(false);

      if (updateError) {
        setError("Не удалось сохранить настройку. Попробуйте ещё раз.");
        return;
      }
      setHasConsent(value);
    },
    [user]
  );

  return { hasConsent, isSaving, error, setConsent };
}
