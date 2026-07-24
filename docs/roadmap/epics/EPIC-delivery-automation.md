# Automação de entrega (PR → merge)

Goal: deixar o toque manual que sobra na cauda de entrega — o merge do PR — opt-in por projeto, sem afrouxar nenhum guardrail: o padrão continua sendo o `human_gate` de hoje, e a automação só liga quando o projeto declara explicitamente que confia no pipeline do kit.

Origem: pedido do dono, change `configurable-pr-automation` (2026-07-24) — como o passo `pr` já abre o PR e para na URL (`aidakit:ship`), o único toque manual real que sobrava era o merge. Épico novo porque nenhum dos dois épicos existentes (coleiras do engine, CLI-UX dos flows) cobre governança de entrega/merge.

## Features

- **Feature:** Merge autônomo opt-in do PR — changes: configurable-pr-automation
  - Aceite: um único campo `pr.auto_merge` (bool, default `false`) em `aidakit.config.yaml`, lido em runtime por um helper single-source (`governance/pr/pr-config.js`) compartilhado entre o gate `merge_route` dos dois flows e o carve-out (fail-closed) do hook `gh pr merge`; caminho padrão (sem config) byte-idêntico a hoje nos dois flows; caminho ligado roteia `pr → merge_route → auto_merge` (skill novo `aidakit:merge`, opt-in, gated por `ADR-008`), com qualquer dúvida/falha caindo explicitamente no `human_gate` `merge` (fallback universal); `gh pr merge --admin`/`--no-verify` seguem bloqueados mesmo com a automação ligada; `aidakit:ship` inalterado (nunca faz merge).
