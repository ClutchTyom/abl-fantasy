"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";
import PlayerRow from "@/components/admin/PlayerRow";
import TeamRow from "@/components/admin/TeamRow";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type Team = {
  id: string;
  name: string;
  short_name: string;
};

export default function AdminPage() {
  const { profile, isLoading } = useProfile();
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [playerPosition, setPlayerPosition] = useState<string>("PG");
  const [playerPrice, setPlayerPrice] = useState(8);
  const [playerTeamId, setPlayerTeamId] = useState("");
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");

  useEffect(() => {
    if (!isLoading && (!profile || !profile.is_admin)) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  async function loadData() {
    setLoadingData(true);

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, short_name")
      .order("name");

    const { data: playersData } = await supabase
      .from("players")
      .select("*, teams(name, short_name)")
      .order("full_name");

    setTeams(teamsData ?? []);
    setPlayers(playersData ?? []);
    setLoadingData(false);
  }

  useEffect(() => {
    if (profile?.is_admin) {
      loadData();
    }
  }, [profile]);

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    setTeamError(null);

    const { error } = await supabase
      .from("teams")
      .insert({ name: teamName, short_name: teamShortName });

    if (error) {
      setTeamError(error.message);
      return;
    }

    setTeamName("");
    setTeamShortName("");
    loadData();
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    setPlayerError(null);

    if (!playerTeamId) {
      setPlayerError("Выбери команду");
      return;
    }

    const { error } = await supabase.from("players").insert({
      full_name: playerName,
      position: playerPosition,
      price: playerPrice,
      team_id: playerTeamId,
    });

    if (error) {
      setPlayerError(error.message);
      return;
    }

    setPlayerName("");
    setPlayerPrice(8);
    loadData();
  }

  function handlePlayerSaved(playerId: string, position: string, price: number) {
    setPlayers((current) =>
      current.map((p) =>
        p.id === playerId
          ? { ...p, position: position as Player["position"], price }
          : p
      )
    );
  }

  function handlePlayerDeleted(playerId: string) {
    setPlayers((current) => current.filter((p) => p.id !== playerId));
  }

  function handleTeamSaved(teamId: string, name: string, shortName: string) {
    setTeams((current) =>
      current.map((t) =>
        t.id === teamId ? { ...t, name, short_name: shortName } : t
      )
    );
    setPlayers((current) =>
      current.map((p) =>
        p.team_id === teamId
          ? { ...p, teams: { name, short_name: shortName } }
          : p
      )
    );
  }

  function handleTeamDeleted(teamId: string) {
    setTeams((current) => current.filter((t) => t.id !== teamId));
  }

  const filteredPlayers = players.filter((player) => {
    const matchesPosition =
      positionFilter === "ALL" || player.position === positionFilter;
    const matchesTeam =
      teamFilter === "ALL" || player.team_id === teamFilter;
    return matchesPosition && matchesTeam;
  });

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Админ-панель</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-4">Добавить команду</h2>
          <form onSubmit={handleAddTeam} className="space-y-3">
            <input
              type="text"
              placeholder="Название команды"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
            <input
              type="text"
              placeholder="Короткое имя (уникальное)"
              value={teamShortName}
              onChange={(e) => setTeamShortName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
            {teamError && <p className="text-red-600 text-sm">{teamError}</p>}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              Добавить команду
            </button>
          </form>
        </div>

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-4">Добавить игрока</h2>
          <form onSubmit={handleAddPlayer} className="space-y-3">
            <input
              type="text"
              placeholder="Имя игрока"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />

            <select
              value={playerTeamId}
              onChange={(e) => setPlayerTeamId(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="">Выбери команду</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <select
                value={playerPosition}
                onChange={(e) => setPlayerPosition(e.target.value)}
                className="flex-1 border rounded-lg px-4 py-2"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={6}
                max={13}
                value={playerPrice}
                onChange={(e) => setPlayerPrice(Number(e.target.value))}
                className="w-24 border rounded-lg px-4 py-2"
              />
            </div>

            {playerError && (
              <p className="text-red-600 text-sm">{playerError}</p>
            )}

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              Добавить игрока
            </button>
          </form>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">
        Все команды ({teams.length})
      </h2>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm mb-10">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Название</th>
                <th className="p-3">Короткое имя</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  onSaved={handleTeamSaved}
                  onDeleted={handleTeamDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">
        Все игроки ({filteredPlayers.length} из {players.length})
      </h2>

      <div className="mb-6 flex flex-wrap gap-4">
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
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Имя</th>
                <th className="p-3">Команда</th>
                <th className="p-3">Позиция</th>
                <th className="p-3">Цена</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onSaved={handlePlayerSaved}
                  onDeleted={handlePlayerDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}