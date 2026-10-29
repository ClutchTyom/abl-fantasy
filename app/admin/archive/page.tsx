"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Counts = { teams_count: number; players_count: number };

export default function AdminArchivePage() {
  const [preview, setPreview] = useState<Counts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPreview() {
    setIsLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("admin_archive_stale", {
      p_dry_run: true,
    });

    if (rpcError) {
      setPreview(null);
      setError(rpcError.message);
    } else {
      setPreview((data as Counts[] | null)?.[0] ?? null);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadPreview();
    });
  }, []);

  async function handleArchive() {
    if (!preview) return;

    if (
      !confirm(
        `Архивировать ${preview.teams_count} команд и ${preview.players_count} игроков? Их можно будет вернуть кнопкой «Вернуть всё из архива».`
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError(null);
    setMessage(null);

    const { data, error: rpcError } = await supabase.rpc("admin_archive_stale", {
      p_dry_run: false,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const done = (data as Counts[] | null)?.[0];
      setMessage(
        `Готово: в архив перенесено ${done?.teams_count ?? 0} команд и ${done?.players_count ?? 0} игроков.`
      );
    }

    setIsWorking(false);
    await loadPreview();
  }

  async function handleRestore() {
    if (!confirm("Вернуть из архива все команды и всех игроков?")) return;

    setIsWorking(true);
    setError(null);
    setMessage(null);

    const { error: rpcError } = await supabase.rpc("admin_restore_archive");

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage("Архив очищен: все команды и игроки возвращены.");
    }

    setIsWorking(false);
    await loadPreview();
  }

  const nothingToArchive =
    preview !== null && preview.teams_count === 0 && preview.players_count === 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Архив</h1>
      <p className="text-gray-500 mb-8">
        Команды и игроки, которых не обновляла последняя синхронизация с ABL
        (прошлые сезоны, ушедшие из ростера), скрываются из списков, расписания
        и выбора состава. Ничего не удаляется: старые матчи, статистика и
        прошлые составы сохраняются, а архив можно вернуть. Если архивная
        команда снова появится в импорте, она вернётся сама. Записи, созданные
        вручную (без привязки к ABL), в архив не попадают.
      </p>

      <div className="border rounded-xl p-5 bg-white shadow-sm mb-6">
        <h2 className="font-bold mb-3">Что будет архивировано</h2>
        {isLoading ? (
          <p className="text-gray-500">Считаю...</p>
        ) : preview ? (
          <p className="text-lg">
            <span className="font-bold">{preview.teams_count}</span> команд и{" "}
            <span className="font-bold">{preview.players_count}</span> игроков
          </p>
        ) : null}
        {error && (
          <p role="alert" className="text-red-600 mt-2">
            {error}
          </p>
        )}
        {message && <p className="text-green-600 mt-2">{message}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleArchive}
          disabled={isWorking || isLoading || !preview || nothingToArchive}
          className="bg-abl-600 hover:bg-abl-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          {isWorking ? "Выполняю..." : "Архивировать устаревшее"}
        </button>
        <button
          onClick={handleRestore}
          disabled={isWorking}
          className="bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-medium px-5 py-2.5 rounded-lg transition"
        >
          Вернуть всё из архива
        </button>
      </div>

      <p className="text-sm text-gray-400 mt-6">
        Сначала выполните «Импорт из ABL» по всем дивизионам: без свежей
        синхронизации архивировать нечего, и кнопка вернёт ошибку.
      </p>
    </div>
  );
}
