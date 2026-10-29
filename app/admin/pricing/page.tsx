"use client";

import { useState } from "react";
import {
  recalculatePlayerPrices,
  PriceRecalcSummary,
  MIN_GAMES_FOR_TIER,
} from "@/lib/pricing";

export default function AdminPricingPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<PriceRecalcSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRecalculate() {
    setIsRunning(true);
    setSummary(null);
    setError(null);

    try {
      const result = await recalculatePlayerPrices();
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Пересчёт цен игроков</h1>
      <p className="text-gray-500 mb-8">
        Цена (6–17) считается по средним фэнтези-очкам за игру: сильнейшие
        игроки получают максимум, а игроки без статистики или сыгравшие
        меньше {MIN_GAMES_FOR_TIER} матчей — минимум (6). Архивные игроки не учитываются. Ручные правки цены
        в этом списке не хранятся отдельно — повторный пересчёт заменит их
        актуальными значениями. Квоты по ценам считаются отдельно в каждом зале.
        Цена игрока зависит от его места среди игроков своего зала.
      </p>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-6">
        <button
          onClick={handleRecalculate}
          disabled={isRunning}
          className="bg-abl-600 hover:bg-abl-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          {isRunning ? "Считаем..." : "Пересчитать цены"}
        </button>
      </div>

      {error && (
        <div className="border border-red-200 rounded-xl p-6 bg-red-50 text-red-700 mb-6">
          Ошибка: {error}
        </div>
      )}

      {summary && (
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="font-bold mb-3">Результат</h2>
          <div className="grid grid-cols-2 gap-4 text-center mb-6">
            <div>
              <p className="text-gray-500 text-sm">Игроков обновлено</p>
              <p className="text-2xl font-bold">{summary.playersUpdated}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">
                Прошли порог {MIN_GAMES_FOR_TIER}+ матчей
              </p>
              <p className="text-2xl font-bold">{summary.eligiblePlayers}</p>
            </div>
          </div>

          <h3 className="font-semibold mb-3">Распределение по залам</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Зал</th>
                  <th className="py-2 pr-3">Игроков</th>
                  <th className="py-2">Цена × количество</th>
                </tr>
              </thead>
              <tbody>
                {summary.halls.map((hall) => (
                  <tr key={hall.hallName} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 font-medium">{hall.hallName}</td>
                    <td className="py-2 pr-3">
                      {hall.players}{" "}
                      <span className="text-gray-400">({hall.eligiblePlayers} с порогом)</span>
                    </td>
                    <td className="py-2 text-gray-600">
                      {hall.priceDistribution
                        .map((row) => `${row.price}×${row.count}`)
                        .join("  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
