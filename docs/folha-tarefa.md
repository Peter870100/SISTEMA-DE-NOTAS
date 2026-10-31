# Folha de tarefa (.docx)

Gera a folha do aluno e o gabarito comentado, em Word, a partir de questões do banco.

## Como pedir ao Claude Code

Exemplo de frase:

> Monte uma folha de tarefa de Matemática sobre porcentagem com 10 questões do banco, título "Tarefa de Matemática — Porcentagem".

O Claude escolhe as questões pelo MCP do dono (`statusavalia-dono`) e roda o script abaixo.

## Comando do script

```
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --ids id1,id2,id3
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --subtitulo "9º ano" --ids id1,id2,id3
npx tsx scripts/folha-tarefa.ts --titulo "Tarefa de Matemática — Porcentagem" --geracao <id-da-geracao>
```

- `--subtitulo` (opcional): linha abaixo do título no cabeçalho, ex.: `--subtitulo "9º ano · Ensino Fundamental"`.
- `--ids`: ids das questões, na ordem desejada.
- `--geracao`: todas as questões de uma geração por IA (a ordem de criação é só aproximada; quando a ordem importar, use `--ids` na ordem devolvida por `salvar_questoes`).
- Grava em `folhas/` (ignorada pelo git): `AAAA-MM-DD-<titulo>.docx` (data local) e `AAAA-MM-DD-<titulo>-gabarito.docx`, e imprime os dois caminhos.
- As bolinhas das alternativas (padrão do caderno do ENEM) vêm de `public/folha/alternativa-A.png` … `-E.png`, regeneráveis com `npx tsx scripts/gerar-bolinhas-folha.ts`.
- Avisa quando uma questão tem figura ou formatação especial que o .docx não reproduz.
- Lê `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do `.env.local` (somente leitura no banco).

## Ligar o Claude Code ao MCP do dono

O token (`MCP_DONO_TOKEN`) fica só no `.env.local`/Vercel. **Não cole o token no chat.**
Rode o comando abaixo no terminal, lendo a linha do arquivo para uma variável sem imprimi-la.

PowerShell (na pasta do projeto):

```powershell
$t = (Get-Content .env.local | Where-Object { $_ -like 'MCP_DONO_TOKEN=*' } | Select-Object -First 1).Substring('MCP_DONO_TOKEN='.Length).Trim('"')
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer $t"
Remove-Variable t
```

Bash:

```bash
t=$(grep '^MCP_DONO_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '"')
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer $t"
unset t
```

Forma genérica (placeholder, não é um valor real):

```
claude mcp add --transport http --scope local statusavalia-dono https://www.statusavalia.com.br/api/mcp/dono --header "Authorization: Bearer <MCP_DONO_TOKEN do .env.local>"
```

Use `--scope local` (não `project`) para o token não ir parar em arquivo versionado.
