"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { finishMiniAppAuth } from "@/lib/miniAppAuth";

type TelegramWebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getWebApp(): TelegramWebApp | null {
  const webApp = window.Telegram?.WebApp;
  // Вне Telegram SDK создаёт объект с пустым initData.
  return webApp && webApp.initData ? webApp : null;
}

// Возвращает текст ошибки или null, если вход выполнен.
async function signInWithTelegram(initData: string): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return null;

  const response = await fetch("/api/telegram/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Ошибка сервера (${response.status})`;
  }

  const { tokenHash } = (await response.json()) as { tokenHash?: string };
  if (!tokenHash) return "Сервер не вернул токен входа";

  // Для ссылок входа по почте актуален тип "email"; "magiclink" — прежнее имя.
  let { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" }));
  }
  return error ? error.message : null;
}

let isInitialized = false;

function initMiniApp() {
  const webApp = getWebApp();
  if (!webApp || isInitialized) return;
  isInitialized = true;

  document.documentElement.classList.add("tg-mini-app");
  webApp.ready();
  webApp.expand();
  signInWithTelegram(webApp.initData)
    .then((message) => {
      if (message) {
        console.error("[TelegramMiniApp] sign-in failed:", message);
        window.dispatchEvent(new CustomEvent("tg-signin-error", { detail: message }));
        return;
      }
      window.dispatchEvent(new Event("tg-signed-in"));
    })
    .catch((error) => console.error("[TelegramMiniApp] sign-in error:", error))
    .finally(finishMiniAppAuth);
}

export default function TelegramMiniApp() {
  const router = useRouter();
  const pathname = usePathname();
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: Event) =>
      setSignInError((event as CustomEvent<string>).detail);
    // Если пользователь уже оказался на экране входа — отправляем в игру.
    const onSignedIn = () => {
      if (["/login", "/register"].includes(window.location.pathname)) {
        router.replace("/team");
      }
    };
    window.addEventListener("tg-signin-error", onError);
    window.addEventListener("tg-signed-in", onSignedIn);
    return () => {
      window.removeEventListener("tg-signin-error", onError);
      window.removeEventListener("tg-signed-in", onSignedIn);
    };
  }, [router]);

  useEffect(() => {
    initMiniApp();
  }, []);

  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp) return;

    if (pathname === "/") {
      webApp.BackButton.hide();
      return;
    }
    const goBack = () => router.back();
    webApp.BackButton.show();
    webApp.BackButton.onClick(goBack);
    return () => webApp.BackButton.offClick(goBack);
  }, [pathname, router]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={initMiniApp}
      />
      {signInError && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-40 bg-red-600 p-3 text-center text-sm text-white"
        >
          Не удалось войти через Telegram: {signInError}
        </div>
      )}
    </>
  );
}
