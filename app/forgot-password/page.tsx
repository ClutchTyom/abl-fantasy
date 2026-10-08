"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/authErrors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    // Supabase сам не выдаёт, зарегистрирован ли email (чтобы форму нельзя
    // было использовать для проверки чужих адресов) — единственная ошибка,
    // которую стоит показать по-настоящему, это рейт-лимит на отправку.
    if (resetError && resetError.message.toLowerCase().includes("rate limit")) {
      setError(translateAuthError(resetError.message));
      return;
    }

    setIsSent(true);
  }

  if (isSent) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Проверьте почту</h1>
          <p className="text-gray-600">
            Если такой email зарегистрирован — на него отправлена ссылка для
            сброса пароля. Перейдите по ней, чтобы задать новый пароль.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-abl-600 font-medium hover:underline"
          >
            ← Назад ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Забыли пароль?</h1>
        <p className="text-gray-500 mb-6">
          Укажите email, на него придёт ссылка для сброса пароля
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-abl-600 hover:bg-abl-700 text-white font-semibold px-5 py-3 rounded-lg transition disabled:opacity-50"
          >
            {isLoading ? "Отправляем..." : "Отправить ссылку"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          <Link href="/login" className="text-abl-600 font-medium hover:underline">
            ← Назад ко входу
          </Link>
        </p>
      </div>
    </main>
  );
}
