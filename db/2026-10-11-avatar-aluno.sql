-- Perfil do aluno: foto JPEG reduzida (256 x 256) ou emoji, vinculado a conta.
-- Executar no SQL Editor do mesmo projeto Supabase usado pelo aplicativo.
-- Nao altera nomes, senhas, notas ou fotos de outros alunos.
ALTER TABLE public.alunos_contas
  ADD COLUMN IF NOT EXISTS avatar_perfil text
  CHECK (avatar_perfil IS NULL OR octet_length(avatar_perfil) < 400000);
NOTIFY pgrst, 'reload schema';
