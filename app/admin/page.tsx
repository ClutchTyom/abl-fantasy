"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";
import PlayerRow from "@/components/admin/PlayerRow";
import TeamRow from "@/components/admin/TeamRow";
import RoundRow, { Round } from "@/components/admin/RoundRow";
import MatchRow, { Match } from "@/components/admin/MatchRow";

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
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [playerPosition, setPlayerPosition] = useState<string>("PG");
  const [playerPrice, setPlayerPrice] = useState(8);
  const [playerTeamId, setPlayerTeamId] = useState("");
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [roundName, setRoundName] = useState("");
  const [roundLockAt, setRoundLockAt] = useState("");
  const [roundError, setRoundError] = useState<string | null>(null);

  const [matchRoundId, setMatchRoundId] = useState("");
  const [matchHomeTeamId, setMatchHomeTeamId] = useState("");
  const [matchAwayTeamId, setMatchAwayTeamId] = useState("");
  const [matchStartsAt, setMatchStartsAt] = useState("");
  const [matchError, setMatchError] = useState<string | null>(null);

  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [matchRoundFilter, setMatchRoundFilter] = useState("ALL");

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

    const { data: roundsData } = await supabase
      .from("rounds")
      .select("id, name, status, lock_at")
      .order("lock_at");

    const { data: matchesData } = await supabase
      .from("matches")
      .select(
        "*, rounds(name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
      )
      .order("starts_at");

    setTeams(teamsData ?? []);
    setPlayers(playersData ?? []);
    setRounds(roundsData ?? []);
    setMatches((matchesData as unknown as Match[]) ?? []);
    setLoadingData(false);
  }

  useEffect(() => {
    if (profile?.is_admin) {
      queueMicrotask(() => {
        loadData();
      });
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

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    setRoundError(null);

    if (!roundLockAt) {
      setRoundError("Укажи дату и время блокировки состава");
      return;
    }

    const { error } = await supabase.from("rounds").insert({
      name: roundName,
      status: "upcoming",
      lock_at: new Date(roundLockAt).toISOString(),
    });

    if (error) {
      setRoundError(error.message);
      return;
    }

    setRoundName("");
    setRoundLockAt("");
    loadData();
  }

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault();
    setMatchError(null);

    if (!matchRoundId || !matchHomeTeamId || !matchAwayTeamId || !matchStartsAt) {
      setMatchError("Заполни все поля");
      return;
    }

    if (matchHomeTeamId === matchAwayTeamId) {
      setMatchError("Команды должны быть разными");
      return;
    }

    const { error } = await supabase.from("matches").insert({
      round_id: matchRoundId,
      home_team_id: matchHomeTeamId,
      away_team_id: matchAwayTeamId,
      starts_at: new Date(matchStartsAt).toISOString(),
    });

    if (error) {
      setMatchError(error.message);
      return;
    }

    setMatchHomeTeamId("");
    setMatchAwayTeamId("");
    setMatchStartsAt("");
    loadData();
  }

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

  function handleRoundSaved(
    roundId: string,
    name: string,
    status: string,
    lockAt: string
  ) {
    setRounds((current) =>
      current.map((r) =>
        r.id === roundId ? { ...r, name, status, lock_at: lockAt } : r
      )
    );
  }

  function handleRoundDeleted(roundId: string) {
    setRounds((current) => current.filter((r) => r.id !== roundId));
  }
const filteredMatches = matches.filter((match) => {
    return matchRoundFilter === "ALL" || match.round_id === matchRoundFilter;
  });
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Админ-панель</h1>
        <Link
          href="/admin/import"
          className="bg-gray-900 hover:bg-gray-700 text-white font-semibold px-5 py-2 rounded-lg transition"
        >
          Импорт из ABL
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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

        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-4">Добавить тур</h2>
          <form onSubmit={handleAddRound} className="space-y-3">
            <input
              type="text"
              placeholder="Название тура (напр. Тур 2)"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
            <div>
              <label className="block text-sm font-medium mb-1">
                Блокировка состава (дата и время)
              </label>
              <input
                type="datetime-local"
                value={roundLockAt}
                onChange={(e) => setRoundLockAt(e.target.value)}
                required
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
            {roundError && (
              <p className="text-red-600 text-sm">{roundError}</p>
            )}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              Добавить тур
            </button>
          </form>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Все туры ({rounds.length})</h2>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm mb-10">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Название</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Блокировка</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  onSaved={handleRoundSaved}
                  onDeleted={handleRoundDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Добавить матч</h2>
        <form onSubmit={handleAddMatch} className="space-y-3">
          <select
            value={matchRoundId}
            onChange={(e) => setMatchRoundId(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="">Выбери тур</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.name}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <select
              value={matchHomeTeamId}
              onChange={(e) => setMatchHomeTeamId(e.target.value)}
              required
              className="flex-1 border rounded-lg px-4 py-2"
            >
              <option value="">Команда дома</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <select
              value={matchAwayTeamId}
              onChange={(e) => setMatchAwayTeamId(e.target.value)}
              required
              className="flex-1 border rounded-lg px-4 py-2"
            >
              <option value="">Команда в гостях</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <input
            type="datetime-local"
            value={matchStartsAt}
            onChange={(e) => setMatchStartsAt(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />

          {matchError && <p className="text-red-600 text-sm">{matchError}</p>}

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition"
          >
            Добавить матч
          </button>
        </form>
      </div>

<h2 className="text-2xl font-bold mb-4">
        Все матчи ({filteredMatches.length} из {matches.length})
      </h2>

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
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm mb-10">
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