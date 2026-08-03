"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export type Match = {
  id: string;
  round_id: string;
  home_team_id: string;
  away_team_id: string;
  starts_at: string;
  status: string;
  rounds: { name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

const STATUSES = ["scheduled", "live", "finished"] as const;

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  return new Date(value).toISOString();
}

type MatchRowProps = {
  match: Match;
  onSaved: (matchId: string, status: string, startsAt: string) => void;
  onDeleted: (matchId: string) => void;
};

export default function MatchRow({ match, onSaved, onDeleted }: MatchRowProps) {
  const [status, setStatus] = useState(match.status);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(match.starts_at));
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    status !== match.status || startsAt !== toLocalInputValue(match.starts_at);

  async function handleSave() {
    setIsSaving(true);

    const startsAtIso = fromLocalInputValue(startsAt);

    const { error } = await supabase
      .from("matches")
      .update({ status, starts_at: startsAtIso })
      .eq("id", match.id);

    setIsSaving(false);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }

    onSaved(match.id, status, startsAtIso);
  }

  async function handleDelete() {
    if (!confirm("Удалить этот матч?")) return;

    const { error } = await supabase.from("matches").delete().eq("id", match.id);

    if (error) {
      alert("Ошибка удаления: " + error.message);
      return;
    }

    onDeleted(match.id);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="p-3 text-gray-500">{match.rounds?.name ?? "—"}</td>
      <td className="p-3 font-medium">
        {match.home_team?.name ?? "—"} vs {match.away_team?.name ?? "—"}
      </td>
      <td className="p-3">
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="border rounded-lg px-2 py-1"
        />
      </td>
      <td className="p-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-lg px-2 py-1"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <div className="flex gap-3 items-center">
          <Link
            href={`/admin/matches/${match.id}`}
            className="text-blue-600 hover:underline text-sm"
          >
            Статистика
          </Link>
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