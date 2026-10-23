-- ===== Hermes: importação de provas em PDF (2026-10-23) =====
-- Idempotente (pode colar duas vezes).
-- O bucket `questoes` passa a aceitar os PDFs originais (até 30 MB) mandados pela Hermes.
-- Mantém os tipos já aceitos (null = todos, continua null) e o limite (null = o do projeto, continua null).
update storage.buckets set
  file_size_limit = case when file_size_limit is null then null else greatest(file_size_limit, 31457280) end,
  allowed_mime_types = case when allowed_mime_types is null then null else
    array(select distinct unnest(allowed_mime_types || array['application/pdf', 'application/json'])) end
where id = 'questoes';

NOTIFY pgrst, 'reload schema';
