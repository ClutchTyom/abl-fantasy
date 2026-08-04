"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";
import PlayerCard from "@/components/fantasy/PlayerCard";
import TeamLogo from "@/components/ui/TeamLogo";

type Team = {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
};

export default function TeamDetailPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = params.id;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    if (!user || !teamId) return;

    async function load() {
      setIsLoading(true);
      setError(null);

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, short_name, logo_url")
        .eq("id", teamId)
        .single();

      if (teamError || !teamData) {
        setError(teamError?.message ?? "Команда не найдена");
        setIsLoading(false);
        return;
      }

      setTeam(teamData);

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*, teams(name, short_name, division, logo_url)")
        .eq("team_id", teamId)
        .order("price", { ascending: false });

      if (playersError) {
        setError(playersError.message);
        setIsLoading(false);
        return;
      }

      setPlayers(playersData ?? []);
      setIsLoading(false);
    }

    load();
  }, [user, teamId]);

  if (userLoading || isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  if (error || !team) {
    return (
      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <p className="text-red-600">Ошибка: {error ?? "Команда не найдена"}</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8">
      <Link href="/players" className="text-blue-600 hover:underline text-sm">
        ← Назад к игрокам
      </Link>

      <div className="mt-4 mb-8 border rounded-xl p-6 bg-white shadow-sm flex items-center gap-4">
        <TeamLogo logoUrl={team.logo_url} shortName={team.short_name} size={56} />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
          <p className="text-gray-500 text-sm">{players.length} игроков в составе</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Состав</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </main>
  );
}
