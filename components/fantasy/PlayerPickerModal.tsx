"use client";

import { useEffect, useMemo, useState } from "react";
import { Player } from "@/types/player";
import { Slot, useFantasy } from "@/context/FantasyContext";
import { MIN_PRICE, MAX_PRICE } from "@/lib/pricing";
import TeamLogo from "@/components/ui/TeamLogo";
import Badge from "@/components/ui/Badge";
import { POSITION_COLORS } from "@/components/fantasy/PlayerCard";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type PlayerPickerModalProps = {
  slot: Slot;
  slotLabel: string;
  lockedPosition: Player["position"] | null;
  players: Player[];
  onClose: () => void;
};

export default function PlayerPickerModal({
  slot,
  slotLabel,
  lockedPosition,
  players,
  onClose,
}: PlayerPickerModalProps) {
  const { squad, addPlayerToSlot } = useFantasy();

  const [positionFilter, setPositionFilter] = useState<string>(
    lockedPosition ?? "ALL"
  );
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const squadPlayerIds = useMemo(
    () => new Set(Object.values(squad).map((p) => p?.id).filter(Boolean)),
    [squad]
  );

  const divisionOptions = useMemo(() => {
    const divisions = players
      .map((p) => p.teams?.division)
      .filter((d): d is string => Boolean(d));
    return Array.from(new Set(divisions)).sort();
  }, [players]);

  const teamOptions = useMemo(() => {
    const names = players
      .filter(
        (p) => divisionFilter === "ALL" || p.teams?.division === divisionFilter
      )
      .map((p) => p.teams?.name)
      .filter((n): n is string => Boolean(n));
    return Array.from(new Set(names)).sort();
  }, [players, divisionFilter]);

  function handleDivisionChange(value: string) {
    setDivisionFilter(value);
    setTeamFilter("ALL");
  }

  const filteredPlayers = players.filter((player) => {
    if (squadPlayerIds.has(player.id)) return false;
    const matchesPosition =
      positionFilter === "ALL" || player.position === positionFilter;
    const matchesDivision =
      divisionFilter === "ALL" || player.teams?.division === divisionFilter;
    const matchesTeam = teamFilter === "ALL" || player.teams?.name === teamFilter;
    const matchesMinPrice =
      !minPriceFilter || player.price >= Number(minPriceFilter);
    const matchesMaxPrice =
      !maxPriceFilter || player.price <= Number(maxPriceFilter);
    return (
      matchesPosition &&
      matchesDivision &&
      matchesTeam &&
      matchesMinPrice &&
      matchesMaxPrice
    );
  });

  function handlePick(player: Player) {
    addPlayerToSlot(player, slot);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Выбор игрока — {slotLabel}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 border-b flex flex-wrap gap-4">
          {!lockedPosition && (
            <div>
              <label className="block text-sm font-medium mb-1">Позиция</label>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="ALL">Все позиции</option>
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Дивизион</label>
            <select
              value={divisionFilter}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="border rounded-lg px-3 py-2"
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
              className="border rounded-lg px-3 py-2"
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
                className="w-20 border rounded-lg px-3 py-2"
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
                className="w-20 border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto divide-y">
          {filteredPlayers.length === 0 && (
            <p className="p-6 text-gray-500 text-center">
              Игроков по этим фильтрам не найдено.
            </p>
          )}

          {filteredPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => handlePick(player)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition text-left"
            >
              <TeamLogo
                logoUrl={player.teams?.logo_url}
                shortName={player.teams?.short_name ?? "?"}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{player.full_name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {player.teams?.name ?? "—"}
                </p>
              </div>
              <Badge
                text={player.position}
                color={POSITION_COLORS[player.position]}
              />
              <span className="font-bold w-12 text-right">
                💰 {player.price}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
