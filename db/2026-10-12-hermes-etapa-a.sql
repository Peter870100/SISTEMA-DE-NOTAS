-- ===== Hermes etapa A (2026-10-12) =====
alter table tentativas add column if not exists saidas integer not null default 0;
alter table tentativas add column if not exists tempo_fora_seg integer not null default 0;
alter table tentativas add column if not exists eventos_saida jsonb;
alter table aula_progresso add column if not exists tempo_assistido_seg integer not null default 0;
alter table aula_progresso add column if not exists saidas integer not null default 0;
alter table aula_progresso add column if not exists tempo_fora_seg integer not null default 0;
