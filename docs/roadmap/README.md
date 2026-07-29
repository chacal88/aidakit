# Roadmap

O planejamento do projeto mantido no repo: **épicos agrupam features, features apontam para changes** pela chave única `change-id` (§2.7 — o mesmo id nomeia branch, sufixo de PR, `docs/features/<id>/` e o diretório de archive).

O status de cada item é **derivado do disco** por `governance/validators/derive-roadmap-status.js` — nunca escrito à mão. A view Now/Next/Later vive em [ROADMAP.md](ROADMAP.md), **gerada por código** (`derive-roadmap-status.js --root . --write`, formato em `governance/roadmap/render-view.js`) — não editar nem redigitar à mão.

Precedência: em divergência com DOCS.md / PROCESS.md, a doutrina vence.

## Épicos

- [EPIC-flow-engine-leashes](epics/EPIC-flow-engine-leashes.md) — Coleiras mecânicas do flow engine (caps de retry, coleira das metas, retry com memória, bench paralelo estrutural)
- [EPIC-flow-cli-ux](epics/EPIC-flow-cli-ux.md) — Experiência de linha de comando dos flows (agrupamento de comandos + inputs, tabela de progresso, sumários de passo)
- [EPIC-delivery-automation](epics/EPIC-delivery-automation.md) — Automação de entrega (merge autônomo opt-in do PR, gated por ADR-008)
- [EPIC-context-caching](epics/EPIC-context-caching.md) — Cacheamento de contexto por change (L1 pack markdown, L2 embeddings cross-change avaliado depois)
- [EPIC-kit-discipline-hardening](epics/EPIC-kit-discipline-hardening.md) — Endurecimento da disciplina do próprio kit a partir do post-mortem do flow-step-summaries (review Usage, plan-gate, testes de type-gate, brainstorm literal-lock)
