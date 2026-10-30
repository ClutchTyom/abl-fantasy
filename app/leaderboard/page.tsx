"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";
import { computeAllSquadResults } from "@/lib/squadPoints";
import { useFantasy } from "@/context/FantasyContext";
import { useHalls } from "@/lib/useHalls";
import { publicDisplayName } from "@/lib/ratingConsent";
import { useRatingConsent } from "@/lib/useRatingConsent";

type LeaderboardRow = {
  userId: string;
  username: string;
  hallId: string | null;
  totalPoints: number;
  roundsPlayed: number;
};

export default function LeaderboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { hallId: myHallId } = useFantasy();
  const { halls } = useHalls();
  const ratingConsent = useRatingConsent();
  // null — вкладка ещё не выбрана вручную: по умолчанию показываем зал
  // пользователя, а если зал не выбран — все залы.
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const results = await computeAllSquadResults();

        const totalsByUser = new Map<
          string,
          { totalPoints: number; roundsPlayed: number }
        >();

        results.forEach((r) => {
          const current = totalsByUser.get(r.userId) ?? {
            totalPoints: 0,
            roundsPlayed: 0,
          };
          current.totalPoints += r.totalPoints;
          current.roundsPlayed += 1;
          totalsByUser.set(r.userId, current);
        });

        const userIds = Array.from(totalsByUser.keys());

        const { data: profiles, error: profilesError } = userIds.length
          ? await supabase.rpc("public_profiles", { p_ids: userIds })
          : { data: [], error: null };
        if (profilesError) {
          throw new Error(`Не удалось загрузить профили: ${profilesError.message}`);
        }

        const profileById = new Map(
          (
            (profiles ?? []) as {
              id: string;
              display_name: string | null;
              hall_id: string | null;
            }[]
          ).map((p) => [p.id, p])
        );

        const leaderboard = userIds
          .map((userId) => {
            const totals = totalsByUser.get(userId)!;
            return {
              userId,
              // display_name приходит null, если участник не дал отдельного
              // согласия на распространение ника (раздел 4 политики).
              username: publicDisplayName(
                profileById.get(userId)?.display_name,
                Boolean(profileById.get(userId)?.display_name)
              ),
              hallId: profileById.get(userId)?.hall_id ?? null,
              totalPoints: totals.totalPoints,
              roundsPlayed: totals.roundsPlayed,
            };
          })
          .sort((a, b) => b.totalPoints - a.totalPoints);

        setRows(leaderboard);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить рейтинг."
        );
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  if (userLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  const activeTab = selectedTab ?? myHallId ?? "ALL";
  const visibleRows =
    activeTab === "ALL" ? rows : rows.filter((row) => row.hallId === activeTab);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-8">
      <h1 className="text-4xl font-bold mb-6">Рейтинг</h1>

      {ratingConsent.hasConsent === false && (
        <div className="mb-6 border border-abl-200 rounded-xl p-4 bg-abl-50 text-abl-800 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>
            Вы показаны в рейтинге как «Скрытый игрок». Разрешите показ
            никнейма, очков и места, чтобы другие видели ваше имя.
          </span>
          <button
            type="button"
            disabled={ratingConsent.isSaving}
            onClick={() => ratingConsent.setConsent(true)}
            className="bg-abl-600 hover:bg-abl-700 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            Разрешить
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-8" role="tablist">
        {[{ id: "ALL", name: "Все залы" }, ...halls].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            onClick={() => setSelectedTab(tab.id)}
            className={
              tab.id === activeTab
                ? "bg-abl-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition"
            }
          >
            {tab.name}
            {tab.id === myHallId && " ★"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : error ? (
        <p role="alert" className="text-red-600">
          Не удалось загрузить рейтинг: {error}
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-gray-500">
          Пока никто не набрал очков — рейтинг появится, когда завершится
          первый тур с сохранёнными составами.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Место</th>
                <th className="p-3">Игрок</th>
                <th className="p-3">Туров сыграно</th>
                <th className="p-3">Очки</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const place = index + 1;
                const medal =
                  place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : null;
                const initials =
                  row.username
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "?";

                return (
                  <tr
                    key={row.userId}
                    className={`border-b last:border-0 ${
                      row.userId === user.id ? "bg-abl-50" : ""
                    }`}
                  >
                    <td className="p-3 font-bold text-gray-500">
                      {medal ?? place}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium">{row.username}</span>
                        {row.userId === user.id && (
                          <span className="text-xs font-bold bg-abl-100 text-abl-700 px-2 py-0.5 rounded-full">
                            Вы
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-gray-500">{row.roundsPlayed}</td>
                    <td className="p-3 font-bold text-abl-600">
                      {row.totalPoints.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
