"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerCard from "@/components/fantasy/PlayerCard";
import SectionTitle from "@/components/ui/SectionTitle";
import { useFantasy } from "@/context/FantasyContext";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

export default function PlayersPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { spent, remaining, isSquadLoading } = useFantasy();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    async function loadPlayers() {
      const { data, error } = await supabase
        .from("players")
        .select("*, teams(name, short_name)")
        .order("price", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setPlayers(data ?? []);
      }

      setIsLoading(false);
    }

    loadPlayers();
  }, []);

  const teamOptions = useMemo(() => {
    const names = players
      .map((p) => p.teams?.name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort();
  }, [players]);

  const filteredPlayers = players.filter((player) => {
    const matchesPosition =
      positionFilter === "ALL" || player.position === positionFilter;
    const matchesTeam =
      teamFilter === "ALL" || player.teams?.name === teamFilter;
    return matchesPosition && matchesTeam;
  });

  if (userLoading || isSquadLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8">
      <SectionTitle>Игроки ABL</SectionTitle>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm flex gap-8">
        <p className="text-lg font-semibold">
          Потрачено: <span className="text-blue-600">{spent}</span>
        </p>
        <p className="text-lg font-semibold">
          Осталось:{" "}
          <span className={remaining < 0 ? "text-red-600" : "text-green-600"}>
            {remaining}
          </span>
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Позиция</label>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="ALL">Все позиции</option>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Команда</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="ALL">Все команды</option>
            {teamOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <p>Загрузка игроков...</p>}

      {error && <p className="text-red-600">Ошибка загрузки: {error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlayers.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </main>
  );
}