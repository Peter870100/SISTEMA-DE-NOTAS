-- ===== Relatórios: média de aprovação por escola (2026-10-22) =====
-- Idempotente (pode colar duas vezes).
alter table escolas add column if not exists media_aprovacao numeric(4,2) not null default 6.0 check (media_aprovacao >= 0 and media_aprovacao <= 10);

NOTIFY pgrst, 'reload schema';
