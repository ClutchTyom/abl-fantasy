"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isTelegramLaunch, waitForMiniAppAuth } from "@/lib/miniAppAuth";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let { data } = await supabase.auth.getUser();
      // В Mini App гость сначала проходит автовход — ждём его, чтобы страницы
      // не отправили пользователя на /login раньше времени.
      if (!data.user && isTelegramLaunch()) {
        await waitForMiniAppAuth();
        ({ data } = await supabase.auth.getUser());
      }
      if (cancelled) return;
      setUser(data.user);
      setIsLoading(false);
    }
    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, isLoading };
}
