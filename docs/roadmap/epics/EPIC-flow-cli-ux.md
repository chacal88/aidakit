# Experiência de linha de comando dos flows

Goal: tornar a superfície `/aidakit:*` autoexplicativo — os orquestradores de flow visualmente agrupados e distintos dos utilitários single-shot, cada comando mostrando os inputs que espera, e (temas futuros) visibilidade de progresso e resumo durante a execução de um flow.

Origem: pedido do dono em 3 temas sobre a superfície `/aidakit:*` (2026-07-24) — agrupamento dos comandos + inputs visíveis, tabela de progresso do flow, sumários entre passos. A análise do orchestrator achou que `EPIC-flow-engine-leashes` (coleiras mecânicas do engine) não cobre essas preocupações de CLI-UX, daí o épico novo.

## Features

- **Feature:** Agrupamento de comandos + inputs — changes: command-grouping-and-inputs
  - Aceite: os dois orquestradores (`build`, `design`) aparecem agrupados sob o prefixo `flow` no autocomplete `/aidakit:`, cada um dos 7 comandos responde a `$ARGUMENTS` vazio/malformado com os inputs esperados + um exemplo copy-paste, a distinção comando/skill/agente fica visível no próprio comando e em `aidakit:catalog`, a sintaxe de nomeação é travada pelo spike e registrada em `ADR-005-command-namespacing.md`, e o bump de versão do plugin garante que o rename chegue aos usuários instalados via `claude plugin update`.
- **Feature:** Tabela de progresso do flow — changes: flow-run-progress-table
  - Aceite: ao iniciar e durante a execução de um flow (`/aidakit:flow-build`, `/aidakit:flow-design`), uma tabela de progresso mostra os steps do flow e qual está em curso — tema 2, ainda sem trabalho além do registro deste épico.
- **Feature:** Sumários de passo do flow — changes: flow-step-summaries
  - Aceite: entre passos e nos human gates, o flow emite um sumário curto do que aconteceu no passo anterior antes de seguir — tema 3, ainda sem trabalho além do registro deste épico.
