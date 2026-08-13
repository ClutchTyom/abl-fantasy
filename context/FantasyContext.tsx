"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Player } from "@/types/player";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/useUser";
import { getOrCreateCurrentFantasyWeek } from "@/lib/fantasyWeeks";

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
  starts_at: string;
  ends_at: string;
};

type SquadPlayerRow = {
  slot: Slot;
  is_captain: boolean;
  player_id: string;
};

async function buildSquadFromRoster(squadId: string): Promise<Squad> {
  const { data: rosterRows, error: rosterError } = await supabase
    .from("fantasy_squad_players")
    .select("slot, is_captain, player_id")
    .eq("squad_id", squadId);

  if (rosterError) {
    console.error(
      `[FantasyContext] Не удалось загрузить игроков состава: ${rosterError.message}`
    );
  }

  const rows = (rosterRows as SquadPlayerRow[] | null) ?? [];
  const playerIds = rows.map((row) => row.player_id);
  const nextSquad: Squad = { ...emptySquad };

  if (playerIds.length === 0) return nextSquad;

  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("*, teams(name, short_name, division, logo_url)")
    .in("id", playerIds);

  if (playersError) {
    console.error(
      `[FantasyContext] Не удалось загрузить карточки игроков: ${playersError.message}`
    );
  }

  const playersById = new Map(
    ((playersData as Player[] | null) ?? []).map((p) => [p.id, p])
  );

  rows.forEach((row) => {
    const player = playersById.get(row.player_id);
    if (player) nextSquad[row.slot] = player;
  });

  return nextSquad;
}

type FantasyContextType = {
  squad: Squad;
  addPlayer: (player: Player) => void;
  addPlayerToSlot: (player: Player, slot: Slot) => void;
  removePlayer: (playerId: string) => void;
  budget: number;
  spent: number;
  remaining: number;
  captainId: string | null;
  setCaptain: (playerId: string | null) => void;
  round: ActiveRound | null;
  isSquadLoading: boolean;
  isCarriedOver: boolean;
  isLocked: boolean;
  isSquadComplete: boolean;
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
  const [isAdminLocked, setIsAdminLocked] = useState(false);
  const [isTimeLocked, setIsTimeLocked] = useState(false);
  const [isSquadLoading, setIsSquadLoading] = useState(true);
  const [isCarriedOver, setIsCarriedOver] = useState(false);

  // Состав заблокирован, если это выставил админ ИЛИ если время начала
  // тура (round.lock_at) уже прошло. Перепроверяем по таймеру, а не при
  // каждом рендере (Date.now() в теле рендера — impure и запрещено
  // правилами React), чтобы блокировка сработала сама, даже если
  // пользователь просто держит вкладку открытой дольше дедлайна.
  useEffect(() => {
    if (!round) {
      queueMicrotask(() => setIsTimeLocked(false));
      return;
    }

    function checkLock() {
      queueMicrotask(() =>
        setIsTimeLocked(new Date(round!.starts_at).getTime() <= Date.now())
      );
    }

    checkLock();
    const interval = setInterval(checkLock, 30000);
    return () => clearInterval(interval);
  }, [round]);

  const isLocked = isAdminLocked || isTimeLocked;

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const budget = 100;

  const spent = ALL_SLOTS.reduce((total, slot) => {
    return total + (squad[slot]?.price ?? 0);
  }, 0);

  const remaining = budget - spent;
  const isSquadComplete = ALL_SLOTS.every((slot) => squad[slot] !== null);

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
        setIsAdminLocked(false);
        setIsCarriedOver(false);
        setIsSquadLoading(false);
        return;
      }

      let activeRound: ActiveRound;

      try {
        activeRound = await getOrCreateCurrentFantasyWeek();
      } catch (err) {
        console.error(
          `[FantasyContext] Не удалось загрузить активный тур: ${err instanceof Error ? err.message : err}`
        );
        setSquad(emptySquad);
        setCaptainId(null);
        setRound(null);
        setIsAdminLocked(false);
        setIsCarriedOver(false);
        setIsSquadLoading(false);
        return;
      }

      if (cancelled) return;

      setRound(activeRound);

      const { data: existingSquad, error: squadError } = await supabase
        .from("fantasy_squads")
        .select("id, captain_player_id, is_locked")
        .eq("user_id", userId)
        .eq("round_id", activeRound.id)
        .maybeSingle();

      if (squadError) {
        console.error(
          `[FantasyContext] Не удалось загрузить сохранённый состав: ${squadError.message} (code: ${squadError.code}, details: ${squadError.details}, hint: ${squadError.hint})`
        );
      }

      if (cancelled) return;

      if (existingSquad) {
        const nextSquad = await buildSquadFromRoster(existingSquad.id);
        if (cancelled) return;

        setSquad(nextSquad);
        setCaptainId(existingSquad.captain_player_id);
        setIsAdminLocked(existingSquad.is_locked);
        setIsCarriedOver(false);
        setIsSquadLoading(false);
        return;
      }

      // Нет сохранённого состава на новый тур — подтягиваем состав из
      // последнего тура, за который он реально сохранён, чтобы не
      // пересобирать всё с нуля: пользователь делает трансферы, а не
      // строит команду заново каждую неделю.
      const { data: userSquads, error: previousError } = await supabase
        .from("fantasy_squads")
        .select("id, captain_player_id, fantasy_weeks(starts_at)")
        .eq("user_id", userId);

      if (previousError) {
        console.error(
          `[FantasyContext] Не удалось загрузить прошлые составы: ${previousError.message}`
        );
      }

      if (cancelled) return;

      const previousSquad = (
        (userSquads ?? []) as unknown as {
          id: string;
          captain_player_id: string | null;
          fantasy_weeks: { starts_at: string } | null;
        }[]
      )
        .filter(
          (s) => s.fantasy_weeks && s.fantasy_weeks.starts_at < activeRound.starts_at
        )
        .sort((a, b) =>
          a.fantasy_weeks!.starts_at < b.fantasy_weeks!.starts_at ? 1 : -1
        )[0];

      if (!previousSquad) {
        setSquad(emptySquad);
        setCaptainId(null);
        setIsAdminLocked(false);
        setIsCarriedOver(false);
        setIsSquadLoading(false);
        return;
      }

      const carriedSquad = await buildSquadFromRoster(previousSquad.id);
      if (cancelled) return;

      setSquad(carriedSquad);
      setCaptainId(previousSquad.captain_player_id);
      setIsAdminLocked(false);
      setIsCarriedOver(true);
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

  // Точечное добавление/замена в КОНКРЕТНЫЙ слот (для пикера в /team —
  // клик по позиции). В отличие от addPlayer(), сам не выбирает слот, а
  // проверяет бюджет/лимит "2 из одной команды" без учёта игрока, который
  // сейчас в этом слоте (его цена и команда освобождаются заменой).
  function addPlayerToSlot(player: Player, slot: Slot) {
    let assigned = false;
    let outgoingPlayerId: string | null = null;

    setSquad((current) => {
      const alreadyInAnotherSlot = ALL_SLOTS.some(
        (s) => s !== slot && current[s]?.id === player.id
      );
      if (alreadyInAnotherSlot) {
        alert("Этот игрок уже в составе");
        return current;
      }

      const spentExcludingSlot = ALL_SLOTS.reduce((total, s) => {
        if (s === slot) return total;
        return total + (current[s]?.price ?? 0);
      }, 0);

      if (spentExcludingSlot + player.price > budget) {
        alert("Недостаточно бюджета");
        return current;
      }

      const sameTeamCountExcludingSlot = ALL_SLOTS.filter(
        (s) => s !== slot && current[s]?.team_id === player.team_id
      ).length;

      if (sameTeamCountExcludingSlot >= 2) {
        alert("Максимум 2 игрока из одной команды");
        return current;
      }

      outgoingPlayerId = current[slot]?.id ?? null;
      assigned = true;
      return { ...current, [slot]: player };
    });

    if (assigned && outgoingPlayerId) {
      setCaptainId((current) => (current === outgoingPlayerId ? null : current));
    }
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

  // База (RLS) — последний рубеж защиты от записи после блокировки тура,
  // на случай если клиентская проверка isLocked не успела сработать
  // (например, время истекло прямо во время сохранения). Её сообщение об
  // ошибке техническое ("new row violates row-level security policy"),
  // подменяем на понятное.
  function friendlyError(message: string): string {
    return message.toLowerCase().includes("policy")
      ? "Тур уже заблокирован — время выбора состава истекло"
      : message;
  }

  async function saveSquad() {
    if (!user || !round) return;

    if (isLocked) {
      setSaveError("Тур уже заблокирован — время выбора состава истекло");
      return;
    }

    if (!isSquadComplete) {
      setSaveError("Заполните все 10 слотов состава перед сохранением");
      return;
    }

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
        setSaveError(friendlyError(updateError.message));
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
        setSaveError(
          insertError ? friendlyError(insertError.message) : "Не удалось создать состав"
        );
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
        setSaveError(friendlyError(rosterError.message));
        setIsSaving(false);
        return;
      }
    }

    setIsAdminLocked(false);
    setIsCarriedOver(false);
    setSaveSuccess(true);
    setIsSaving(false);
  }

  return (
    <FantasyContext.Provider
      value={{
        squad,
        addPlayer,
        addPlayerToSlot,
        removePlayer,
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
