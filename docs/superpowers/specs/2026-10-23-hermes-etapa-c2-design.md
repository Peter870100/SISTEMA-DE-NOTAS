# Hermes etapa C2: professores, planilhas de qualquer escola e cursos

Data: 2026-10-23 · Status: escopo aprovado na spec da Hermes (`2026-10-12-hermes-assistente-pessoal-design.md`, Etapa C, "Escola"), com o Peter ("pode fazer"). Este documento fecha o desenho.

## Objetivo

A Hermes, a pedido do Peter:
1. **Professores:** muda o papel (admin ou professor) e o acesso a turmas (todas, ou só as liberadas), atualiza o telefone (que identifica o professor no Telegram) e gera senha provisória para um professor.
2. **Planilhas em qualquer escola:** as ferramentas antigas da planilha (`listar_turmas`, `ver_planilha`, `lancar_nota`, `criar_aluno`, …) hoje só agem no Colégio Status. Elas passam a agir na escola certa:
   - no perfil **dono**, onde hoje não existem, elas passam a existir, com o parâmetro `escola`;
   - no perfil **professor**, a escola é a do telefone e valem só as turmas liberadas.
3. **Cursos:** publicar e despublicar uma aula, e ligar um curso a turmas.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Professores: quem pode | Só no perfil **dono**. Mesma regra da tela (`exigirPoderSobreAlvo`): **ninguém mexe na conta do dono** pela Hermes. O papel `dono` não pode ser dado nem tirado por ela | Contas de professor são sensíveis |
| Professores: o que entra | `configurar_professor` (papel, acesso restrito, turmas liberadas), `telefone_professor`, `senha_provisoria_professor` (gera a senha, mostra só na resposta e grava `senha_provisoria = true`, como a tela). **Criar e excluir professor ficam de fora** | Criar e excluir mexem com convite e e-mail. Hoje o Peter faz isso pela tela, e assim continua |
| Planilha no perfil professor | **Com telefone:** a escola do professor e as turmas que ele pode ver (`escopoDoTelefone`). **Sem telefone:** continua como hoje, Colégio Status. A spec mãe manda manter: "isso continua só para as ferramentas antigas" | Compatibilidade com o uso atual pelo Telegram |
| Planilha no perfil dono | As mesmas ferramentas, com `escola` (nome ou slug). Se houver mais de uma escola e o pedido não disser qual, ela pergunta | Igual às etapas B e C1 |
| Registro | As ferramentas novas e as ferramentas antigas **que gravam** passam a registrar em `hermes_registro`. A lixeira e `criado_via` continuam como já são | A tela "Feito pela Hermes" passa a mostrar tudo |
| Cursos | Só no perfil dono. `publicar_aula` (mesma regra de `definirPublicacao`: vídeo sem duração registrada não publica) e `turmas_do_curso` (substituir a lista; turmas da escola do curso) | Mesmas regras da tela |
| Nomes | As ferramentas que gravam seguem a regra da C1: nome exato, ou pergunta. Nome parcial ou repetido nunca dispara uma ação | Já combinado |

## Não pode acontecer

- **Conta do dono** alterada pela Hermes (papel, senha, telefone, acesso).
- **Professor pelo Telegram** com telefone lançando nota em turma não liberada para ele, ou em outra escola.
- **Pedido sem telefone** no perfil professor mudando de comportamento: continua Colégio Status, como hoje.
- **Senha provisória do professor** aparecendo no registro.

## Testes

- **Unidade:**
  - escolha da escola das ferramentas antigas: dono com escola, dono sem escola com várias, professor com telefone, professor sem telefone;
  - regra "não mexer no dono";
  - textos de resposta, sem senha no registro.
- **Ponta a ponta na HARMONIA:**
  1. criar uma turma pela ferramenta antiga com `escola: HARMONIA` no perfil dono;
  2. lançar uma nota e ver a planilha;
  3. ligar um curso de teste a ela e publicar uma aula sem vídeo;
  4. professor de teste: configurar o acesso, mudar o telefone e gerar senha;
  5. limpar tudo no fim.

  Sem SQL novo.
