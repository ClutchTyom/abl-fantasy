"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: string;
  name: string;
  short_name: string;
};

type TeamRowProps = {
  team: Team;
  onSaved: (teamId: string, name: string, shortName: string) => void;
  onDeleted: (teamId: string) => void;
};

export default function TeamRow({ team, onSaved, onDeleted }: TeamRowProps) {
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.short_name);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = name !== team.name || shortName !== team.short_name;

  async function handleSave() {
    setIsSaving(true);

    const { error } = await supabase
      .from("teams")
      .update({ name, short_name: shortName })
      .eq("id", team.id);

    setIsSaving(false);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
      return;
    }

    onSaved(team.id, name, shortName);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Удалить команду "${team.name}"? Это получится только если в ней не осталось игроков.`
      )
    )
      return;

    const { error } = await supabase.from("teams").delete().eq("id", team.id);

    if (error) {
      alert(
        "Не получилось удалить: в этой команде ещё остались игроки. Сначала удали или перенеси их в другую команду."
      );
      return;
    }

    onDeleted(team.id);
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
        <input
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          className="border rounded-lg px-2 py-1 w-full"
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