"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";
import { computeAllSquadResults } from "@/lib/squadPoints";

type LeaderboardRow = {
  userId: string;
  username: string;
  totalPoints: number;
  roundsPlayed: number;
};

export default function LeaderboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);

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

      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, username").in("id", userIds)
        : { data: [] };

      const usernameById = new Map(
        ((profiles ?? []) as { id: string; username: string }[]).map((p) => [
          p.id,
          p.username,
        ])
      );

      const leaderboard = userIds
        .map((userId) => {
          const totals = totalsByUser.get(userId)!;
          return {
            userId,
            username: usernameById.get(userId) ?? "Без имени",
            totalPoints: totals.totalPoints,
            roundsPlayed: totals.roundsPlayed,
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);

      setRows(leaderboard);
      setIsLoading(false);
    }

    load();
  }, []);

  if (userLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-8">
      <h1 className="text-4xl font-bold mb-8">Общий рейтинг</h1>

      {isLoading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : rows.length === 0 ? (
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
              {rows.map((row, index) => {
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
