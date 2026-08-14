"use client";

import { useEffect, useState } from "react";
import { computeAllSquadResults, SquadResult } from "@/lib/squadPoints";
import { formatFantasyWeekName } from "@/lib/fantasyWeeks";

type DisplayResult = SquadResult & { isCompleted: boolean };

export default function RoundResults({ userId }: { userId: string }) {
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const all = await computeAllSquadResults();
      const now = Date.now();
      setResults(
        all
          .filter((r) => r.userId === userId)
          .map((r) => ({ ...r, isCompleted: now >= new Date(r.weekEndsAt).getTime() }))
          .sort((a, b) => (a.weekStartsAt < b.weekStartsAt ? 1 : -1))
      );
      setIsLoading(false);
    }

    load();
  }, [userId]);

  if (isLoading) {
    return <p className="text-gray-500">Загрузка результатов...</p>;
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold mb-4">Результаты по турам</h2>
      <div className="space-y-4">
        {results.map((result) => {
          return (
            <div
              key={result.squadId}
              className="border rounded-xl p-5 bg-white shadow-sm"
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-bold">
                    {formatFantasyWeekName(result.weekStartsAt)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {result.isCompleted ? "Тур завершён" : "Тур идёт"}
                  </p>
                </div>
                <p className="text-2xl font-bold text-abl-600">
                  {result.totalPoints.toFixed(1)}
                </p>
              </div>
              <ul className="text-sm divide-y">
                {result.players.map((p) => (
                  <li
                    key={p.playerId}
                    className="py-1.5 flex justify-between items-center"
                  >
                    <span>
                      {p.fullName}
                      {p.isCaptain && (
                        <span className="ml-2 text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                          ×2
                        </span>
                      )}
                    </span>
                    <span className="font-medium">{p.points.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
