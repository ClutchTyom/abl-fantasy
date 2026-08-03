export interface Round {
  id: string; // или number, в зависимости от твоей БД
  name: string; // Например: "Тур 1", "Тур 2"
  start_time: string; // ISO дата начала первого матча тура
  end_time: string;   // ISO дата окончания последнего матча тура
  is_active: boolean;
  created_at: string;
}