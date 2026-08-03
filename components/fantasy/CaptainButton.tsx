"use client";

import { Player } from "@/types/player";
import { useFantasy } from "@/context/FantasyContext";

type CaptainButtonProps = {
  player: Player;
};

export default function CaptainButton({ player }: CaptainButtonProps) {
  const { captainId, setCaptain, isLocked } = useFantasy();
  const isCaptain = captainId === player.id;

  return (
    <button
      onClick={() => setCaptain(isCaptain ? null : player.id)}
      disabled={isLocked}
      title={isLocked ? "Тур заблокирован — изменения недоступны" : undefined}
      className={
        isCaptain
          ? "bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-yellow-900 font-semibold px-5 py-2 rounded-lg transition"
          : "bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold px-5 py-2 rounded-lg transition"
      }
    >
      {isCaptain ? "Капитан ×2" : "Сделать капитаном"}
    </button>
  );
}
