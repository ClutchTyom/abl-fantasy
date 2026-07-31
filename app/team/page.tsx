"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import {
  useFantasy,
  STARTING_SLOTS,
  BENCH_SLOTS,
  Slot,
} from "@/context/FantasyContext";
import PlayerCard from "@/components/fantasy/PlayerCard";

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
  const { squad, budget, spent, remaining } = useFantasy();
const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }
  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Моя команда</h1>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm grid grid-cols-3 gap-4 text-center">
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