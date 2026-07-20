---
description: Constrói um change do plano ao PR via o engine de flows do aidakit — start, resume, status, abort, list
---

Interface humana para construir **um change** — do plano ao PR — sobre o engine de flows executáveis (o engine em `governance/`, que NÃO muda de nome). Traduza o pedido do usuário para o CLI do engine e execute via Bash:

- `start <flow> [chave=valor ...]` → `node governance/cli.js start <flow> ...` (inicia; ex.: `build start rapido pedido="..."`)
- `resume <flow_id> <outcome>` → `node governance/cli.js resume <flow_id> <outcome>` (retoma um flow pausado)
- `status <flow_id>` → `node governance/cli.js status <flow_id>`
- `abort <flow_id>` → `node governance/cli.js abort <flow_id>`
- `list` → `node governance/cli.js list` (flows disponíveis: os defaults do plugin + os de `.aidakit/flows/` do repo)

**1º passo escolhe o change:** o primeiro passo dos flows (`governance/flows/rapido.yaml` e `completo.yaml`) roda o agente `aidakit:orchestrator` para escolher o próximo change pronto do plano (lógica antes exposta como comando à parte, agora absorvida). Você não precisa apontar o change na mão — o flow o seleciona no arranque; se o usuário nomear um change explícito no pedido, passe-o adiante como parâmetro.

**Inversão de controle:** quando o flow pausa num passo `agent`, o CLI imprime o despacho (qual skill/subagente rodar). Rode-o (via a skill/agente `aidakit:*` nomeado), obtenha o outcome, e retome com `resume`. Quando pausa num `human_gate`/`human_handoff`, apresente o prompt ao usuário e aguarde a resposta dele antes de retomar. Nunca invente um outcome — um outcome inválido re-pausa o gate.

Guia completo: `docs/guides/flows.md`. Fonte da verdade do engine: `governance/README.md`.

Pedido do usuário: $ARGUMENTS

<!-- aidakit v0.3 — /aidakit:build: constrói um change (engine de flows em governance/); 1º passo absorve a escolha do change, 2026-07-17 -->
