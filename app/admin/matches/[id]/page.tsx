"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabaseClient";
import PlayerStatsRow from "@/components/admin/PlayerStatsRow";
import { PlayerMatchStats, StatLine } from "@/types/playerMatchStats";

type MatchDetails = {
  id: string;
  starts_at: string;
  home_team_id: string;
  away_team_id: string;
  rounds: { name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

type TeamPlayer = {
  id: string;
  full_name: string;
  position: string;
  team_id: string;
};

const STAT_HEADERS = [
  "2О+",
  "2О−",
  "3О+",
  "3О−",
  "Штр+",
  "Штр−",
  "ПД",
  "АС",
  "ПХ",
  "БЛ",
  "ТО",
];

export default function AdminMatchStatsPage() {
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const matchId = params.id;

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [statsByPlayer, setStatsByPlayer] = useState<
    Record<string, StatLine>
  >({});
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && (!profile || !profile.is_admin)) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  useEffect(() => {
    if (!profile?.is_admin || !matchId) return;

    async function loadData() {
      setLoadingData(true);

      const { data: matchData } = await supabase
        .from("matches")
        .select(
          "id, starts_at, home_team_id, away_team_id, rounds(name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
        )
        .eq("id", matchId)
        .single();

      if (!matchData) {
        setLoadingData(false);
        return;
      }

      setMatch(matchData as unknown as MatchDetails);

      const { data: playersData } = await supabase
        .from("players")
        .select("id, full_name, position, team_id")
        .in("team_id", [matchData.home_team_id, matchData.away_team_id])
        .order("full_name");

      setPlayers(playersData ?? []);

      const { data: statsData } = await supabase
        .from("player_match_stats")
        .select("*")
        .eq("match_id", matchId);

      const map: Record<string, StatLine> = {};
      (statsData as PlayerMatchStats[] | null)?.forEach((row) => {
        map[row.player_id] = {
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
      });
      setStatsByPlayer(map);

      setLoadingData(false);
    }

    loadData();
  }, [profile, matchId]);

  if (isLoading || loadingData) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  if (!match) {
    return <p className="p-8">Матч не найден</p>;
  }

  const homePlayers = players.filter((p) => p.team_id === match.home_team_id);
  const awayPlayers = players.filter((p) => p.team_id === match.away_team_id);

  function renderTable(teamPlayers: TeamPlayer[], teamName: string) {
    return (
      <div className="mb-10">
        <h3 className="text-lg font-bold mb-3">{teamName}</h3>
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Игрок</th>
                {STAT_HEADERS.map((h) => (
                  <th key={h} className="p-2 text-sm">
                    {h}
                  </th>
                ))}
                <th className="p-3 text-sm">PTS</th>
                <th className="p-3 text-sm">FP</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map((player) => (
                <PlayerStatsRow
                  key={player.id}
                  matchId={match!.id}
                  player={player}
                  initialStats={statsByPlayer[player.id] ?? null}
                />
              ))}
              {teamPlayers.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-400" colSpan={STAT_HEADERS.length + 3}>
                    Нет игроков в этой команде
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link href="/admin" className="text-blue-600 hover:underline text-sm">
        ← Назад в админ-панель
      </Link>

      <h1 className="text-3xl font-bold mt-3 mb-1">
        {match.home_team?.name ?? "—"} vs {match.away_team?.name ?? "—"}
      </h1>
      <p className="text-gray-500 mb-8">
        {match.rounds?.name ?? "—"} ·{" "}
        {new Date(match.starts_at).toLocaleString("ru-RU")}
      </p>

      {renderTable(homePlayers, match.home_team?.name ?? "Хозяева")}
      {renderTable(awayPlayers, match.away_team?.name ?? "Гости")}
    </main>
  );
}
