"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

async function signInWithTelegram(initData: string) {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const response = await fetch("/api/telegram/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!response.ok) return;

  const { tokenHash } = (await response.json()) as { tokenHash?: string };
  if (!tokenHash) return;
  await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
}

let isInitialized = false;

function initMiniApp() {
  const webApp = getWebApp();
  if (!webApp || isInitialized) return;
  isInitialized = true;

  document.documentElement.classList.add("tg-mini-app");
  webApp.ready();
  webApp.expand();
  void signInWithTelegram(webApp.initData);
}

export default function TelegramMiniApp() {
  const router = useRouter();
  const pathname = usePathname();

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
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onReady={initMiniApp}
    />
  );
}
