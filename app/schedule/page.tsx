"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import SectionTitle from "@/components/ui/SectionTitle";
import TeamLogo from "@/components/ui/TeamLogo";

type TeamRef = {
  name: string;
  short_name: string;
  division: string | null;
  logo_url: string | null;
};

type ScheduleMatch = {
  id: string;
  starts_at: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  rounds: { name: string } | null;
  home_team: TeamRef | null;
  away_team: TeamRef | null;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Запланирован",
  live: "Идёт сейчас",
  finished: "Завершён",
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-600",
  live: "bg-red-100 text-red-700",
  finished: "bg-green-100 text-green-700",
};

function formatDateHeading(iso: string): string {
  const date = new Date(iso);
  const label = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function SchedulePage() {
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Date.now() нельзя вызывать прямо в теле рендера (impure) — фиксируем
  // "сейчас" один раз при загрузке календаря, вместе с самими матчами.
  const [now, setNow] = useState<number | null>(null);

  const [timeframe, setTimeframe] = useState<"upcoming" | "past">("upcoming");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");

  useEffect(() => {
    async function loadMatches() {
      try {
        const data = await fetchAllRows<Record<string, unknown>>((from, to) =>
          supabase
            .from("matches")
            .select(
              "id, starts_at, status, home_team_id, away_team_id, rounds(name), home_team:teams!matches_home_team_id_fkey(name, short_name, division, logo_url), away_team:teams!matches_away_team_id_fkey(name, short_name, division, logo_url)"
            )
            .order("starts_at")
            .range(from, to)
        );
        setMatches(data as unknown as ScheduleMatch[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить календарь");
      }

      setNow(Date.now());
      setIsLoading(false);
    }

    loadMatches();
  }, []);

  const divisionOptions = useMemo(() => {
    const divisions = matches.flatMap((m) => [
      m.home_team?.division,
      m.away_team?.division,
    ]);
    return Array.from(
      new Set(divisions.filter((d): d is string => Boolean(d)))
    ).sort();
  }, [matches]);

  const teamOptions = useMemo(() => {
    const names = matches
      .filter((m) => {
        if (divisionFilter === "ALL") return true;
        return (
          m.home_team?.division === divisionFilter ||
          m.away_team?.division === divisionFilter
        );
      })
      .flatMap((m) => [m.home_team?.name, m.away_team?.name]);
    return Array.from(new Set(names.filter((n): n is string => Boolean(n)))).sort();
  }, [matches, divisionFilter]);

  function handleDivisionChange(value: string) {
    setDivisionFilter(value);
    setTeamFilter("ALL");
  }

  const filteredMatches = matches.filter((match) => {
    const isPast = new Date(match.starts_at).getTime() < (now ?? 0);
    const matchesTimeframe = timeframe === "upcoming" ? !isPast : isPast;
    const matchesDivision =
      divisionFilter === "ALL" ||
      match.home_team?.division === divisionFilter ||
      match.away_team?.division === divisionFilter;
    const matchesTeam =
      teamFilter === "ALL" ||
      match.home_team?.name === teamFilter ||
      match.away_team?.name === teamFilter;
    return matchesTimeframe && matchesDivision && matchesTeam;
  });

  const orderedMatches =
    timeframe === "upcoming" ? filteredMatches : [...filteredMatches].reverse();

  const groups: { heading: string; matches: ScheduleMatch[] }[] = [];
  for (const match of orderedMatches) {
    const heading = formatDateHeading(match.starts_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.heading === heading) {
      lastGroup.matches.push(match);
    } else {
      groups.push({ heading, matches: [match] });
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      <SectionTitle>Календарь игр</SectionTitle>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setTimeframe("upcoming")}
            className={`px-4 py-2 text-sm font-medium transition ${
              timeframe === "upcoming"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Ближайшие
          </button>
          <button
            onClick={() => setTimeframe("past")}
            className={`px-4 py-2 text-sm font-medium transition border-l ${
              timeframe === "past"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Прошедшие
          </button>
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
      </div>

      {isLoading && <p>Загрузка...</p>}
      {error && <p className="text-red-600">Ошибка загрузки: {error}</p>}

      {!isLoading && !error && groups.length === 0 && (
        <p className="text-gray-500">Матчей не найдено.</p>
      )}

      {groups.map((group) => (
        <div key={group.heading} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">
            {group.heading}
          </h2>
          <div className="border rounded-xl bg-white shadow-sm divide-y">
            {group.matches.map((match) => (
              <div
                key={match.id}
                className="p-4 flex items-center gap-4 flex-wrap"
              >
                <div className="text-sm text-gray-500 w-14 flex-shrink-0">
                  {new Date(match.starts_at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <TeamLogo
                    logoUrl={match.home_team?.logo_url}
                    shortName={match.home_team?.short_name ?? "?"}
                    size={28}
                  />
                  <span className="font-medium">
                    {match.home_team?.name ?? "—"}
                  </span>
                  <span className="text-gray-400">—</span>
                  <span className="font-medium">
                    {match.away_team?.name ?? "—"}
                  </span>
                  <TeamLogo
                    logoUrl={match.away_team?.logo_url}
                    shortName={match.away_team?.short_name ?? "?"}
                    size={28}
                  />
                </div>

                <span className="text-xs text-gray-400">
                  {match.rounds?.name ?? "—"}
                </span>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    STATUS_STYLES[match.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {STATUS_LABELS[match.status] ?? match.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
