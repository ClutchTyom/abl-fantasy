"use client";

import Link from "next/link";
import { useUser } from "@/lib/useUser";
import UserDashboard from "@/components/dashboard/UserDashboard";

function MarketingLanding() {
  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20 text-center">
        <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight">
          Собери команду.
          <br />
          Обыграй друзей.
        </h2>

        <p className="mt-6 text-lg sm:text-xl text-gray-600">
          Стань лучшим Fantasy-менеджером Amateur Basketball League.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/team"
            className="inline-block bg-abl-600 hover:bg-abl-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition"
          >
            Начать играть
          </Link>
          <Link
            href="/rules"
            className="inline-block text-abl-600 hover:underline px-4 py-4 text-lg font-medium"
          >
            Правила игры
          </Link>
        </div>
      </section>

      {/* Почему играют */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-center">
          Почему играют в ABL Fantasy?
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h4 className="text-xl font-bold">⚔️ Азарт</h4>
            <p className="mt-2 text-gray-600">
              Собирай лучший состав перед каждым туром и соревнуйся с друзьями.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h4 className="text-xl font-bold">🧠 Докажи экспертность</h4>
            <p className="mt-2 text-gray-600">
              Покажи, что именно ты лучше всех разбираешься в игроках ABL.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h4 className="text-xl font-bold">🏀 Следи за всей лигой</h4>
            <p className="mt-2 text-gray-600">
              Открывай для себя игроков из других команд и следи за их статистикой.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h4 className="text-xl font-bold">🏆 Попади в рейтинг</h4>
            <p className="mt-2 text-gray-600">
              Поднимайся в общем зачете и стань лучшим Fantasy-менеджером сезона.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (user) {
    return <UserDashboard userId={user.id} />;
  }

  return <MarketingLanding />;
}
