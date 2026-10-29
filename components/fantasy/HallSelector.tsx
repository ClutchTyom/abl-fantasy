"use client";

import { useState } from "react";
import { useFantasy } from "@/context/FantasyContext";
import { ABL_DIVISIONS } from "@/lib/abl/client";
import { useHalls } from "@/lib/useHalls";

// Выбор зала — разовый: после подтверждения сменить его может только
// админ. Поэтому просим подтверждение, а не сохраняем по одному клику.
export default function HallSelector() {
  const { joinHall } = useFantasy();
  const { halls, isLoading, error: hallsError } = useHalls();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const hall = halls.find((h) => h.id === selectedId);
    if (!hall) return;

    if (
      !confirm(
        `Выбрать зал «${hall.name}»? Сменить его потом сможет только администратор.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError(null);
    const joinError = await joinHall(hall.id);
    if (joinError) {
      setError(joinError);
      setIsSaving(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-8">
      <h1 className="text-4xl font-bold mb-2">Выберите зал</h1>
      <p className="text-gray-500 mb-8">
        Вы будете собирать состав только из игроков дивизионов выбранного зала
        и соревноваться с другими участниками этого зала. Выбор делается один
        раз на сезон.
      </p>

      {isLoading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : hallsError ? (
        <p role="alert" className="text-red-600">
          Не удалось загрузить залы: {hallsError}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {halls.map((hall) => {
            const divisions = ABL_DIVISIONS.filter((d) => d.hall === hall.slug);
            const isSelected = hall.id === selectedId;

            return (
              <button
                key={hall.id}
                type="button"
                onClick={() => setSelectedId(hall.id)}
                aria-pressed={isSelected}
                className={`text-left border-2 rounded-xl p-5 bg-white shadow-sm transition ${
                  isSelected
                    ? "border-abl-600 bg-abl-50"
                    : "border-gray-200 hover:border-abl-400"
                }`}
              >
                <p className="text-xl font-bold">{hall.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {divisions.map((d) => d.label).join(", ")}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-600 mt-4">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedId || isSaving}
        className="mt-6 bg-abl-600 hover:bg-abl-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition"
      >
        {isSaving ? "Сохраняю..." : "Выбрать зал"}
      </button>
    </main>
  );
}
