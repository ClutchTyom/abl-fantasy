"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/authErrors";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setStatus("ready");
      }
    });

    // Ссылку из письма supabase-js разбирает сам при загрузке страницы
    // (detectSessionInUrl) — тогда и прилетает событие PASSWORD_RECOVERY
    // выше. На случай, если это произошло ДО того, как мы подписались
    // (самый первый рендер), подстраховываемся явной проверкой сессии; а
    // если за пару секунд ничего не случилось — ссылки не было или она
    // устарела.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus((current) => (current === "checking" ? "invalid" : current));
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setIsSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSaving(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    router.push("/team");
  }

  if (status === "checking") {
    return <p className="p-8">Проверяем ссылку...</p>;
  }

  if (status === "invalid") {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">
            Ссылка недействительна
          </h1>
          <p className="text-gray-600">
            Ссылка для сброса пароля устарела или уже была использована.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-6 text-abl-600 font-medium hover:underline"
          >
            Запросить новую ссылку
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Новый пароль</h1>
        <p className="text-gray-500 mb-6">Задайте новый пароль для входа</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Повторите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-abl-600 hover:bg-abl-700 text-white font-semibold px-5 py-3 rounded-lg transition disabled:opacity-50"
          >
            {isSaving ? "Сохраняем..." : "Сохранить пароль"}
          </button>
        </form>
      </div>
    </main>
  );
}
