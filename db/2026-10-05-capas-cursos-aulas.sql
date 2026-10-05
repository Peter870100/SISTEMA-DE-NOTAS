-- Capas opcionais, sem liberar envio ou exclusão anônimos.
begin;
alter table public.cursos add column if not exists capa_caminho text;
alter table public.aulas add column if not exists capa_caminho text;
create unique index if not exists idx_cursos_capa on public.cursos (capa_caminho) where capa_caminho is not null;
create unique index if not exists idx_aulas_capa on public.aulas (capa_caminho) where capa_caminho is not null;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas', 'capas', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
-- Gravação e exclusão usam exclusivamente a chave privada do servidor.
commit;
notify pgrst, 'reload schema';
