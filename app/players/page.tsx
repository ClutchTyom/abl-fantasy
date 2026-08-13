"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerCard from "@/components/fantasy/PlayerCard";
import SectionTitle from "@/components/ui/SectionTitle";
import { useFantasy } from "@/context/FantasyContext";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { Player } from "@/types/player";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { MIN_PRICE, MAX_PRICE } from "@/lib/pricing";
import { fetchSeasonStatsByPlayer, SeasonStats } from "@/lib/seasonStats";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

export default function PlayersPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { spent, remaining, isSquadLoading } = useFantasy();
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasonStatsByPlayer, setSeasonStatsByPlayer] = useState<
    Map<string, SeasonStats>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nameFilter, setNameFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [divisionFilter, setDivisionFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [minPriceFilter, setMinPriceFilter] = useState<string>("");
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>("");

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    async function loadPlayers() {
      try {
        const data = await fetchAllRows<Player>((from, to) =>
          supabase
            .from("players")
            .select("*, teams(name, short_name, division, logo_url)")
            .order("price", { ascending: false })
            .range(from, to)
        );
        setPlayers(data);

        const seasonStats = await fetchSeasonStatsByPlayer();
        setSeasonStatsByPlayer(seasonStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить игроков");
      }

      setIsLoading(false);
    }

    loadPlayers();
  }, []);

  const divisionOptions = useMemo(() => {
    const divisions = players
      .map((p) => p.teams?.division)
      .filter((division): division is string => Boolean(division));
    return Array.from(new Set(divisions)).sort();
  }, [players]);

  const teamOptions = useMemo(() => {
    const names = players
      .filter(
        (p) => divisionFilter === "ALL" || p.teams?.division === divisionFilter
      )
      .map((p) => p.teams?.name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort();
  }, [players, divisionFilter]);

  function handleDivisionChange(value: string) {
    setDivisionFilter(value);
    setTeamFilter("ALL");
  }

  const filteredPlayers = players.filter((player) => {
    const matchesName =
      !nameFilter.trim() ||
      player.full_name
        .toLocaleLowerCase("ru")
        .startsWith(nameFilter.trim().toLocaleLowerCase("ru"));
    const matchesPosition =
      positionFilter === "ALL" || player.position === positionFilter;
    const matchesDivision =
      divisionFilter === "ALL" || player.teams?.division === divisionFilter;
    const matchesTeam =
      teamFilter === "ALL" || player.teams?.name === teamFilter;
    const matchesMinPrice = !minPriceFilter || player.price >= Number(minPriceFilter);
    const matchesMaxPrice = !maxPriceFilter || player.price <= Number(maxPriceFilter);
    return (
      matchesName &&
      matchesPosition &&
      matchesDivision &&
      matchesTeam &&
      matchesMinPrice &&
      matchesMaxPrice
    );
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

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Поиск по ФИО</label>
        <input
          type="text"
          placeholder="Например, Иванов"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-full max-w-md border rounded-lg px-4 py-2"
        />
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
          <label className="block text-sm font-medium mb-1">Дивизион</label>
          <select
            value={divisionFilter}
            onChange={(e) => handleDivisionChange(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="ALL">Все дивизионы</option>
            {divisionOptions.map((division) => (
              <option key={division} value={division}>
                {division}
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

        <div>
          <label className="block text-sm font-medium mb-1">Цена</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_PRICE}
              max={MAX_PRICE}
              placeholder={`от ${MIN_PRICE}`}
              value={minPriceFilter}
              onChange={(e) => setMinPriceFilter(e.target.value)}
              className="w-24 border rounded-lg px-4 py-2"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_PRICE}
              max={MAX_PRICE}
              placeholder={`до ${MAX_PRICE}`}
              value={maxPriceFilter}
              onChange={(e) => setMaxPriceFilter(e.target.value)}
              className="w-24 border rounded-lg px-4 py-2"
            />
          </div>
        </div>
      </div>

      {isLoading && <p>Загрузка игроков...</p>}

      {error && <p className="text-red-600">Ошибка загрузки: {error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlayers.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            seasonStats={seasonStatsByPlayer.get(player.id)}
          />
        ))}
      </div>
    </main>
  );
}