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
import RoundResults from "@/components/fantasy/RoundResults";
import { useUser } from "@/lib/useUser";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed rounded-xl p-6 flex items-center justify-center text-center h-full min-h-[160px]">
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-gray-300 mt-1">Пусто</p>
      </div>
    </div>
  );
}

type Round = {
  id: string;
  name: string;
  status: string;
  lock_at: string;
};

export default function TeamPage() {
const { squad, budget, spent, remaining, captainId, setCaptain } = useFantasy();
  const { user, isLoading } = useUser();
  const router = useRouter();

  const [round, setRound] = useState<Round | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    async function loadRound() {
      const { data } = await supabase
        .from("rounds")
        .select("id, name, status, lock_at")
        .eq("status", "upcoming")
        .order("lock_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setRound(data);
    }

    loadRound();
  }, []);

  const filledSlots = ALL_SLOTS.filter((slot) => squad[slot]).length;

  async function handleSaveTeam() {
    if (!user || !round) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const { data: existingSquad } = await supabase
      .from("fantasy_squads")
      .select("id, is_locked")
      .eq("user_id", user.id)
      .eq("round_id", round.id)
      .maybeSingle();

    if (existingSquad?.is_locked) {
      setSaveError("Состав на этот тур уже заблокирован");
      setIsSaving(false);
      return;
    }

    let squadId: string;

    if (existingSquad) {
      squadId = existingSquad.id;

const { error: updateError } = await supabase
        .from("fantasy_squads")
        .update({
          budget_spent: spent,
          captain_player_id: captainId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", squadId);

      if (updateError) {
        setSaveError(updateError.message);
        setIsSaving(false);
        return;
      }

      await supabase
        .from("fantasy_squad_players")
        .delete()
        .eq("squad_id", squadId);
    } else {
      const { data: newSquad, error: insertError } = await supabase
        .from("fantasy_squads")
        .insert({
          user_id: user.id,
          round_id: round.id,
          budget_spent: spent,
          captain_player_id: captainId,
        })
        .select("id")
        .single();

      if (insertError || !newSquad) {
        setSaveError(insertError?.message ?? "Не удалось создать состав");
        setIsSaving(false);
        return;
      }

      squadId = newSquad.id;
    }

    const rows = ALL_SLOTS.filter((slot) => squad[slot]).map((slot) => ({
      squad_id: squadId,
      player_id: squad[slot]!.id,
      slot,
      is_captain: squad[slot]!.id === captainId,
    }));

    if (rows.length > 0) {
      const { error: rosterError } = await supabase
        .from("fantasy_squad_players")
        .insert(rows);

      if (rosterError) {
        setSaveError(rosterError.message);
        setIsSaving(false);
        return;
      }
    }

    setSaveSuccess(true);
    setIsSaving(false);
  }

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Моя команда</h1>

      <RoundResults userId={user.id} />

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm grid grid-cols-3 gap-4 text-center">
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

      <div className="mb-8 border rounded-xl p-5 bg-white shadow-sm">
        <label className="block text-sm font-medium mb-2">
          Капитан (очки ×2)
        </label>
        <select
          value={captainId ?? ""}
          onChange={(e) => setCaptain(e.target.value || null)}
          className="border rounded-lg px-4 py-2 w-full max-w-md"
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
              Сохранение состава на: <span className="text-blue-600">{round.name}</span>
            </p>
          ) : (
            <p className="text-gray-500">
              Нет активного тура для сохранения (создай через админ-панель или SQL)
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Заполнено слотов: {filledSlots} из {ALL_SLOTS.length}
          </p>
        </div>

        <div className="text-right">
          <button
            onClick={handleSaveTeam}
            disabled={!round || isSaving || remaining < 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {STARTING_SLOTS.map((slot) =>
          squad[slot] ? (
            <PlayerCard key={slot} player={squad[slot]!} variant="team" />
          ) : (
            <EmptySlot key={slot} label={SLOT_LABELS[slot]} />
          )
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4">Запас</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENCH_SLOTS.map((slot) =>
          squad[slot] ? (
            <PlayerCard key={slot} player={squad[slot]!} variant="team" />
          ) : (
            <EmptySlot key={slot} label={SLOT_LABELS[slot]} />
          )
        )}
      </div>
    </main>
  );
}