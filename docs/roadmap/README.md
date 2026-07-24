# Roadmap

O planejamento do projeto mantido no repo: **épicos agrupam features, features apontam para changes** pela chave única `change-id` (§2.7 — o mesmo id nomeia branch, sufixo de PR, `docs/features/<id>/` e o diretório de archive).

O status de cada item é **derivado do disco** por `governance/validators/derive-roadmap-status.js` — nunca escrito à mão. A view Now/Next/Later vive em [ROADMAP.md](ROADMAP.md) (gerada; não editar).

Precedência: em divergência com DOCS.md / PROCESS.md, a doutrina vence.

## Épicos

- [EPIC-flow-engine-leashes](epics/EPIC-flow-engine-leashes.md) — Coleiras mecânicas do flow engine (caps de retry, coleira das metas, retry com memória, bench paralelo estrutural)
- [EPIC-flow-cli-ux](epics/EPIC-flow-cli-ux.md) — Experiência de linha de comando dos flows (agrupamento de comandos + inputs, tabela de progresso, sumários de passo)
- [EPIC-delivery-automation](epics/EPIC-delivery-automation.md) — Automação de entrega (merge autônomo opt-in do PR, gated por ADR-008)
