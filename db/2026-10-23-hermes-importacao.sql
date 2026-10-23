-- ===== Hermes: importação de provas em PDF (2026-10-23) =====
-- Idempotente (pode colar duas vezes).
-- O bucket `questoes` passa a aceitar os PDFs originais (até 30 MB) mandados pela Hermes.
-- Mantém os tipos já aceitos (null = todos, continua null) e o limite (null = o do projeto, continua null).
update storage.buckets set
  file_size_limit = case when file_size_limit is null then null else greatest(file_size_limit, 31457280) end,
  allowed_mime_types = case when allowed_mime_types is null then null else
    array(select distinct unnest(allowed_mime_types || array['application/pdf', 'application/json'])) end
where id = 'questoes';

-- Upsert por cima de um arquivo que já existe (PDF original, selecao.json, página refeita) precisa de UPDATE.
drop policy if exists "questoes_servidor_atualizar" on storage.objects;
create policy "questoes_servidor_atualizar" on storage.objects for update using (bucket_id = 'questoes') with check (bucket_id = 'questoes');

NOTIFY pgrst, 'reload schema';
