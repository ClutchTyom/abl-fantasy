"use client";

import { Player } from "@/types/player";
import { useFantasy } from "@/context/FantasyContext";

type AddPlayerButtonProps = {
  player: Player;
};

export default function AddPlayerButton({ player }: AddPlayerButtonProps) {
  const { addPlayer } = useFantasy();

  return (
    <button
      onClick={() => addPlayer(player)}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition"
    >
      Добавить
    </button>
  );
}