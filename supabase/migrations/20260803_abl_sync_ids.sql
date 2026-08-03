-- Внешние идентификаторы для синхронизации с ABL (mtgame.ru), чтобы
-- повторный импорт обновлял уже созданные записи, а не плодил дубли.

alter table teams add column if not exists abl_id text unique;
alter table players add column if not exists abl_id text unique;
alter table rounds add column if not exists abl_id text unique;
alter table matches add column if not exists abl_id text unique;
