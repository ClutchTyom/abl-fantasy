"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { Player } from "@/types/player";
import PlayerRow from "@/components/admin/PlayerRow";
import { MIN_PRICE, MAX_PRICE } from "@/lib/pricing";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type Team = {
  id: string;
  name: string;
  short_name: string;
};

export default function AdminPlayersPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [playerName, setPlayerName] = useState("");
  const [playerPosition, setPlayerPosition] = useState<string>("PG");
  const [playerPrice, setPlayerPrice] = useState(MIN_PRICE);
  const [playerTeamId, setPlayerTeamId] = useState("");
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");

  async function loadData() {
    setLoadingData(true);

    const teamsData = await fetchAllRows<Team>((from, to) =>
      supabase.from("teams").select("id, name, short_name").order("name").range(from, to)
    );

    const playersData = await fetchAllRows<Player>((from, to) =>
      supabase
        .from("players")
        .select("*, teams(name, short_name, division, logo_url)")
        .order("full_name")
        .range(from, to)
    );

    setTeams(teamsData);
    setPlayers(playersData);
    setLoadingData(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, []);

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
    setPlayerPrice(MIN_PRICE);
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

  const filteredPlayers = players.filter((player) => {
    const matchesPosition =
      positionFilter === "ALL" || player.position === positionFilter;
    const matchesTeam = teamFilter === "ALL" || player.team_id === teamFilter;
    return matchesPosition && matchesTeam;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Игроки</h1>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-10 max-w-lg">
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
              min={MIN_PRICE}
              max={MAX_PRICE}
              value={playerPrice}
              onChange={(e) => setPlayerPrice(Number(e.target.value))}
              className="w-24 border rounded-lg px-4 py-2"
            />
          </div>

          {playerError && <p className="text-red-600 text-sm">{playerError}</p>}

          <button
            type="submit"
            className="bg-abl-600 hover:bg-abl-700 text-white font-semibold px-5 py-2 rounded-lg transition"
          >
            Добавить игрока
          </button>
        </form>
      </div>

      <h2 className="text-xl font-bold mb-4">
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
    </div>
  );
}
