"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import RoundRow, { Round } from "@/components/admin/RoundRow";

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [roundName, setRoundName] = useState("");
  const [roundLockAt, setRoundLockAt] = useState("");
  const [roundError, setRoundError] = useState<string | null>(null);

  async function loadData() {
    setLoadingData(true);

    const roundsData = await fetchAllRows<Round>((from, to) =>
      supabase.from("rounds").select("id, name, status, lock_at").order("lock_at").range(from, to)
    );

    setRounds(roundsData);
    setLoadingData(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, []);

  async function handleAddRound(e: React.FormEvent) {
    e.preventDefault();
    setRoundError(null);

    if (!roundLockAt) {
      setRoundError("Укажи дату и время блокировки состава");
      return;
    }

    const { error } = await supabase.from("rounds").insert({
      name: roundName,
      status: "upcoming",
      lock_at: new Date(roundLockAt).toISOString(),
    });

    if (error) {
      setRoundError(error.message);
      return;
    }

    setRoundName("");
    setRoundLockAt("");
    loadData();
  }

  function handleRoundSaved(
    roundId: string,
    name: string,
    status: string,
    lockAt: string
  ) {
    setRounds((current) =>
      current.map((r) =>
        r.id === roundId ? { ...r, name, status, lock_at: lockAt } : r
      )
    );
  }

  function handleRoundDeleted(roundId: string) {
    setRounds((current) => current.filter((r) => r.id !== roundId));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Туры</h1>
      <p className="text-gray-500 mb-6 max-w-2xl">
        Это туры отдельных дивизионов ABL (создаются автоматически при
        синхронизации и используются как ярлык матчей). Блокировка состава
        игроков считается отдельно — по общему фэнтези-туру на дашборде.
      </p>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-10 max-w-lg">
        <h2 className="text-xl font-bold mb-4">Добавить тур вручную</h2>
        <form onSubmit={handleAddRound} className="space-y-3">
          <input
            type="text"
            placeholder="Название тура (напр. Тур 2)"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />
          <div>
            <label className="block text-sm font-medium mb-1">
              Блокировка состава (дата и время)
            </label>
            <input
              type="datetime-local"
              value={roundLockAt}
              onChange={(e) => setRoundLockAt(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>
          {roundError && <p className="text-red-600 text-sm">{roundError}</p>}
          <button
            type="submit"
            className="bg-abl-600 hover:bg-abl-700 text-white font-semibold px-5 py-2 rounded-lg transition"
          >
            Добавить тур
          </button>
        </form>
      </div>

      <h2 className="text-xl font-bold mb-4">Все туры ({rounds.length})</h2>

      {loadingData ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Название</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Блокировка</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  onSaved={handleRoundSaved}
                  onDeleted={handleRoundDeleted}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
