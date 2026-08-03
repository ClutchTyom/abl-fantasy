"use client";

import { Player } from "@/types/player";
import { useFantasy } from "@/context/FantasyContext";

type AddPlayerButtonProps = {
  player: Player;
};

export default function AddPlayerButton({ player }: AddPlayerButtonProps) {
  const { addPlayer, isLocked } = useFantasy();

  return (
    <button
      onClick={() => addPlayer(player)}
      disabled={isLocked}
      title={isLocked ? "Тур заблокирован — изменения недоступны" : undefined}
      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition"
    >
      Добавить
    </button>
  );
}
