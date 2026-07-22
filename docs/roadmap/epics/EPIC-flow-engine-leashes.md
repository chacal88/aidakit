# Coleiras mecânicas do flow engine

Goal: fechar os pontos onde a coleira do flow depende de comportamento do modelo em vez de mecânica verificável — caps, metas, paralelismo e memória de retry passam a ser estruturais no engine/validators, nunca doutrina em prosa.

Origem: análise de gaps sobre `governance/flows/*.yaml` + `governance/engine/` (2026-07-22). Ordem por risco + valor: 1–2 corrigem buracos de coleira ativos; 3–4 são evolução estrutural; 5 é capacidade nova do build (registro diferido) — fora do tema coleira, mas mesma superfície (engine/CLI).

## Features

- **Feature:** Cap mecânico de retries — changes: engine-max-visits
  - Aceite: uma aresta de retorno visitada >N vezes cai em `human_gate` de escalação ("N rounds sem consenso: intervir ou abortar?"), nunca em loop infinito; N configurável por step no YAML. Hoje o "capped rounds" vive só no texto do skill `aidakit:review`.
- **Feature:** Coleira das metas — changes: acceptance-leash
  - Aceite: o brainstorm emite `acceptance-manifest.json` (meta → como verificar) e `check-acceptance.js` trava o step `pr` enquanto houver critério sem teste/evidência mapeada — mesmo tratamento do doc-leash (`check-doc-manifest.js`).
- **Feature:** Retry com memória — changes: retry-memory
  - Aceite: ao voltar para `implement`, o agente recebe histórico estruturado das tentativas (round, causa da falha em cada uma); os eventos de correção alimentam `aidakit:learn` como matéria-prima de DNA (erro recorrente ≥3x).
- **Feature:** Bench paralelo estrutural — changes: flow-parallel-bench
  - Aceite: o dispatch do bench de review é expresso como `type: parallel` no YAML do flow (step type hoje dormente no engine), tornando o paralelismo estrutural; `check-bench.js` permanece como verificação a posteriori.
- **Feature:** Registro diferido no build (débito) — changes: add-debit
  - Aceite: `/aidakit:build` ganha um modo registro-apenas — o pedido vira change no roadmap (backlog) + flow pausado estacionado, sem plan/implement; o `resume` retoma para o planejamento sem re-explicar o contexto. Assunção em aberto (brainstorm pulado por delegação do dono): a forma — novo verbo do CLI, flow `register.yaml` ou input do `fast` — é decidida no plan.
