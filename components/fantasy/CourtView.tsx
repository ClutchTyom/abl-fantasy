"use client";

import Image from "next/image";
import { STARTING_SLOTS, Slot, useFantasy } from "@/context/FantasyContext";
import { Player } from "@/types/player";

type Coords = { top: string; left: string };

// Стилизованная расстановка по позициям на площадке (не привязана к
// реальной тактике — просто узнаваемый "ромб" от кольца до верха трёхочковой).
const COURT_POSITIONS: Record<(typeof STARTING_SLOTS)[number], Coords> = {
  C: { top: "10%", left: "50%" },
  PF: { top: "32%", left: "24%" },
  SF: { top: "32%", left: "76%" },
  SG: { top: "58%", left: "76%" },
  PG: { top: "84%", left: "50%" },
};

type CourtViewProps = {
  onSlotClick: (slot: Slot) => void;
};

export default function CourtView({ onSlotClick }: CourtViewProps) {
  const { squad, captainId, isLocked, removePlayer } = useFantasy();

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 border-4 border-abl-700/40 shadow-lg">
      {/* Лицевая линия */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/40" />
      {/* Трёхсекундная зона */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[38%] h-[26%] border-2 border-t-0 border-white/30 rounded-b-md" />
      {/* Штрафной круг */}
      <div className="absolute top-[26%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] aspect-square rounded-full border-2 border-white/25" />
      {/* Трёхочковая дуга (большим кругом, обрезана краем площадки) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[145%] aspect-square rounded-full border-2 border-white/25" />
      {/* Центральный круг у нижнего края */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[28%] aspect-square rounded-full border-2 border-white/25" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/40" />

      {STARTING_SLOTS.map((slot) => (
        <CourtSlot
          key={slot}
          slot={slot}
          coords={COURT_POSITIONS[slot]}
          player={squad[slot]}
          isCaptain={squad[slot] !== null && squad[slot]!.id === captainId}
          isLocked={isLocked}
          onSlotClick={onSlotClick}
          onRemove={removePlayer}
        />
      ))}
    </div>
  );
}

type CourtSlotProps = {
  slot: Slot;
  coords: Coords;
  player: Player | null;
  isCaptain: boolean;
  isLocked: boolean;
  onSlotClick: (slot: Slot) => void;
  onRemove: (playerId: string) => void;
};

function CourtSlot({
  slot,
  coords,
  player,
  isCaptain,
  isLocked,
  onSlotClick,
  onRemove,
}: CourtSlotProps) {
  const initials =
    player?.full_name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-20"
      style={{ top: coords.top, left: coords.left }}
    >
      {player ? (
        <div className="relative">
          <button
            onClick={() => onSlotClick(slot)}
            disabled={isLocked}
            title="Заменить"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {player.photo_url ? (
              <Image
                src={player.photo_url}
                alt={player.full_name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 font-bold text-sm">
                {initials}
              </div>
            )}
          </button>

          {isCaptain && (
            <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white">
              ×2
            </span>
          )}

          {!isLocked && (
            <button
              onClick={() => onRemove(player.id)}
              title="Убрать"
              className="absolute -bottom-0.5 -right-0.5 bg-red-600 hover:bg-red-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center border border-white leading-none"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => onSlotClick(slot)}
          disabled={isLocked}
          title={isLocked ? "Тур заблокирован — изменения недоступны" : "Выбрать игрока"}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-white/70 flex items-center justify-center text-white/90 text-2xl leading-none hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
        >
          +
        </button>
      )}

      {player ? (
        <>
          <p className="text-[11px] sm:text-xs font-semibold text-white text-center leading-tight truncate w-full drop-shadow">
            {player.full_name}
          </p>
          <span className="text-[10px] sm:text-xs font-bold text-white bg-black/30 rounded-full px-2 leading-4">
            💰 {player.price}
          </span>
        </>
      ) : (
        <p className="text-[10px] font-bold text-white/70 tracking-wide">{slot}</p>
      )}
    </div>
  );
}
