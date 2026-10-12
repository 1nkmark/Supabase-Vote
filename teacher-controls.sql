-- 在 Supabase SQL Editor 以管理员身份执行所需代码块。
-- 不要把管理员密钥放入前端。

-- 结束当前轮次（保留票数）
update public.resolution_rounds set is_open=false
where id=(select max(id) from public.resolution_rounds);

-- 开始新一轮：请单独选中以下事务执行。旧票保留，但新轮次从 0 开始。
begin;
lock table public.resolution_rounds in exclusive mode;
update public.resolution_rounds set is_open=false where is_open;
insert into public.resolution_rounds default values;
commit;
