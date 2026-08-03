// Позиции для строгости типов
export type StarterPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type SlotType = `STARTER_${StarterPosition}` | 'BENCH_1' | 'BENCH_2';

export interface FantasyTeam {
  id: string;
  user_id: string;
  round_id: string; // Привязка к туру
  budget: number;   // 100 монет
  spent: number;    // Сколько потрачено
  is_locked: boolean; // Заблокирован ли состав
  created_at: string;
  updated_at: string;
}

// Отдельный слот в ростере. Это ключ к правильной работе автозамен и капитана!
export interface RosterSlot {
  id: string;
  user_team_id: string;
  player_id: string; // UUID или number (приведи к типу твоей таблицы players)
  slot_type: SlotType;
  is_captain: boolean;
  
  // Опционально: для удобного отображения на фронте без дополнительных запросов
  // player?: Player; 
}

// Удобный тип для фронта, объединяющий команду и её состав
export interface FantasyTeamWithRoster extends FantasyTeam {
  roster: RosterSlot[];
}