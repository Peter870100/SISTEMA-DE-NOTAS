# API de questões

Leitura das questões **publicadas do banco geral** (ENEM, FUVEST, UNICAMP, ITA, IME, UFMS, UEMS, UFGD…).
Questões em revisão e questões do banco de cada escola não aparecem.

## Acesso

Toda chamada leva a chave no cabeçalho:

```
Authorization: Bearer <QUESTOES_API_TOKEN>
```

A chave fica só na Vercel (variável `QUESTOES_API_TOKEN`) e precisa ser diferente de `MCP_DONO_TOKEN` e
`MCP_SECRET_TOKEN`. Sem a variável, ou com chave errada, a resposta é `401`.

## Rotas

### `GET /api/questoes/resumo`

Quantas questões há por banca e ano.

```json
{ "total": 5405, "edicoes": [{ "banca": "UFMS", "ano": 2024, "questoes": 60 }] }
```

### `GET /api/questoes`

Lista paginada. Filtros (todos opcionais; listas separadas por vírgula):

| Parâmetro | Exemplo | Observação |
|---|---|---|
| `banca` | `UFMS,UEMS,UFGD` | sem diferença de maiúsculas |
| `ano` | `2025,2026` | |
| `materia` | `matematica,fisica` | portugues, literatura, ingles, espanhol, artes, educacao_fisica, historia, geografia, filosofia, sociologia, biologia, fisica, quimica, matematica |
| `area` | `natureza` | linguagens, humanas, natureza, matematica |
| `assunto` | id do assunto | o id vem no campo `assunto` de cada questão |
| `pagina` | `1` | começa em 1 |
| `limite` | `50` | de 1 a 100 (padrão 50) |

```json
{ "total": 120, "pagina": 1, "limite": 50, "tem_mais": true, "questoes": [ ... ] }
```

Ordem: banca, ano (mais novo primeiro), caderno, número.

### `GET /api/questoes/<id>`

Uma questão (`404` se não existir ou não estiver publicada).

## Questão

```json
{
  "id": "…", "banca": "UFMS", "ano": 2026, "caderno": "espanhol", "numero": 1,
  "area": "linguagens", "materia": "espanhol", "assunto": { "id": "…", "nome": "Interpretação de texto" },
  "enunciado": "texto com **negrito** e *itálico* (markdown simples)",
  "conteudo": null,
  "comando": "Assinale a alternativa correta.",
  "alternativas": [{ "letra": "A", "texto": "…" }],
  "resposta": "E", "anulada": false, "resolucao": null, "origem": "pdf",
  "figuras": [{ "alvo": "enunciado", "tipo": "recorte", "url": "https://…", "recorte": { "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.3 }, "largura": 1240, "altura": 1754, "alinhamento": "centro" }],
  "atualizada_em": "2026-10-25T…"
}
```

- `caderno`: questões de inglês e espanhol ficam no caderno do idioma (a mesma prova pode ter Espanhol 01 e Inglês 01).
- `conteudo`: documento do editor (com formatação e posição das figuras) quando a questão foi editada; senão `null` e vale `enunciado`.
- `figuras`: `alvo` é `enunciado` ou a letra da alternativa. `tipo: "arquivo"` = `url` é a própria imagem.
  `tipo: "recorte"` = `url` é a página inteira da prova (`largura` × `altura` px) e `recorte` é o quadro da figura
  em frações da página (x, y do canto superior esquerdo; w, h). Os links valem 1 hora.

## Exemplos

PowerShell:

```powershell
$h = @{ Authorization = "Bearer $env:QUESTOES_API_TOKEN" }
Invoke-RestMethod "https://www.statusavalia.com.br/api/questoes/resumo" -Headers $h
Invoke-RestMethod "https://www.statusavalia.com.br/api/questoes?banca=UFMS,UEMS,UFGD&materia=matematica&limite=100" -Headers $h
```

curl:

```bash
curl -H "Authorization: Bearer $QUESTOES_API_TOKEN" "https://www.statusavalia.com.br/api/questoes?banca=UFMS&ano=2026"
```
