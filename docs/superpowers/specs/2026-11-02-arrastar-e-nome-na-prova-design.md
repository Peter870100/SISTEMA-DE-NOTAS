# Arrastar questões e "Nome na prova" — design

Data: 2026-11-02. Continua `2026-11-01-editar-prova-word-design.md` (mesma branch, ainda não publicada).

## Por quê

Testando o painel "Editar", o Peter achou lento mudar a ordem só com as setas (uma posição por clique) e
sentiu falta do nome do professor na prova. Muitos professores são conhecidos por apelido (o Fernando é
"Cenoura"), e é esse nome que deve sair na folha.

## Objetivos

1. **Arrastar**: no painel "Editar", cada questão da lista pode ser arrastada para cima ou para baixo até
   a posição desejada. As setas ↑ ↓ continuam (e servem para teclado).
2. **Nome na prova**: a linha "Professor(a)" da prova vem preenchida com o nome do professor dono da prova:
   o **nome na prova** (apelido) se ele cadastrou, senão o `nome` normal. Quando a prova é de uma única
   matéria, vem junto: "Professor(a): Cenoura — História".
3. O apelido é guardado **na conta do professor, uma vez só** (`professores.nome_prova`), e vale para todas
   as provas dele (antigas e novas, porque a folha é montada na hora). Pode ser preenchido:
   - no painel "Editar" da prova (campo "Nome na prova", salvo junto com "Salvar cabeçalho");
   - em Configurações (cartão "Nome na prova");
   - no cadastro de professor feito pelo admin (`/admin/professores`), campo opcional.

## Decisões (do Peter)

- Apelido fica na conta, preenchido uma vez; em branco = nome normal.
- Manter as setas além do arrastar.
- "Simulado" já sai no título ("Simulado – História"); nada novo a fazer além de manter.

## Regras

- `nome_prova`: texto livre, trim, até 60 caracteres; vazio grava `null`.
- O nome mostrado é sempre o do **dono da prova** (`provas_word.professor_id`), não de quem está vendo
  (o dono da plataforma vendo a prova de outro vê o nome do outro).
- No painel "Editar", o campo "Nome na prova" só aparece para o próprio professor da prova (o `dono`
  editando a prova de outro não muda o apelido alheio). Texto de ajuda: "Vale para todas as suas provas.
  Em branco, sai o seu nome."
- Linha "Professor(a)": o nome entra como texto (sem traço de preencher) no lugar do traço; "Data" e
  "Nota" continuam como hoje (inclusive a regra da data informada na linha extra). Word e prévia iguais,
  via `linhasIdentificacao`. Nome longo não pode estourar a linha (mesmo cuidado da linha extra).
- Gabarito: sem mudança (só título + "Gabarito comentado").
- Matéria na linha: só quando `filtros.materia` é uma matéria única (rótulo de `MATERIAS`); com várias
  matérias ou nenhuma, só o nome.
- Arrastar: funciona com mouse e no toque (celular), com uma alça visível em cada linha (ícone de
  "arrastar") e indicação de onde vai cair. Soltar chama a mesma ação de mover (`moverQuestaoProva` com
  `de`, `para` e `questaoId`); enquanto pendente, não dá para arrastar. Mensagem de sucesso: nenhuma
  (igual às setas). Sem biblioteca nova se der para fazer bem com pointer events; se usar biblioteca,
  conferir autenticidade antes.

## Fora do escopo

- Apelido diferente por prova.
- Mudar a Hermes (os links já mostram o nome porque o .docx é montado na hora).

## SQL (manual)

```sql
alter table professores add column if not exists nome_prova varchar(60);
NOTIFY pgrst, 'reload schema';
```
