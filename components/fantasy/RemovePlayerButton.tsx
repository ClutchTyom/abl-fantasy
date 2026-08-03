"use client";

import { Player } from "@/types/player";
import { useFantasy } from "@/context/FantasyContext";

type RemovePlayerButtonProps = {
  player: Player;
};

export default function RemovePlayerButton({
  player,
}: RemovePlayerButtonProps) {
  const { removePlayer, isLocked } = useFantasy();

  return (
    <button
      onClick={() => removePlayer(player.id)}
      disabled={isLocked}
      title={isLocked ? "Тур заблокирован — изменения недоступны" : undefined}
      className="bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 font-semibold px-5 py-2 rounded-lg transition"
    >
      Убрать
    </button>
  );
}
