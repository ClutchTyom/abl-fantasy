"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Player } from "@/types/player";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/useUser";

export const STARTING_SLOTS = ["PG", "SG", "SF", "PF", "C"] as const;
export const BENCH_SLOTS = ["BENCH1", "BENCH2", "BENCH3", "BENCH4", "BENCH5"] as const;
export const ALL_SLOTS = [...STARTING_SLOTS, ...BENCH_SLOTS] as const;

export type Slot = (typeof ALL_SLOTS)[number];
export type Squad = Record<Slot, Player | null>;

const emptySquad: Squad = {
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
  BENCH1: null,
  BENCH2: null,
  BENCH3: null,
  BENCH4: null,
  BENCH5: null,
};

export type ActiveRound = {
  id: string;
  name: string;
  status: string;
  lock_at: string;
};

type SquadPlayerRow = {
  slot: Slot;
  is_captain: boolean;
  players: Player | null;
};

type FantasyContextType = {
  squad: Squad;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  budget: number;
  spent: number;
  remaining: number;
  captainId: string | null;
  setCaptain: (playerId: string | null) => void;
  round: ActiveRound | null;
  isSquadLoading: boolean;
  isLocked: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  saveSquad: () => Promise<void>;
};

const FantasyContext = createContext<FantasyContextType | undefined>(
  undefined
);

export function FantasyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: userLoading } = useUser();

  const [squad, setSquad] = useState<Squad>(emptySquad);
  const [captainId, setCaptainId] = useState<string | null>(null);

  const [round, setRound] = useState<ActiveRound | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSquadLoading, setIsSquadLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const budget = 100;

  const spent = ALL_SLOTS.reduce((total, slot) => {
    return total + (squad[slot]?.price ?? 0);
  }, 0);

  const remaining = budget - spent;

  // Состав команды всегда тянется из аккаунта пользователя, а не из
  // localStorage браузера — иначе на другом устройстве или в другом
  // аккаунте на том же компьютере виден чужой/устаревший черновик.
  //
  // Завязываемся на user.id (а не на весь объект user) специально:
  // supabase пересоздаёт объект user на каждое событие onAuthStateChange
  // (обновление токена, возврат фокуса на вкладку и т.д.), и если бы
  // эффект зависел от всего объекта, каждое такое событие заново тянуло
  // бы состав с сервера, затирая ещё не сохранённых добавленных игроков.
  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;

    async function loadRoundAndSquad() {
      // useUser() ещё не разобрался, авторизован ли пользователь — не
      // трогаем состав, иначе на мгновение "сбросим" его в пустой, пока
      // useUser() параллельно (в этом же компоненте) ещё резолвится, и
      // именно в это окно можно успеть добавить игрока, который тут же
      // будет затёрт.
      if (userLoading) return;

      setIsSquadLoading(true);
      setSaveSuccess(false);
      setSaveError(null);

      if (!userId) {
        setSquad(emptySquad);
        setCaptainId(null);
        setRound(null);
        setIsLocked(false);
        setIsSquadLoading(false);
        return;
      }

      const { data: activeRound } = await supabase
        .from("rounds")
        .select("id, name, status, lock_at")
        .eq("status", "upcoming")
        .order("lock_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (!activeRound) {
        setSquad(emptySquad);
        setCaptainId(null);
        setRound(null);
        setIsLocked(false);
        setIsSquadLoading(false);
        return;
      }

      setRound(activeRound);

      const { data: existingSquad } = await supabase
        .from("fantasy_squads")
        .select("id, captain_player_id, is_locked")
        .eq("user_id", userId)
        .eq("round_id", activeRound.id)
        .maybeSingle();

      if (cancelled) return;

      if (!existingSquad) {
        setSquad(emptySquad);
        setCaptainId(null);
        setIsLocked(false);
        setIsSquadLoading(false);
        return;
      }

      const { data: rosterRows } = await supabase
        .from("fantasy_squad_players")
        .select("slot, is_captain, players(*, teams(name, short_name))")
        .eq("squad_id", existingSquad.id);

      if (cancelled) return;

      const nextSquad: Squad = { ...emptySquad };
      (rosterRows as unknown as SquadPlayerRow[] | null)?.forEach((row) => {
        if (row.players) {
          nextSquad[row.slot] = row.players;
        }
      });

      setSquad(nextSquad);
      setCaptainId(existingSquad.captain_player_id);
      setIsLocked(existingSquad.is_locked);
      setIsSquadLoading(false);
    }

    loadRoundAndSquad();

    return () => {
      cancelled = true;
    };
  }, [userId, userLoading]);

  function addPlayer(player: Player) {
    setSquad((current) => {
      const alreadyIn = ALL_SLOTS.some(
        (slot) => current[slot]?.id === player.id
      );
      if (alreadyIn) return current;

      const currentSpent = ALL_SLOTS.reduce((total, slot) => {
        return total + (current[slot]?.price ?? 0);
      }, 0);

      if (currentSpent + player.price > budget) {
        alert("Недостаточно бюджета");
        return current;
      }

      const sameTeamCount = ALL_SLOTS.filter(
        (slot) => current[slot]?.team_id === player.team_id
      ).length;

      if (sameTeamCount >= 2) {
        alert("Максимум 2 игрока из одной команды");
        return current;
      }

      const positionSlot = player.position as Slot;
      if (!current[positionSlot]) {
        return { ...current, [positionSlot]: player };
      }

      const freeBench = BENCH_SLOTS.find((slot) => !current[slot]);
      if (freeBench) {
        return { ...current, [freeBench]: player };
      }

      alert(
        `Нет свободного места: позиция ${player.position} занята и все запасные слоты заполнены`
      );
      return current;
    });
  }

  function removePlayer(playerId: string) {
    setSquad((current) => {
      const slot = ALL_SLOTS.find((s) => current[s]?.id === playerId);
      if (!slot) return current;
      return { ...current, [slot]: null };
    });

    setCaptainId((current) => (current === playerId ? null : current));
  }

  function setCaptain(playerId: string | null) {
    setCaptainId(playerId);
  }

  async function saveSquad() {
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

    let currentSquadId: string;

    if (existingSquad) {
      currentSquadId = existingSquad.id;

      const { error: updateError } = await supabase
        .from("fantasy_squads")
        .update({
          budget_spent: spent,
          captain_player_id: captainId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentSquadId);

      if (updateError) {
        setSaveError(updateError.message);
        setIsSaving(false);
        return;
      }

      await supabase
        .from("fantasy_squad_players")
        .delete()
        .eq("squad_id", currentSquadId);
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

      currentSquadId = newSquad.id;
    }

    const rows = ALL_SLOTS.filter((slot) => squad[slot]).map((slot) => ({
      squad_id: currentSquadId,
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

    setIsLocked(false);
    setSaveSuccess(true);
    setIsSaving(false);
  }

  return (
    <FantasyContext.Provider
      value={{
        squad,
        addPlayer,
        removePlayer,
        budget,
        spent,
        remaining,
        captainId,
        setCaptain,
        round,
        isSquadLoading,
        isLocked,
        isSaving,
        saveError,
        saveSuccess,
        saveSquad,
      }}
    >
      {children}
    </FantasyContext.Provider>
  );
}

export function useFantasy() {
  const context = useContext(FantasyContext);

  if (!context) {
    throw new Error(
      "useFantasy должен использоваться внутри FantasyProvider"
    );
  }

  return context;
}
