"use client";

import { useEffect, useState } from "react";
import {
  useFantasy,
  STARTING_SLOTS,
  BENCH_SLOTS,
  ALL_SLOTS,
  Slot,
} from "@/context/FantasyContext";
import PlayerCard from "@/components/fantasy/PlayerCard";
import PlayerPickerModal from "@/components/fantasy/PlayerPickerModal";
import CourtView from "@/components/fantasy/CourtView";
import RoundResults from "@/components/fantasy/RoundResults";
import { formatFantasyWeekName } from "@/lib/fantasyWeeks";
import { useUser } from "@/lib/useUser";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { Player } from "@/types/player";

const SLOT_LABELS: Record<Slot, string> = {
  PG: "Разыгрывающий (PG)",
  SG: "Атакующий защитник (SG)",
  SF: "Лёгкий форвард (SF)",
  PF: "Тяжёлый форвард (PF)",
  C: "Центровой (C)",
  BENCH1: "Запасной 1",
  BENCH2: "Запасной 2",
  BENCH3: "Запасной 3",
  BENCH4: "Запасной 4",
  BENCH5: "Запасной 5",
};

function EmptySlot({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Тур заблокирован — изменения недоступны" : undefined}
      className="border-2 border-dashed rounded-xl p-6 flex items-center justify-center text-center h-full min-h-[160px] w-full hover:border-abl-400 hover:bg-abl-50 disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
    >
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-abl-500 font-medium mt-1">+ Выбрать игрока</p>
      </div>
    </button>
  );
}

// Слоты основы называются кодом позиции (PG/SG/.../C), который совпадает
// с Player["position"] — используем это, чтобы понять, нужно ли жёстко
// фиксировать позицию в пикере (запас — любая позиция).
function startingSlotPosition(slot: Slot): Player["position"] | null {
  return (STARTING_SLOTS as readonly string[]).includes(slot)
    ? (slot as Player["position"])
    : null;
}

export default function TeamPage() {
  const {
    squad,
    budget,
    spent,
    remaining,
    captainId,
    setCaptain,
    round,
    isSquadLoading,
    isCarriedOver,
    isLocked,
    isSquadComplete,
    isSaving,
    saveError,
    saveSuccess,
    saveSquad,
  } = useFantasy();
  const { user, isLoading } = useUser();
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    async function loadPlayers() {
      const data = await fetchAllRows<Player>((from, to) =>
        supabase
          .from("players")
          .select("*, teams(name, short_name, division, logo_url)")
          .order("price", { ascending: false })
          .range(from, to)
      );
      setAllPlayers(data);
    }

    loadPlayers();
  }, []);

  const filledSlots = ALL_SLOTS.filter((slot) => squad[slot]).length;

  if (isLoading || isSquadLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8">
      <h1 className="text-4xl font-bold mb-8">Моя команда</h1>

      <RoundResults userId={user.id} />

      {isCarriedOver && (
        <div className="mb-8 border border-abl-200 rounded-xl p-4 bg-abl-50 text-abl-800 text-sm">
          Это состав из прошлого тура — сделайте трансферы (если нужно) и
          нажмите «Сохранить состав», чтобы зафиксировать его на новый тур.
        </div>
      )}

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-gray-500 text-sm">Бюджет</p>
            <p className="text-2xl font-bold">{budget}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Потрачено</p>
            <p className="text-2xl font-bold">{spent}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Осталось</p>
            <p
              className={`text-2xl font-bold ${
                remaining < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {remaining}
            </p>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              remaining < 0 ? "bg-red-500" : "bg-abl-600"
            }`}
            style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm">
        <label className="block text-sm font-medium mb-2">
          Капитан (очки ×2)
        </label>
        <select
          value={captainId ?? ""}
          onChange={(e) => setCaptain(e.target.value || null)}
          disabled={isLocked}
          className="border rounded-lg px-4 py-2 w-full max-w-md disabled:opacity-50"
        >
          <option value="">Не выбран</option>
          {ALL_SLOTS.filter((slot) => squad[slot]).map((slot) => (
            <option key={slot} value={squad[slot]!.id}>
              {squad[slot]!.full_name} ({squad[slot]!.position})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          {round ? (
            <p className="font-semibold">
              Сохранение состава на:{" "}
              <span className="text-abl-600">{formatFantasyWeekName(round.starts_at)}</span>
              <span className="text-gray-400 font-normal">
                {" "}
                · блокировка {new Date(round.starts_at).toLocaleString("ru-RU")}
              </span>
            </p>
          ) : (
            <p className="text-gray-500">Не удалось определить активный тур</p>
          )}
          <p
            className={`text-sm mt-1 ${
              isSquadComplete ? "text-gray-500" : "text-amber-600"
            }`}
          >
            Заполнено слотов: {filledSlots} из {ALL_SLOTS.length}
            {!isSquadComplete && " — нужно заполнить все, чтобы сохранить"}
          </p>
          {isLocked && (
            <p className="text-amber-600 text-sm mt-1">
              Состав на этот тур заблокирован — изменения недоступны
            </p>
          )}
        </div>

        <div className="text-right">
          <button
            onClick={saveSquad}
            disabled={!round || isSaving || isLocked || remaining < 0 || !isSquadComplete}
            className="bg-abl-600 hover:bg-abl-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            {isSaving ? "Сохраняем..." : "Сохранить состав"}
          </button>
          {saveError && (
            <p className="text-red-600 text-sm mt-2 max-w-xs">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-green-600 text-sm mt-2">Состав сохранён!</p>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Основа</h2>
      <p className="text-gray-500 text-sm mb-4 -mt-2">
        Клик по игроку на площадке — заменить, крестик — убрать. Клик по
        пустой позиции — выбрать игрока.
      </p>
      <div className="mb-10">
        <CourtView onSlotClick={setPickerSlot} />
      </div>

      <h2 className="text-2xl font-bold mb-4">Запас</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENCH_SLOTS.map((slot) =>
          squad[slot] ? (
            <PlayerCard
              key={slot}
              player={squad[slot]!}
              variant="team"
              onReplaceClick={() => setPickerSlot(slot)}
            />
          ) : (
            <EmptySlot
              key={slot}
              label={SLOT_LABELS[slot]}
              onClick={() => setPickerSlot(slot)}
              disabled={isLocked}
            />
          )
        )}
      </div>

      {pickerSlot && (
        <PlayerPickerModal
          slot={pickerSlot}
          slotLabel={SLOT_LABELS[pickerSlot]}
          lockedPosition={startingSlotPosition(pickerSlot)}
          players={allPlayers}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </main>
  );
}
