-- Quiz da aula: rascunho do professor, versao publicada e tentativas do aluno.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aula_quizzes (
  aula_id uuid PRIMARY KEY REFERENCES public.aulas(id) ON DELETE CASCADE,
  rascunho jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rascunho) = 'array' AND jsonb_array_length(rascunho) <= 5),
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(perguntas) = 'array' AND jsonb_array_length(perguntas) <= 5),
  publicado boolean NOT NULL DEFAULT false,
  versao uuid NOT NULL DEFAULT gen_random_uuid(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT publicado OR jsonb_array_length(perguntas) BETWEEN 3 AND 5)
);
CREATE TABLE IF NOT EXISTS public.aula_quiz_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL REFERENCES public.alunos_contas(id) ON DELETE CASCADE,
  versao uuid NOT NULL,
  resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aula_quiz_tentativas_aluno_idx ON public.aula_quiz_tentativas (conta_id, aula_id, versao, created_at DESC);
-- A autenticacao do app usa cookies proprios: acesso somente pelas acoes do servidor.
ALTER TABLE public.aula_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aula_quiz_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aula_quizzes, public.aula_quiz_tentativas FROM anon, authenticated;
GRANT ALL ON public.aula_quizzes, public.aula_quiz_tentativas TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
