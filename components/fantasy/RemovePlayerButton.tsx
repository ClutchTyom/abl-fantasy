"use client";

import { Player } from "@/types/player";
import { useFantasy } from "@/context/FantasyContext";

type RemovePlayerButtonProps = {
  player: Player;
};

export default function RemovePlayerButton({
  player,
}: RemovePlayerButtonProps) {
  const { removePlayer } = useFantasy();

  return (
    <button
      onClick={() => removePlayer(player.id)}
      className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-5 py-2 rounded-lg transition"
    >
      Убрать
    </button>
  );
}