"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Round = {
  id: string;
  name: string;
  status: string;
  lock_at: string;
};

const STATUSES = ["upcoming", "live", "completed"] as const;

// Supabase хранит время в ISO-формате (напр. 2026-08-05T18:00:00+00:00),
// а <input type="datetime-local"> ожидает формат "2026-08-05T18:00" —
// эти две функции переводят из одного формата в другой и обратно.
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

type RoundRowProps = {
  round: Round;
  onSaved: (roundId: string, name: string, status: string, lockAt: string) => void;
  onDeleted: (roundId: string) => void;
};

export default function RoundRow({ round, onSaved, onDeleted }: RoundRowProps) {
  const [name, setName] = useState(round.name);
  const [status, setStatus] = useState(round.status);
  const [lockAt, setLockAt] = useState(toLocalInputValue(round.lock_at));
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    name !== round.name ||
    status !== round.status ||
    lockAt !== toLocalInputValue(round.lock_at);

  async function handleSave() {
    setIsSaving(true);

    const lockAtIso = fromLocalInputValue(lockAt);

    const { error } = await supabase
      .from("rounds")
      .update({ name, status, lock_at: lockAtIso })
      .eq("id", round.id);

    setIsSaving(false);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }

    onSaved(round.id, name, status, lockAtIso);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Удалить тур "${round.name}"? Все сохранённые составы на этот тур тоже удалятся.`
      )
    )
      return;

    const { error } = await supabase.from("rounds").delete().eq("id", round.id);

    if (error) {
      alert("Ошибка удаления: " + error.message);
      return;
    }

    onDeleted(round.id);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded-lg px-2 py-1 w-full"
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
        <input
          type="datetime-local"
          value={lockAt}
          onChange={(e) => setLockAt(e.target.value)}
          className="border rounded-lg px-2 py-1"
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