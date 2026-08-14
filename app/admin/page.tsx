"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateCurrentFantasyWeek } from "@/lib/fantasyWeeks";

type StatCard = {
  label: string;
  href: string;
  count: number | null;
};

type LastSync = {
  division_label: string;
  finished_at: string;
  teams: number;
  players: number;
  matches: number;
  stats: number;
  warnings: number;
} | null;

type LastRound = {
  name: string;
  lock_at: string;
} | null;

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([
    { label: "Команды", href: "/admin/teams", count: null },
    { label: "Игроки", href: "/admin/players", count: null },
    { label: "Матчи", href: "/admin/matches", count: null },
    { label: "Статистика", href: "/admin/matches", count: null },
    { label: "Пользователи", href: "/admin/users", count: null },
  ]);
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [lastRound, setLastRound] = useState<LastRound>(null);
  const [nextLock, setNextLock] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [
        teamsCount,
        playersCount,
        matchesCount,
        statsCount,
        usersCount,
        syncData,
        roundData,
        fantasyWeek,
      ] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact", head: true }),
        supabase.from("players").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase
          .from("player_match_stats")
          .select("match_id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("sync_runs")
          .select("division_label, finished_at, teams, players, matches, stats, warnings")
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("rounds")
          .select("name, lock_at")
          .order("lock_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        getOrCreateCurrentFantasyWeek().catch(() => null),
      ]);

      if (cancelled) return;

      setStats([
        { label: "Команды", href: "/admin/teams", count: teamsCount.count ?? 0 },
        { label: "Игроки", href: "/admin/players", count: playersCount.count ?? 0 },
        { label: "Матчи", href: "/admin/matches", count: matchesCount.count ?? 0 },
        { label: "Статистика", href: "/admin/matches", count: statsCount.count ?? 0 },
        { label: "Пользователи", href: "/admin/users", count: usersCount.count ?? 0 },
      ]);
      setLastSync(syncData.data ?? null);
      setLastRound(roundData.data ?? null);
      setNextLock(fantasyWeek?.starts_at ?? null);
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition"
          >
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <p className="text-3xl font-bold">
              {stat.count === null ? "—" : stat.count.toLocaleString("ru-RU")}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-2">
            Последняя синхронизация
          </h2>
          {isLoading ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : lastSync ? (
            <>
              <p className="font-semibold">{lastSync.division_label}</p>
              <p className="text-gray-500 text-sm mt-1">
                {new Date(lastSync.finished_at).toLocaleString("ru-RU")}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                команды {lastSync.teams} · игроки {lastSync.players} · матчи{" "}
                {lastSync.matches} · статистика {lastSync.stats}
                {lastSync.warnings > 0 && (
                  <span className="text-amber-600">
                    {" "}
                    · предупреждений {lastSync.warnings}
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-gray-400">Синхронизация ещё не запускалась</p>
          )}
          <Link
            href="/admin/import"
            className="inline-block mt-3 text-abl-600 hover:underline text-sm"
          >
            Синхронизировать →
          </Link>
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Последний тур</h2>
          {isLoading ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : lastRound ? (
            <>
              <p className="font-semibold">{lastRound.name}</p>
              <p className="text-gray-500 text-sm mt-1">
                блокировка {new Date(lastRound.lock_at).toLocaleString("ru-RU")}
              </p>
            </>
          ) : (
            <p className="text-gray-400">Туров ещё нет</p>
          )}
          <Link
            href="/admin/rounds"
            className="inline-block mt-3 text-abl-600 hover:underline text-sm"
          >
            Все туры →
          </Link>
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-2">
            Следующий lock состава
          </h2>
          {isLoading ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : nextLock ? (
            <p className="font-semibold">
              {new Date(nextLock).toLocaleString("ru-RU")}
            </p>
          ) : (
            <p className="text-gray-400">Не удалось определить</p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            Общий фэнтези-тур для всех дивизионов (суббота 09:00 МСК)
          </p>
        </div>
      </div>
    </div>
  );
}
