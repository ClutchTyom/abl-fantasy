-- В ABL один и тот же клуб может выставлять отдельные команды в разных
-- дивизионах под одним и тем же отображаемым именем (например,
-- "AIR STAR TEAM" в WBL High и в Rest Beef — это два разных team в
-- mtgame с разными id, просто с одинаковым названием). Уникальность
-- имени команды здесь не должна требоваться: уникальность самой записи
-- уже гарантирована через teams.abl_id, а отображаемое short_name
-- разруливается генератором в lib/abl/sync.ts.
alter table teams drop constraint if exists teams_name_key;
drop index if exists teams_name_key;
