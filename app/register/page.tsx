"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/authErrors";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreedToPrivacy) {
      setError("Нужно согласиться с политикой конфиденциальности");
      return;
    }

    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          privacy_consent_at: new Date().toISOString(),
        },
      },
    });

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    // Профиль создаётся серверным триггером на auth.users, а не отсюда —
    // так регистрация работает и с включённым подтверждением email (пока
    // письмо не подтверждено, активной сессии нет, и обычный клиентский
    // insert в profiles не прошёл бы RLS).
    if (!data.session) {
      // Подтверждение email включено — аккаунт создан, но войти пока нельзя.
      setNeedsConfirmation(true);
      return;
    }

    router.push("/team");
  }

  if (needsConfirmation) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Почти готово</h1>
          <p className="text-gray-600">
            Мы отправили письмо на <b>{email}</b>. Перейдите по ссылке из
            письма, чтобы подтвердить регистрацию и войти.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Регистрация</h1>
        <p className="text-gray-500 mb-6">
          Создайте аккаунт и соберите свою фэнтези-команду
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Никнейм</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

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

          <div>
            <label className="block mb-1 font-medium">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              required
              className="mt-0.5"
            />
            <span>
              Я согласен(а) с{" "}
              <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                политикой конфиденциальности
              </Link>{" "}
              и даю согласие на обработку персональных данных
            </span>
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg transition disabled:opacity-50"
          >
            {isLoading ? "Регистрируем..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
