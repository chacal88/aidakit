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
  - Aceite: `/aidakit:flow-build` ganha um modo registro-apenas — o pedido vira change no roadmap (backlog) + flow pausado estacionado, sem plan/implement; o `resume` retoma para o planejamento sem re-explicar o contexto. Assunção em aberto (brainstorm pulado por delegação do dono): a forma — novo verbo do CLI, flow `register.yaml` ou input do `fast` — é decidida no plan.
- **Feature:** Arquivamento do loop-var-resume (bookkeeping) — changes: archive-loop-var-resume
  - Aceite: `docs/features/loop-var-resume/` movido via `git mv` para `docs/archive/2026-07-22-loop-var-resume/` (data de merge do PR #5, `2026-07-22T19:54:51Z`), `derive-roadmap-status.js --root .` verde (change não declarado no roadmap na época — só sai da área de trabalho, nenhuma linha de status muda; regen do `ROADMAP.md` apenas se a visão derivada mudar), PR `chore(docs): archive loop-var-resume` para main parado na URL — o merge é sempre humano.
- **Feature:** `runs` distingue erro de infraestrutura de veredito negativo — changes: runs-error-routing
  - Aceite: o step `runs` separa "comando/módulo ausente" (erro de infra: surge e interrompe o flow) de "validador julgou NÃO" (exit≠0: roteia normalmente via `on_failure`) — hoje um `Cannot find module` sai como exit≠0 comum e entra em loop de correção via `on_failure` em vez de expor o erro real (achado em `validator-path-resolution`, owner's request §"Observação sobre prioridade").
- **Feature:** Request livre vs change-id nos flows — changes: flow-request-vs-change-id
  - Aceite: `select` reporta o change-id como output estruturado (`resume … success change_id=<id>`, coleira fail-closed no engine) e todo caminho `.aidakit/tasks/…`/`.aidakit/dna/…` dos flows chaveia em `${context.select.change_id}`; valores `${…}` em `command` viajam como dado de ambiente (`$AIDAKIT_VAR_n`, ADR-006) — um request multilinha nunca mais explode um `runs` (exit 127 / "test: too many arguments" da captura `full-260724-ca264a`) nem entra em loop implement↔check; regressão coberta em `engine.test.mjs` §9.
- **Feature:** Caminho de validador para invocações diretas de agente/skill — changes: agent-validator-paths
  - Aceite: as invocações diretas de validador ensinadas a agentes/skills (`agents/orchestrator.md:50`, `agents/doc-planner.md:155`, `skills/roadmap/SKILL.md:64`) resolvem o caminho do kit independente do cwd — hoje carregam o mesmo defeito de caminho relativo que `validator-path-resolution` corrigiu nos flows, mas por um vetor que o `AIDAKIT_GOVERNANCE` injetado pelo `runs.js` não alcança (essas sessões Bash não passam pelo `runs` step); precisa de mecanismo próprio.
- **Feature:** Status derivado do git compartilhado (single-valued entre worktrees) — changes: roadmap-status-from-shared-git
  - Aceite: `derive-roadmap-status.js` deriva `in-progress`/`done` do estado git COMPARTILHADO (dir committado em qualquer branch via `git ls-tree` por ref, O(branches), sem varrer worktree) unido à working-tree local; a resposta é a mesma de qualquer worktree/clone; sem git, degrada pra disk-only idêntico ao anterior. Registrado em `ADR-007` (amenda `ADR-002`). **Entregue** — PR #21, `roadmap.test.mjs` 28/28. O complemento (o flow commitar o plano cedo, pra o sinal compartilhado existir sem depender da working-tree que autorou) está em `ADR-009` (passo `commit_plan` do `full.yaml`), condicionado ao `flow-request-vs-change-id` pra `${context.select.change_id}` popular de forma confiável.
