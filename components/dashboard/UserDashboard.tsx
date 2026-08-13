"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFantasy } from "@/context/FantasyContext";
import { supabase } from "@/lib/supabaseClient";
import {
  computeAllSquadResults,
  SquadResult,
  SquadPlayerResult,
} from "@/lib/squadPoints";
import { formatFantasyWeekName } from "@/lib/fantasyWeeks";

type Rank = { place: number; total: number };

// Живой обратный отсчёт до блокировки состава. Date.now() нельзя дёргать
// прямо в теле рендера (impure), поэтому текущее время живёт в state и
// обновляется по таймеру — как и isTimeLocked в FantasyContext.
function useCountdown(targetIso: string | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!targetIso) {
      queueMicrotask(() => setLabel(null));
      return;
    }

    const target = targetIso;

    function tick() {
      const diffMs = new Date(target).getTime() - Date.now();
      const clamped = Math.max(0, diffMs);
      const totalSeconds = Math.floor(clamped / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setLabel(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return label;
}

export default function UserDashboard({ userId }: { userId: string }) {
  const { round, spent, budget, isSquadLoading } = useFantasy();
  const countdown = useCountdown(round?.starts_at);

  const [tourNumber, setTourNumber] = useState<number | null>(null);
  const [previousResult, setPreviousResult] = useState<SquadResult | null>(null);
  const [previousRank, setPreviousRank] = useState<Rank | null>(null);
  const [overallRank, setOverallRank] = useState<Rank | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoadingStats(true);

      const allResults = await computeAllSquadResults();
      const now = Date.now();

      const myCompletedResults = allResults
        .filter(
          (r) => r.userId === userId && now >= new Date(r.weekEndsAt).getTime()
        )
        .sort((a, b) => (a.weekStartsAt < b.weekStartsAt ? 1 : -1));

      const myPrevious = myCompletedResults[0] ?? null;
      setPreviousResult(myPrevious);

      if (myPrevious) {
        const sameWeekRanked = allResults
          .filter((r) => r.weekId === myPrevious.weekId)
          .sort((a, b) => b.totalPoints - a.totalPoints);
        const place = sameWeekRanked.findIndex((r) => r.userId === userId) + 1;
        setPreviousRank(place > 0 ? { place, total: sameWeekRanked.length } : null);
      } else {
        setPreviousRank(null);
      }

      const totalsByUser = new Map<string, number>();
      allResults.forEach((r) => {
        totalsByUser.set(r.userId, (totalsByUser.get(r.userId) ?? 0) + r.totalPoints);
      });
      const overallRanked = Array.from(totalsByUser.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      const myIndex = overallRanked.findIndex(([id]) => id === userId);
      setOverallRank(
        myIndex >= 0 ? { place: myIndex + 1, total: overallRanked.length } : null
      );

      setIsLoadingStats(false);
    }

    load();
  }, [userId]);

  useEffect(() => {
    if (!round) {
      queueMicrotask(() => setTourNumber(null));
      return;
    }

    let cancelled = false;

    // Порядковый номер тура — сколько фэнтези-недель вообще было создано
    // к моменту начала текущей (недели создаются лениво при первом
    // заходе, так что это приблизительная, но обычно точная нумерация).
    async function loadOrdinal() {
      const { count } = await supabase
        .from("fantasy_weeks")
        .select("id", { count: "exact", head: true })
        .lte("starts_at", round!.starts_at);

      if (!cancelled) setTourNumber(count ?? null);
    }

    loadOrdinal();
    return () => {
      cancelled = true;
    };
  }, [round]);

  const bestPlayer = (previousResult?.players ?? []).reduce<
    SquadPlayerResult | null
  >((best, p) => (!best || p.points > best.points ? p : best), null);

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="mb-6 border rounded-xl p-6 bg-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-gray-500 text-sm">
            {round ? formatFantasyWeekName(round.starts_at) : "Тур"}
            {tourNumber !== null && ` · Тур ${tourNumber}`}
          </p>
          {round ? (
            <>
              <p className="text-sm text-gray-500 mt-2">До блокировки:</p>
              <p className="text-3xl font-bold tabular-nums">
                {countdown ?? "—:—:—"}
              </p>
            </>
          ) : (
            <p className="text-gray-400 mt-2">Не удалось определить активный тур</p>
          )}
        </div>
        <Link
          href="/team"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
        >
          Собрать команду
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">Моя команда</h2>
          {isLoadingStats ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : previousResult ? (
            <p className="text-3xl font-bold text-blue-600">
              {previousResult.totalPoints.toFixed(1)} FP
            </p>
          ) : (
            <p className="text-gray-400">Ещё нет результатов</p>
          )}
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">Предыдущий тур</h2>
          {isLoadingStats ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : previousRank ? (
            <p className="text-3xl font-bold">
              #{previousRank.place}{" "}
              <span className="text-lg text-gray-400 font-normal">
                из {previousRank.total}
              </span>
            </p>
          ) : (
            <p className="text-gray-400">Ещё нет завершённых туров</p>
          )}
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">Бюджет</h2>
          {isSquadLoading ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : (
            <p className="text-3xl font-bold">
              {spent}{" "}
              <span className="text-lg text-gray-400 font-normal">/ {budget}</span>
            </p>
          )}
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">🔥 Лучший игрок</h2>
          {isLoadingStats ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : bestPlayer ? (
            <p className="text-lg font-bold">
              {bestPlayer.fullName}{" "}
              <span className="text-blue-600">
                — {bestPlayer.points.toFixed(1)} FP
              </span>
            </p>
          ) : (
            <p className="text-gray-400">Ещё нет данных</p>
          )}
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm sm:col-span-2">
          <h2 className="font-bold mb-3">📊 Моя позиция</h2>
          {isLoadingStats ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : overallRank ? (
            <p className="text-3xl font-bold">
              {overallRank.place} место{" "}
              <span className="text-lg text-gray-400 font-normal">
                из {overallRank.total}
              </span>
            </p>
          ) : (
            <p className="text-gray-400">
              Пока нет очков — сыграйте первый тур, чтобы попасть в рейтинг
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
