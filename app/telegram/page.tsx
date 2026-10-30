"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";

export default function TelegramPage() {
  const { user, isLoading } = useUser();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function createLink() {
    setError(null);
    setIsCreating(true);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      setError("Сессия истекла. Войдите в аккаунт и попробуйте снова.");
      setIsCreating(false);
      return;
    }

    try {
      const response = await fetch("/api/telegram/link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const body = (await response.json()) as { link?: string; error?: string };
      if (!response.ok || !body.link) {
        throw new Error(body.error ?? "Не удалось создать ссылку привязки.");
      }
      setLink(body.link);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось создать ссылку привязки."
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) return <p className="p-8">Загрузка...</p>;

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-4">Telegram-бот ABL Fantasy</h1>
        <p className="text-gray-600 mb-6">Войдите на сайт, чтобы привязать аккаунт.</p>
        <Link
          href="/login"
          className="inline-block bg-abl-600 hover:bg-abl-700 text-white font-semibold px-6 py-3 rounded-lg"
        >
          Войти
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-4">Telegram-бот ABL Fantasy</h1>
      <p className="text-gray-600 mb-4">
        Привяжите Telegram, чтобы смотреть свои результаты и получать уведомления
        о блокировке состава, расписании матчей и результатах туров.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Ссылка действует 10 минут и может быть использована только один раз.
        Уведомления выключены, пока вы не включите их командой /notify в боте.
      </p>

      {link ? (
        <a
          href={link}
          className="inline-block bg-abl-600 hover:bg-abl-700 text-white font-semibold px-6 py-3 rounded-lg"
        >
          Продолжить в Telegram
        </a>
      ) : (
        <button
          type="button"
          onClick={createLink}
          disabled={isCreating}
          className="bg-abl-600 hover:bg-abl-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg"
        >
          {isCreating ? "Создаём ссылку..." : "Привязать Telegram"}
        </button>
      )}

      {error && <p role="alert" className="text-red-600 mt-4">{error}</p>}

      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-2">Mini App</h2>
        <p className="text-gray-600 mb-4">
          После настройки бота команда /app откроет вашу fantasy-команду прямо
          внутри Telegram.
        </p>
        <Link href="/team" className="text-abl-600 hover:underline">
          Открыть команду на сайте
        </Link>
      </div>
    </main>
  );
}
