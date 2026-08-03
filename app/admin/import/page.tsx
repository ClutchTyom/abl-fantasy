"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";
import { ABL_DIVISIONS } from "@/lib/abl/client";
import { syncAblTournament, SyncSummary } from "@/lib/abl/sync";

export default function AdminImportPage() {
  const { profile, isLoading } = useProfile();
  const router = useRouter();

  const [alias, setAlias] = useState<string>(ABL_DIVISIONS[0].alias);
  const [isSyncing, setIsSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!profile || !profile.is_admin)) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  async function handleSync() {
    setIsSyncing(true);
    setLog([]);
    setSummary(null);
    setError(null);

    try {
      const result = await syncAblTournament(alias, (message) => {
        setLog((current) => [...current, message]);
      });
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setIsSyncing(false);
    }
  }

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link href="/admin" className="text-blue-600 hover:underline text-sm">
        ← Назад в админ-панель
      </Link>

      <h1 className="text-3xl font-bold mt-3 mb-1">Импорт из ABL</h1>
      <p className="text-gray-500 mb-8">
        Подтягивает команды, составы, календарь и статистику сыгранных матчей
        с ablforpeople.com. Повторный запуск обновляет уже созданные записи
        (цены игроков и короткие имена команд не перезаписываются).
      </p>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-6">
        <label className="block text-sm font-medium mb-2">Дивизион</label>
        <select
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          disabled={isSyncing}
          className="w-full border rounded-lg px-4 py-2 mb-4"
        >
          {ABL_DIVISIONS.map((division) => (
            <option key={division.alias} value={division.alias}>
              {division.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          {isSyncing ? "Синхронизируем..." : "Синхронизировать"}
        </button>
      </div>

      {log.length > 0 && (
        <div className="border rounded-xl p-6 bg-white shadow-sm mb-6">
          <h2 className="font-bold mb-3">Ход синхронизации</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="border border-red-200 rounded-xl p-6 bg-red-50 text-red-700 mb-6">
          Ошибка: {error}
        </div>
      )}

      {summary && (
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">Результат</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-gray-500 text-sm">Команды</p>
              <p className="text-2xl font-bold">{summary.teams}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Игроки</p>
              <p className="text-2xl font-bold">{summary.players}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Туры</p>
              <p className="text-2xl font-bold">{summary.rounds}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Матчи</p>
              <p className="text-2xl font-bold">{summary.matches}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Записи статистики</p>
              <p className="text-2xl font-bold">{summary.stats}</p>
            </div>
          </div>

          {summary.warnings.length > 0 && (
            <div>
              <h3 className="font-semibold text-amber-700 mb-2">
                Предупреждения ({summary.warnings.length})
              </h3>
              <ul className="text-sm text-amber-700 space-y-1 max-h-64 overflow-y-auto">
                {summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
