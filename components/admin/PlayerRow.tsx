"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Player } from "@/types/player";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type PlayerRowProps = {
  player: Player;
  onSaved: (playerId: string, position: string, price: number) => void;
  onDeleted: (playerId: string) => void;
};

export default function PlayerRow({
  player,
  onSaved,
  onDeleted,
}: PlayerRowProps) {
  const [position, setPosition] = useState(player.position);
  const [price, setPrice] = useState(player.price);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = position !== player.position || price !== player.price;

  async function handleSave() {
    setIsSaving(true);

    const { error } = await supabase
      .from("players")
      .update({ position, price })
      .eq("id", player.id);

    setIsSaving(false);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }

    onSaved(player.id, position, price);
  }

  async function handleDelete() {
    if (!confirm(`Удалить игрока "${player.full_name}"?`)) return;

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", player.id);

    if (error) {
      alert("Ошибка удаления: " + error.message);
      return;
    }

    onDeleted(player.id);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="p-3">{player.full_name}</td>
      <td className="p-3 text-gray-500">{player.teams?.name ?? "—"}</td>
      <td className="p-3">
        <select
          value={position}
          onChange={(e) =>
            setPosition(e.target.value as typeof player.position)
          }
          className="border rounded-lg px-2 py-1"
        >
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <input
          type="number"
          min={6}
          max={13}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-20 border rounded-lg px-2 py-1"
        />
      </td>
      <td className="p-3">
        <div className="flex gap-3 items-center">
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-1 rounded-lg transition"
          >
            {isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            onClick={handleDelete}
            className="text-red-600 hover:underline text-sm"
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
}