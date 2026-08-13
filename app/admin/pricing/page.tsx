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
        Цена (8–17) считается по средним фэнтези-очкам за игру: сильнейшие
        игроки получают максимум, а игроки без статистики или сыгравшие
        меньше {MIN_GAMES_FOR_TIER} матчей — минимум (8). Ручные правки цены
        в этом списке не хранятся отдельно — повторный пересчёт заменит их
        актуальными значениями.
      </p>

      <div className="border rounded-xl p-6 bg-white shadow-sm mb-6">
        <button
          onClick={handleRecalculate}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
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

          <h3 className="font-semibold mb-2">Распределение по ценам</h3>
          <ul className="text-sm divide-y">
            {summary.priceDistribution.map((row) => (
              <li key={row.price} className="py-1.5 flex justify-between">
                <span>Цена {row.price}</span>
                <span className="font-medium">{row.count} игроков</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
