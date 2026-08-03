"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { calculateFantasyPoints } from "@/lib/fantasyPoints";
import { StatLine } from "@/types/playerMatchStats";

type SquadResult = {
  squadId: string;
  roundName: string;
  roundStatus: string;
  totalPoints: number;
  players: {
    playerId: string;
    fullName: string;
    isCaptain: boolean;
    points: number;
  }[];
};

export default function RoundResults({ userId }: { userId: string }) {
  const [results, setResults] = useState<SquadResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);

      const { data: squads } = await supabase
        .from("fantasy_squads")
        .select("id, round_id, rounds(name, status)")
        .eq("user_id", userId);

      const relevantSquads = (
        (squads ?? []) as unknown as {
          id: string;
          round_id: string;
          rounds: { name: string; status: string } | null;
        }[]
      ).filter((s) => s.rounds?.status === "live" || s.rounds?.status === "completed");

      if (relevantSquads.length === 0) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      const squadIds = relevantSquads.map((s) => s.id);
      const roundIds = relevantSquads.map((s) => s.round_id);

      const { data: squadPlayers } = await supabase
        .from("fantasy_squad_players")
        .select("squad_id, player_id, is_captain, players(full_name)")
        .in("squad_id", squadIds);

      const { data: matches } = await supabase
        .from("matches")
        .select("id, round_id")
        .in("round_id", roundIds);

      const matchIds = (matches ?? []).map((m) => m.id);

      const { data: statsRows } = matchIds.length
        ? await supabase
            .from("player_match_stats")
            .select("*")
            .in("match_id", matchIds)
        : { data: [] };

      // очки игрока в туре = сумма фэнтези-очков по всем его матчам в этом туре
      const matchToRound = new Map((matches ?? []).map((m) => [m.id, m.round_id]));
      const pointsByRoundAndPlayer = new Map<string, number>();

      (statsRows ?? []).forEach((row) => {
        const roundId = matchToRound.get(row.match_id);
        if (!roundId) return;

        const stats: StatLine = {
          two_pt_made: row.two_pt_made,
          two_pt_miss: row.two_pt_miss,
          three_pt_made: row.three_pt_made,
          three_pt_miss: row.three_pt_miss,
          ft_made: row.ft_made,
          ft_miss: row.ft_miss,
          rebounds: row.rebounds,
          assists: row.assists,
          steals: row.steals,
          blocks: row.blocks,
          turnovers: row.turnovers,
        };

        const key = `${roundId}:${row.player_id}`;
        const current = pointsByRoundAndPlayer.get(key) ?? 0;
        pointsByRoundAndPlayer.set(key, current + calculateFantasyPoints(stats));
      });

      const squadPlayersBySquad = new Map<
        string,
        { player_id: string; is_captain: boolean; players: { full_name: string } | null }[]
      >();
      (squadPlayers ?? []).forEach((row) => {
        const list = squadPlayersBySquad.get(row.squad_id) ?? [];
        list.push(row as unknown as {
          player_id: string;
          is_captain: boolean;
          players: { full_name: string } | null;
        });
        squadPlayersBySquad.set(row.squad_id, list);
      });

      const computed: SquadResult[] = relevantSquads.map((squad) => {
        const rows = squadPlayersBySquad.get(squad.id) ?? [];

        const players = rows.map((row) => {
          const rawPoints =
            pointsByRoundAndPlayer.get(`${squad.round_id}:${row.player_id}`) ?? 0;
          const points = row.is_captain ? rawPoints * 2 : rawPoints;

          return {
            playerId: row.player_id,
            fullName: row.players?.full_name ?? "—",
            isCaptain: row.is_captain,
            points,
          };
        });

        const totalPoints = players.reduce((sum, p) => sum + p.points, 0);

        return {
          squadId: squad.id,
          roundName: squad.rounds?.name ?? "—",
          roundStatus: squad.rounds?.status ?? "—",
          totalPoints,
          players,
        };
      });

      setResults(computed);
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
        {results.map((result) => (
          <div
            key={result.squadId}
            className="border rounded-xl p-5 bg-white shadow-sm"
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold">{result.roundName}</h3>
                <p className="text-sm text-gray-500">
                  {result.roundStatus === "live" ? "Тур идёт" : "Тур завершён"}
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600">
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
        ))}
      </div>
    </div>
  );
}
