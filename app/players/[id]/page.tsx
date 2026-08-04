"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";
import { StatLine } from "@/types/playerMatchStats";
import { calculateFantasyPoints, calculatePoints } from "@/lib/fantasyPoints";
import Badge from "@/components/ui/Badge";
import TeamLogo from "@/components/ui/TeamLogo";
import { POSITION_COLORS } from "@/components/fantasy/PlayerCard";

type MatchGameLog = StatLine & {
  id: string;
  starts_at: string;
  roundName: string;
  opponentName: string;
  isHome: boolean;
};

type MatchEmbed = {
  starts_at: string;
  home_team_id: string;
  away_team_id: string;
  rounds: { name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

type PlayerMatchStatsRow = StatLine & {
  id: string;
  matches: MatchEmbed | null;
};

export default function PlayerDetailPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const playerId = params.id;

  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<MatchGameLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    if (!user || !playerId) return;

    async function load() {
      setIsLoading(true);
      setError(null);

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*, teams(name, short_name, division, logo_url)")
        .eq("id", playerId)
        .single();

      if (playerError || !playerData) {
        setError(playerError?.message ?? "Игрок не найден");
        setIsLoading(false);
        return;
      }

      setPlayer(playerData);

      const { data: statsRows, error: statsError } = await supabase
        .from("player_match_stats")
        .select(
          "*, matches(starts_at, home_team_id, away_team_id, rounds(name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name))"
        )
        .eq("player_id", playerId);

      if (statsError) {
        setError(statsError.message);
        setIsLoading(false);
        return;
      }

      const rows = ((statsRows as PlayerMatchStatsRow[] | null) ?? [])
        .filter((row) => row.matches !== null)
        .map((row) => {
          const match = row.matches!;
          const isHome = match.home_team_id === playerData.team_id;

          return {
            id: row.id,
            starts_at: match.starts_at,
            roundName: match.rounds?.name ?? "—",
            opponentName: (isHome ? match.away_team?.name : match.home_team?.name) ?? "—",
            isHome,
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
        })
        .sort(
          (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
        );

      setGames(rows);
      setIsLoading(false);
    }

    load();
  }, [user, playerId]);

  if (userLoading || isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  if (error || !player) {
    return (
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <p className="text-red-600">Ошибка: {error ?? "Игрок не найден"}</p>
      </main>
    );
  }

  const gamesCount = games.length;
  const totals = games.reduce(
    (acc, g) => {
      acc.points += calculatePoints(g);
      acc.fantasyPoints += calculateFantasyPoints(g);
      acc.rebounds += g.rebounds;
      acc.assists += g.assists;
      acc.steals += g.steals;
      acc.blocks += g.blocks;
      acc.turnovers += g.turnovers;
      return acc;
    },
    { points: 0, fantasyPoints: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 }
  );

  const avg = (value: number) => (gamesCount > 0 ? (value / gamesCount).toFixed(1) : "—");

  const initials =
    player.full_name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      <Link href="/players" className="text-blue-600 hover:underline text-sm">
        ← Назад к игрокам
      </Link>

      <div className="mt-4 mb-8 border rounded-xl p-6 bg-white shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-5 text-center sm:text-left">
        {player.photo_url ? (
          <Image
            src={player.photo_url}
            alt={player.full_name}
            width={88}
            height={88}
            className="w-[88px] h-[88px] rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
          />
        ) : (
          <div className="w-[88px] h-[88px] rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-2xl border-2 border-gray-100 flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold truncate max-w-full">
              {player.full_name}
            </h1>
            <Badge text={player.position} color={POSITION_COLORS[player.position]} />
          </div>
          {player.teams && (
            <Link
              href={`/teams/${player.team_id}`}
              className="text-gray-500 mt-1 flex items-center justify-center sm:justify-start gap-1.5 hover:text-blue-600 hover:underline"
            >
              <TeamLogo
                logoUrl={player.teams.logo_url}
                shortName={player.teams.short_name}
                size={18}
              />
              {player.teams.name}
            </Link>
          )}
        </div>

        <div className="text-center sm:text-right flex-shrink-0">
          <p className="text-sm text-gray-500">Стоимость</p>
          <p className="text-2xl font-bold">💰 {player.price}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">
        Статистика {gamesCount > 0 && `(${gamesCount} матчей)`}
      </h2>

      {gamesCount === 0 ? (
        <p className="text-gray-500 mb-10">Игрок ещё не сыграл ни одного матча со статистикой.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Очки", value: avg(totals.points) },
            { label: "Подборы", value: avg(totals.rebounds) },
            { label: "Передачи", value: avg(totals.assists) },
            { label: "Перехваты", value: avg(totals.steals) },
            { label: "Блоки", value: avg(totals.blocks) },
            { label: "Потери", value: avg(totals.turnovers) },
            { label: "FP за игру", value: avg(totals.fantasyPoints) },
            { label: "FP всего", value: totals.fantasyPoints.toFixed(1) },
          ].map((stat) => (
            <div key={stat.label} className="border rounded-xl p-4 bg-white shadow-sm text-center">
              <p className="text-gray-500 text-sm">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {gamesCount > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Матчи</h2>
          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Тур</th>
                  <th className="p-3">Соперник</th>
                  <th className="p-3 text-center">ОЧК</th>
                  <th className="p-3 text-center">ПД</th>
                  <th className="p-3 text-center">АС</th>
                  <th className="p-3 text-center">FP</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game.id} className="border-b last:border-0">
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(game.starts_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="p-3 text-gray-500">{game.roundName}</td>
                    <td className="p-3">
                      {game.isHome ? "" : "@ "}
                      {game.opponentName}
                    </td>
                    <td className="p-3 text-center">{calculatePoints(game)}</td>
                    <td className="p-3 text-center">{game.rebounds}</td>
                    <td className="p-3 text-center">{game.assists}</td>
                    <td className="p-3 text-center font-semibold text-blue-600">
                      {calculateFantasyPoints(game).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
