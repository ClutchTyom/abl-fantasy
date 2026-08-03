"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Player } from "@/types/player";

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

type FantasyContextType = {
  squad: Squad;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  budget: number;
  spent: number;
  remaining: number;
  captainId: string | null;
  setCaptain: (playerId: string | null) => void;
};

const FantasyContext = createContext<FantasyContextType | undefined>(
  undefined
);

export function FantasyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
const [squad, setSquad] = useState<Squad>(emptySquad);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const budget = 100;

  const spent = ALL_SLOTS.reduce((total, slot) => {
    return total + (squad[slot]?.price ?? 0);
  }, 0);

  const remaining = budget - spent;

useEffect(() => {
    const saved = localStorage.getItem("abl-fantasy-squad");
    const savedCaptain = localStorage.getItem("abl-fantasy-captain");

    if (saved) {
      try {
        setSquad({ ...emptySquad, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem("abl-fantasy-squad");
      }
    }

    if (savedCaptain) {
      setCaptainId(savedCaptain);
    }

    setIsLoaded(true);
  }, []);

useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("abl-fantasy-squad", JSON.stringify(squad));
  }, [squad, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (captainId) {
      localStorage.setItem("abl-fantasy-captain", captainId);
    } else {
      localStorage.removeItem("abl-fantasy-captain");
    }
  }, [captainId, isLoaded]);

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