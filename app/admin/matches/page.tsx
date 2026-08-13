"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import MatchRow, { Match } from "@/components/admin/MatchRow";
import { Round } from "@/components/admin/RoundRow";

export default function AdminMatchesPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [matchRoundFilter, setMatchRoundFilter] = useState("ALL");

  async function loadData() {
    setLoadingData(true);

    const roundsData = await fetchAllRows<Round>((from, to) =>
      supabase.from("rounds").select("id, name, status, lock_at").order("lock_at").range(from, to)
    );

    const matchesData = await fetchAllRows<Match>((from, to) =>
      supabase
        .from("matches")
        .select(
          "*, rounds(name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
        )
        .order("starts_at")
        .range(from, to)
    );

    setRounds(roundsData);
    setMatches(matchesData);
    setLoadingData(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, []);

  function handleMatchSaved(matchId: string, status: string, startsAt: string) {
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId ? { ...m, status, starts_at: startsAt } : m
      )
    );
  }

  function handleMatchDeleted(matchId: string) {
    setMatches((current) => current.filter((m) => m.id !== matchId));
  }

  const filteredMatches = matches.filter((match) => {
    return matchRoundFilter === "ALL" || match.round_id === matchRoundFilter;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Матчи ({filteredMatches.length} из {matches.length})
      </h1>
      <p className="text-gray-500 mb-6 max-w-2xl">
        Матчи подтягиваются синхронизацией с ABL — здесь можно только
        поправить дату/статус существующего матча или удалить его.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Тур</label>
        <select
          value={matchRoundFilter}
          onChange={(e) => setMatchRoundFilter(e.target.value)}
          className="border rounded-lg px-4 py-2"
        >
          <option value="ALL">Все туры</option>
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.name}
            </option>
          ))}
        </select>
      </div>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Тур</th>
                <th className="p-3">Матч</th>
                <th className="p-3">Дата</th>
                <th className="p-3">Статус</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  onSaved={handleMatchSaved}
                  onDeleted={handleMatchDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
