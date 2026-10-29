-- Две дыры целостности рейтинга, найденные при сверке схемы с живой базой.
--
-- 1) Состав можно было удалить после блокировки. Политика "delete own squad"
--    не ограничена по времени (restrictive-политики блокировки есть только для
--    INSERT/UPDATE), поэтому игрок мог стереть состав неудачного тура уже после
--    его окончания и сохранить рейтинг. Каскад по FK сам RLS не проверяет,
--    так что строки fantasy_squad_players удалялись вместе с ним.
create policy "fantasy_squads_lock_delete"
  on public.fantasy_squads as restrictive for delete
  using (
    exists (
      select 1 from public.fantasy_weeks
      where fantasy_weeks.id = fantasy_squads.round_id
        and fantasy_weeks.starts_at > now()
    )
  );

-- 2) fantasy_weeks разрешала INSERT любому залогиненному с with check (true).
--    Недели участвуют в подсчёте очков (матч относится к первой неделе, в окно
--    которой он попал), поэтому "левая" неделя с произвольным окном могла
--    отнять чужие очки. Теперь вставить можно только то, что создаёт приложение
--    (lib/fantasyWeeks.ts): ближайшую будущую субботу 09:00 по Москве
--    длиной ровно 7 дней.
drop policy if exists "fantasy_weeks_insert_authenticated" on public.fantasy_weeks;
create policy "fantasy_weeks_insert_authenticated"
  on public.fantasy_weeks for insert to authenticated
  with check (
    ends_at = starts_at + interval '7 days'
    and starts_at > now()
    and starts_at <= now() + interval '7 days'
    and extract(isodow from starts_at at time zone 'Europe/Moscow') = 6
    and (starts_at at time zone 'Europe/Moscow')
        = date_trunc('day', starts_at at time zone 'Europe/Moscow') + interval '9 hours'
  );
