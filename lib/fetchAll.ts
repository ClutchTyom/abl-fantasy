import { PostgrestError } from "@supabase/supabase-js";

// Supabase (PostgREST) caps unranged .select() at 1000 rows by default.
// После синхронизации нескольких дивизионов ABL таблицы players и
// player_match_stats легко превышают этот лимит — без пагинации часть
// данных просто тихо не долетает. Гоняем запрос страницами, пока не
// получим меньше страницы (или пустую страницу).
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryPage(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
