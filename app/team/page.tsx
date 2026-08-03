"use client";

import { useEffect } from "react";
import {
  useFantasy,
  STARTING_SLOTS,
  BENCH_SLOTS,
  ALL_SLOTS,
  Slot,
} from "@/context/FantasyContext";
import PlayerCard from "@/components/fantasy/PlayerCard";
import RoundResults from "@/components/fantasy/RoundResults";
import { useUser } from "@/lib/useUser";
import { useRouter } from "next/navigation";

const SLOT_LABELS: Record<Slot, string> = {
  PG: "Разыгрывающий (PG)",
  SG: "Атакующий защитник (SG)",
  SF: "Лёгкий форвард (SF)",
  PF: "Тяжёлый форвард (PF)",
  C: "Центровой (C)",
  BENCH1: "Запасной 1",
  BENCH2: "Запасной 2",
  BENCH3: "Запасной 3",
  BENCH4: "Запасной 4",
  BENCH5: "Запасной 5",
};

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed rounded-xl p-6 flex items-center justify-center text-center h-full min-h-[160px]">
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-gray-300 mt-1">Пусто</p>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const {
    squad,
    budget,
    spent,
    remaining,
    captainId,
    setCaptain,
    round,
    isSquadLoading,
    isLocked,
    isSquadComplete,
    isSaving,
    saveError,
    saveSuccess,
    saveSquad,
  } = useFantasy();
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const filledSlots = ALL_SLOTS.filter((slot) => squad[slot]).length;

  if (isLoading || isSquadLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8">
      <h1 className="text-4xl font-bold mb-8">Моя команда</h1>

      <RoundResults userId={user.id} />

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-gray-500 text-sm">Бюджет</p>
            <p className="text-2xl font-bold">{budget}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Потрачено</p>
            <p className="text-2xl font-bold">{spent}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Осталось</p>
            <p
              className={`text-2xl font-bold ${
                remaining < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {remaining}
            </p>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              remaining < 0 ? "bg-red-500" : "bg-blue-600"
            }`}
            style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm">
        <label className="block text-sm font-medium mb-2">
          Капитан (очки ×2)
        </label>
        <select
          value={captainId ?? ""}
          onChange={(e) => setCaptain(e.target.value || null)}
          disabled={isLocked}
          className="border rounded-lg px-4 py-2 w-full max-w-md disabled:opacity-50"
        >
          <option value="">Не выбран</option>
          {ALL_SLOTS.filter((slot) => squad[slot]).map((slot) => (
            <option key={slot} value={squad[slot]!.id}>
              {squad[slot]!.full_name} ({squad[slot]!.position})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          {round ? (
            <p className="font-semibold">
              Сохранение состава на: <span className="text-blue-600">{round.name}</span>
              <span className="text-gray-400 font-normal">
                {" "}
                · блокировка {new Date(round.lock_at).toLocaleString("ru-RU")}
              </span>
            </p>
          ) : (
            <p className="text-gray-500">
              Нет активного тура для сохранения (создай через админ-панель или SQL)
            </p>
          )}
          <p
            className={`text-sm mt-1 ${
              isSquadComplete ? "text-gray-500" : "text-amber-600"
            }`}
          >
            Заполнено слотов: {filledSlots} из {ALL_SLOTS.length}
            {!isSquadComplete && " — нужно заполнить все, чтобы сохранить"}
          </p>
          {isLocked && (
            <p className="text-amber-600 text-sm mt-1">
              Состав на этот тур заблокирован — изменения недоступны
            </p>
          )}
        </div>

        <div className="text-right">
          <button
            onClick={saveSquad}
            disabled={!round || isSaving || isLocked || remaining < 0 || !isSquadComplete}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            {isSaving ? "Сохраняем..." : "Сохранить состав"}
          </button>
          {saveError && (
            <p className="text-red-600 text-sm mt-2 max-w-xs">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-green-600 text-sm mt-2">Состав сохранён!</p>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Основа</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {STARTING_SLOTS.map((slot) =>
          squad[slot] ? (
            <PlayerCard key={slot} player={squad[slot]!} variant="team" />
          ) : (
            <EmptySlot key={slot} label={SLOT_LABELS[slot]} />
          )
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4">Запас</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENCH_SLOTS.map((slot) =>
          squad[slot] ? (
            <PlayerCard key={slot} player={squad[slot]!} variant="team" />
          ) : (
            <EmptySlot key={slot} label={SLOT_LABELS[slot]} />
          )
        )}
      </div>
    </main>
  );
}
