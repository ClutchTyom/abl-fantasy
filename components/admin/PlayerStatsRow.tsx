"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { calculateFantasyPoints, calculatePoints } from "@/lib/fantasyPoints";
import { EMPTY_STAT_LINE, StatLine } from "@/types/playerMatchStats";

type StatField = keyof StatLine;

const FIELDS: { key: StatField; label: string }[] = [
  { key: "two_pt_made", label: "2О забито" },
  { key: "two_pt_miss", label: "2О мимо" },
  { key: "three_pt_made", label: "3О забито" },
  { key: "three_pt_miss", label: "3О мимо" },
  { key: "ft_made", label: "Штр. забито" },
  { key: "ft_miss", label: "Штр. мимо" },
  { key: "rebounds", label: "Подборы" },
  { key: "assists", label: "Передачи" },
  { key: "steals", label: "Перехваты" },
  { key: "blocks", label: "Блоки" },
  { key: "turnovers", label: "Потери" },
];

type PlayerStatsRowProps = {
  matchId: string;
  player: { id: string; full_name: string; position: string };
  initialStats: StatLine | null;
};

export default function PlayerStatsRow({
  matchId,
  player,
  initialStats,
}: PlayerStatsRowProps) {
  const [stats, setStats] = useState<StatLine>(initialStats ?? EMPTY_STAT_LINE);
  const [saved, setSaved] = useState<StatLine>(initialStats ?? EMPTY_STAT_LINE);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = FIELDS.some((f) => stats[f.key] !== saved[f.key]);

  function updateField(key: StatField, value: string) {
    const parsed = Math.max(0, Number(value) || 0);
    setStats((current) => ({ ...current, [key]: parsed }));
  }

  async function handleSave() {
    setIsSaving(true);

    const { error } = await supabase
      .from("player_match_stats")
      .upsert(
        { match_id: matchId, player_id: player.id, ...stats },
        { onConflict: "match_id,player_id" }
      );

    setIsSaving(false);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }

    setSaved(stats);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="p-3 font-medium whitespace-nowrap">
        {player.full_name}{" "}
        <span className="text-gray-400 text-sm">({player.position})</span>
      </td>
      {FIELDS.map((field) => (
        <td key={field.key} className="p-2">
          <input
            type="number"
            min={0}
            value={stats[field.key]}
            onChange={(e) => updateField(field.key, e.target.value)}
            className="w-16 border rounded-lg px-2 py-1"
          />
        </td>
      ))}
      <td className="p-3 text-center text-gray-500">
        {calculatePoints(stats)}
      </td>
      <td className="p-3 text-center font-semibold">
        {calculateFantasyPoints(stats).toFixed(1)}
      </td>
      <td className="p-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-1 rounded-lg transition"
        >
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </button>
      </td>
    </tr>
  );
}
