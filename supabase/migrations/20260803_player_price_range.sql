-- Диапазон цен игроков изменился с 6-13 на 8-17 (см. lib/pricing.ts).
alter table players drop constraint if exists players_price_check;
alter table players add constraint players_price_check check (price >= 8 and price <= 17);
