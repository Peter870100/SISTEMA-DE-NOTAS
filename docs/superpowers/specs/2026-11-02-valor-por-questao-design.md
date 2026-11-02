# Valor por questão na prova em Word — design

Data: 2026-11-02. Continua `2026-11-01-editar-prova-word-design.md` e `2026-11-02-arrastar-e-nome-na-prova-design.md`
(mesma branch `feature/editar-prova-word`, ainda não publicada).

## Por quê

O professor escreve à mão o valor de cada questão. Com o valor total da prova, o sistema já sabe dividir; o
professor só mexe nas questões que fogem do padrão (uma difícil vale mais) e o resto se redistribui sozinho.
E quem não quer valor nenhum não deve ver valor nenhum.

## Regra central (do Peter)

- **Sem valor pedido, sem valor nenhum**: nem no cabeçalho, nem nas questões. Igual a hoje.
- **Com valor total** (ex.: 10): o cabeçalho mostra o valor e **cada questão já sai com o seu valor**,
  dividido automaticamente.
- **Valor fixo numa questão** (ex.: questão 1 vale 2): as outras dividem o que sobra (8).

## Objetivos

1. **Valor total numérico.** O campo "Valor" do cabeçalho passa a aceitar só número (vírgula ou ponto, até
   1 casa decimal, maior que 0, até 1000). Na folha sai "Valor: 10,0" (sempre 1 casa, vírgula). Valores antigos
   em texto livre que não forem número: ao ler, são tratados como "sem valor total" para a divisão, mas o
   texto antigo continua aparecendo no cabeçalho como hoje até o professor salvar de novo (aí precisa ser número).
2. **Valor por questão.** Cada questão da prova pode ter um valor **fixo** (número, mesma regra) ou ficar
   **automática** (sem valor guardado).
3. **Divisão.** Resto = total − soma dos fixos, dividido entre as n automáticas em 1 casa decimal, com
   aritmética em décimos inteiros (sem erro de ponto flutuante): base = ⌊resto/n⌋ (em décimos); a sobra
   k = resto − base×n (em décimos, 0 ≤ k < n) é dada como +0,1 às **k últimas automáticas** na ordem da prova.
   Assim os valores diferem no máximo 0,1 e a soma bate exatamente com o total.
   Ex.: 10 em 3 → 3,3 + 3,3 + 3,4. 10 com Q1 = 2,0 e 9 automáticas → resto 8,0: uma com 0,8 e oito com 0,9.
   Se resto < 0 → não divide (aviso do item 7). Se resto ≥ 0 mas base = 0 para alguma, ela fica 0,0
   (ex.: 0,5 em 10 questões) — permitido.
4. **Mostrar ou não.** Opção "Mostrar o valor de cada questão" (guardada na prova). Vem **ligada** quando a
   prova tem valor total; o professor pode desligar. Desligada ou sem total: nada por questão.
5. **Na folha (Word, prévia e gabarito)**: com a opção ligada e total válido, cada questão mostra
   "**Questão N** (v)" (ex.: "(1,0)"), depois do número e antes do enunciado, nos dois formatos, iguais.
6. **Painel "Editar"**: cada questão da lista ganha uma caixinha de valor. Vazia mostra o valor automático
   como sugestão (placeholder). Preenchida = fixo. Apagar = volta a automática. A caixinha "Mostrar o valor de
   cada questão" fica na seção Cabeçalho, perto de "Valor". Salvar os valores das questões: ao sair da caixinha
   (blur/Enter), uma ação por questão, sem recarregar a prévia inteira se der (pode recarregar como as outras ações).
7. **Avisos (painel)**:
   - fixos somando mais que o total → "Os valores fixos (12,0) passam do valor da prova (10,0)." e a ação recusa;
   - todas fixas e soma ≠ total → "As questões somam 9,0 e a prova vale 10,0." (só aviso; a folha mostra os fixos);
   - valor fixo sem total → permitido guardar, mas não aparece na folha (sem total, sem valores) — o painel
     avisa "Preencha o valor da prova para os valores aparecerem."
8. **Acompanhar a questão**: arrastar leva o valor junto; **trocar** mantém o valor na posição (a nova
   herda); **remover** some com o valor (volta para a divisão).
9. **Gerar prova (site)**: em `/banco/provas-word` (formulário de nova prova), campo opcional "Valor da prova".
   Preenchido → cabeçalho com valor e opção "mostrar" ligada.
10. **Gerar prova (Hermes)**: `gerar_prova_word` ganha parâmetros opcionais `valor` (total) e
    `valores_questoes` (lista de `{ numero, valor }`, numero = posição 1..n). Sem `valor` → sem valor nenhum.
    A descrição de `previa_prova_word` passa a mandar a Hermes perguntar, na mesma mensagem do cenário,
    "Quanto vale a prova? (se não quiser valor, diga 'sem valor')", a menos que o professor já tenha dito.
    Se ele disser o valor de questões específicas, ela passa em `valores_questoes`.
    `links`/respostas da Hermes continuam iguais.
11. **Texto para o prompt de sistema da Hermes**: em `docs/folha-tarefa.md`, um bloco curto pronto para o Peter
    colar na Hermes, reforçando a regra (perguntar o valor; "sem valor" = não manda; repassar valores por questão).

## Fora do escopo

- Pontuação por alternativa, meio ponto por item, valores com 2 casas.
- Corrigir/aplicar nota aos alunos a partir desses valores.

## Anti-objetivos

- Prova sem valor pedido aparecer com qualquer valor.
- Prévia e Word com valores diferentes.
- Soma das questões (com total, sem todas fixas) diferente do total.

## Dados (SQL manual)

```sql
alter table prova_word_questoes add column if not exists valor numeric(6,1);
-- cabecalho.valor continua em provas_word.cabecalho (texto numérico); a opção vai em cabecalho.valorPorQuestao (boolean)
NOTIFY pgrst, 'reload schema';
```

`valor` null = automática. A troca (UPDATE de `questao_id` na mesma linha) já mantém o valor.

## Deixado ao construtor

- Onde exatamente pôr "(v)" no .docx (mesmo run do número, negrito ou não) — igual na prévia.
- Formato interno do número (string "10.0" ou number) — validar com função pura e testes.

## Decisões tomadas na revisão (escolhas do Claude, conferir)

1. **Valor antigo em texto**: "Salvar cabeçalho" só exige número se o campo Valor **mudou** em relação ao
   salvo. Um texto antigo intacto não bloqueia salvar outros campos.
2. **Total abaixo dos fixos** (ao mudar o total, remover ou trocar): salvar o total **é aceito**, com o aviso
   do item 7 no painel. A ação de **fixar** um valor de questão que faça os fixos passarem do total é recusada.
3. **O que a folha mostra quando a conta não fecha** (fixos > total): **nenhum valor por questão**. Isso vale para
   o Word, a prévia e o gabarito, e o painel avisa. Uma única função pura calcula os valores (ou "nenhum")
   e alimenta os três. Todas fixas e soma ≠ total: mostra os fixos, com o aviso só no painel.
4. **Automática fica `null` no banco**. O valor calculado nunca é gravado. Site e Hermes gravam só os fixos.
5. **Hermes, entradas inválidas**: `valores_questoes` sem `valor`, `numero` fora de 1..n ou repetido, valor
   não numérico ou fixos > total são **recusados antes de gerar**, com mensagem clara para a Hermes repassar.
6. **Opção "mostrar" ausente** (`cabecalho.valorPorQuestao` sem valor) = **desligada**. Ela só é ligada
   automaticamente quando o valor total é preenchido: ao gerar com valor (site ou Hermes) ou quando o professor
   preenche o total no painel e salva, se antes não havia total. Provas existentes não mudam sozinhas.
