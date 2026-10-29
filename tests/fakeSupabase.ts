import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

// Минимальная подделка клиента supabase-js для тестов: поддерживает
// from().select().in()/.eq()/.gte()/.lt()/.range() и await, этого хватает
// для computeAllSquadResults. Встроенные связи (fantasy_weeks(...)) не
// разворачиваются — тестовые строки уже содержат их как вложенные поля.
export function fakeSupabase(tables: Tables): SupabaseClient {
  function builder(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    let rangeFrom = 0;
    let rangeTo = Infinity;

    const api = {
      select: () => api,
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return api;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return api;
      },
      gte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) >= value);
        return api;
      },
      lt: (column: string, value: string) => {
        filters.push((row) => String(row[column]) < value);
        return api;
      },
      range: (from: number, to: number) => {
        rangeFrom = from;
        rangeTo = to;
        return api;
      },
      then: (
        resolve: (value: { data: Row[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        const data = (tables[table] ?? [])
          .filter((row) => filters.every((f) => f(row)))
          .slice(rangeFrom, rangeTo === Infinity ? undefined : rangeTo + 1);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };

    return api;
  }

  return { from: builder } as unknown as SupabaseClient;
}
