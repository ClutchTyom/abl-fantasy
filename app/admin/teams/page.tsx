"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import TeamRow from "@/components/admin/TeamRow";

type Team = {
  id: string;
  name: string;
  short_name: string;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  async function loadData() {
    setLoadingData(true);

    const teamsData = await fetchAllRows<Team>((from, to) =>
      supabase.from("teams").select("id, name, short_name").order("name").range(from, to)
    );

    setTeams(teamsData);
    setLoadingData(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, []);

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    setTeamError(null);

    const { error } = await supabase
      .from("teams")
      .insert({ name: teamName, short_name: teamShortName });

    if (error) {
      setTeamError(error.message);
      return;
    }

    setTeamName("");
    setTeamShortName("");
    loadData();
  }

  function handleTeamSaved(teamId: string, name: string, shortName: string) {
    setTeams((current) =>
      current.map((t) =>
        t.id === teamId ? { ...t, name, short_name: shortName } : t
      )
    );
  }

  function handleTeamDeleted(teamId: string) {
    setTeams((current) => current.filter((t) => t.id !== teamId));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Команды</h1>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-10 max-w-lg">
        <h2 className="text-xl font-bold mb-4">Добавить команду</h2>
        <form onSubmit={handleAddTeam} className="space-y-3">
          <input
            type="text"
            placeholder="Название команды"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />
          <input
            type="text"
            placeholder="Короткое имя (уникальное)"
            value={teamShortName}
            onChange={(e) => setTeamShortName(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />
          {teamError && <p className="text-red-600 text-sm">{teamError}</p>}
          <button
            type="submit"
            className="bg-abl-600 hover:bg-abl-700 text-white font-semibold px-5 py-2 rounded-lg transition"
          >
            Добавить команду
          </button>
        </form>
      </div>

      <h2 className="text-xl font-bold mb-4">Все команды ({teams.length})</h2>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Название</th>
                <th className="p-3">Короткое имя</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  onSaved={handleTeamSaved}
                  onDeleted={handleTeamDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
