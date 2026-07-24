# Tasks — configurable-pr-automation

**Change ID:** `configurable-pr-automation`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `config + engine/flows + hook (aidakit.config, governance/, hooks/) — feature com supersessão de governança (ADR-008)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **TDD, testes primeiro.** Cada regra do reader, cada rota da cauda e cada shape do carve-out do hook ganham um teste **RED** antes do código **GREEN**, depois REFACTOR. Idioma dos testes: Node puro `.mjs`, sem framework — `let pass=0, fail=0`, `ok(cond,name)`, `eq(a,b,name)`, `process.exit(fail?1:0)`, módulos via `await import(...)` (espelhar [governance/__tests__/engine.test.mjs](../../../governance/__tests__/engine.test.mjs)). **Anti-drift ([GOVERNANCE.md](../../../GOVERNANCE.md) §8):** re-inspecionar o repo antes de codar; qualquer premissa da [design.md](design.md) que tiver mudado → PARAR e reportar.

## 1. Setup

- [x] Re-ler a [design.md](design.md) contra o código vivo: confirmar a cauda `pr → merge` em [full.yaml:273-303](../../../governance/flows/full.yaml) e [fast.yaml:203-234](../../../governance/flows/fast.yaml); que `human_gate` sempre pausa ([steps/human-gate.js](../../../governance/engine/steps/human-gate.js)); que o hook bloqueia `gh pr merge` em [pre-bash.js:47-50](../../../hooks/pre-bash.js); que `projectRoot()` resolve a raiz ([persistence.js](../../../governance/engine/persistence.js)); e que `select` já declara `outputs: {success: [change_id]}` em `main` ([full.yaml:37-39](../../../governance/flows/full.yaml), [fast.yaml:81](../../../governance/flows/fast.yaml), commit `c43205f`) — dependência **satisfeita**. Se algo divergir, corrigir a [design.md](design.md) ANTES de codar. **Divergência encontrada e corrigida:** `persistence.js` `projectRoot()` NÃO sobe diretórios (só honra `AIDAKIT_PROJECT_ROOT` ou cai em `process.cwd()`) — o precedente real de "subir até achar `.aidakit/`" é o helper local `findProjectRoot()` de `check-doc-manifest.js:99-108`. `design.md` corrigido com a citação certa antes de codar; sem impacto no comportamento-alvo.
- [x] Criar `governance/__tests__/pr-automation.test.mjs` com o esqueleto do harness (`pass`/`fail`, `ok`/`eq`, `process.exit(fail?fail:0)`) e um builder de fixture de config temporária (raiz isolada via `AIDAKIT_PROJECT_ROOT` e um `.aidakit/` fabricado).

## 2. Surface Work — leitura de config (helper `governance/pr/pr-config.js` + wrapper `check-pr-automation.js`)

### 2a. RED — testes do reader (escrever primeiro; falham, o módulo não existe)

- [x] Config ausente / sem bloco `pr:` → `--field auto_merge` sai **exit 1** (fail-closed).
- [x] `pr.auto_merge: true` → `--field auto_merge` exit 0.
- [x] `pr.auto_merge: false` explícito → exit 1.
- [x] Config malformada (YAML inválido / `auto_merge` não-booleano) → exit ≠0 (fail-closed), **nunca** exit 0.
- [x] Resolução de raiz: rodar de um subdiretório com `.aidakit/` acima → resolve a mesma raiz (honra `AIDAKIT_PROJECT_ROOT` / sobe até `.aidakit/`); `autoMergeEnabled()` retorna igual ao rodar da raiz.
- [x] `--field` ausente/inválido → **exit 2** (uso). JSON no stdout com o mesmo contrato dos outros validadores.

### 2b. GREEN — implementar o helper e o wrapper

- [x] Escrever `governance/pr/pr-config.js` (Node/ESM, zero-dep além do binário `git`, só `node:fs`/`node:path`/`node:child_process`) exportando `resolveRoot(startDir)` (mesma semântica de `findProjectRoot()` em `check-doc-manifest.js` — correção anti-drift da task 1; **não** `persistence.js`'s `projectRoot()`, que não sobe diretórios) e `autoMergeEnabled(startDir)` (retorna `true` só se `pr.auto_merge === true` **no branch base confiável**, lido via `git show <base-ref>:aidakit.config.yaml` — round 2, nunca a working tree; qualquer ausência/erro/ambiguidade → `false`, fail-closed).
- [x] Escrever `governance/validators/check-pr-automation.js` como wrapper CLI fino sobre `pr-config.js`: `--field auto_merge` → exit 0/1 conforme `autoMergeEnabled(AIDAKIT_PROJECT_ROOT||cwd)`; exit 2 em uso inválido; JSON no stdout. Rodar 2a → verde.

### 2c. REFACTOR

- [x] Tidy (sem branches mortos); re-rodar `node governance/__tests__/pr-automation.test.mjs` → verde.

## 3. Surface Work — flows `governance/flows/full.yaml` e `fast.yaml`

### 3a. RED — roteamento das duas caudas

- [x] Em `pr-automation.test.mjs` (ou `engine.test.mjs`), carregar `full` E `fast` via `loadFlow` e dirigir pela API do engine: **caminho padrão** (sem `aidakit.config.yaml`) → `pr → merge_route (exit≠0) → merge (human_gate)`, resultado idêntico a hoje; **caminho auto_merge** (config com `pr.auto_merge: true`, raiz isolada) → `pr → merge_route (exit 0) → auto_merge`, e daí `merged → done` e `blocked → merge` (fallback). Falham até 3b.
- [x] Asserção de LOAD: `loadFlow('full')`/`loadFlow('fast')` sem erros com os passos novos (alvos `merge_route`/`auto_merge`/`merge`/`done` resolvem — [parser.js:201-221](../../../governance/engine/parser.js)).

### 3b. GREEN — reescrever a cauda (idêntico nos dois flows)

- [x] `full.yaml`: `pr.on_success: merge_route`; inserir `merge_route` (runs, `check-pr-automation.js --field auto_merge`, `on_success: auto_merge`, `on_failure: merge`) e `auto_merge` (invoke `aidakit:merge`, input `request`+`change_id`, expects `[merged,blocked,failure]`, `on_result {merged: done, blocked: merge, failure: merge}`). `merge`/`done`/`aborted` **intactos**.
- [x] `fast.yaml`: mesmo tratamento. Register mode e o resto da topologia intactos.
- [x] Descrições dos passos novos preenchidas (prosa pt-BR; ids/comando fixos). Rodar 3a → verde.

## 4. Surface Work — skill `aidakit:merge` (novo); `aidakit:ship` inalterado

- [x] Criar `skills/merge/SKILL.md` — merge autônomo OPT-IN, gated por [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md). **Segue o template de SKILL.md** (When to use / Prerequisites / Process / Outputs / Gates and guardrails), como [skills/ship/SKILL.md](../../../skills/ship/SKILL.md) — **não** a anatomia de agente da [GOVERNANCE.md](../../../GOVERNANCE.md) §7. Checa mergeabilidade (`gh pr view --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup`); merge pelo mecanismo normal do host (`gh pr merge`, **sem** `--admin`/`--no-verify`/`AIDAKIT_BYPASS` — `gh pr merge` não tem flag `--force`); outcomes `merged|blocked|failure`; qualquer dúvida/falha → fallback explícito reportando o motivo. Footer de doutrina.
- [x] **`skills/ship/SKILL.md` NÃO é editado** — ship já abre o PR e para na URL, "nunca faz merge" ([skills/ship/SKILL.md:45](../../../skills/ship/SKILL.md)); esta change não adiciona leitura de config a ship. (Confirmar no cleanup que ship não aparece no diff.)
- [x] Se o inventário de skills/agentes for indexado ([PROCESS.md §3](../../../PROCESS.md), `skills/catalog/INDEX.md`), registrar `aidakit:merge` lá.

## 5. Surface Work — hook `hooks/pre-bash.js`

### 5a. RED — carve-out do hook (shapes de flag + encadeamento)

- [x] Teste (novo `governance/__tests__/pre-bash.test.mjs` ou dentro de `pr-automation.test.mjs`, via `child_process` alimentando o hook por stdin com o JSON do evento e `cwd` isolado):
  - `gh pr merge` **bloqueado** (exit 2) sem config; **liberado** (exit 0) com `aidakit.config.yaml` `pr.auto_merge: true` na raiz resolvida a partir do `cwd`.
  - `gh pr merge` rodado de um **subdiretório** (com `.aidakit/` e a config acima) → mesma decisão que da raiz (resolução de raiz idêntica ao reader).
  - **Bloqueados mesmo com `auto_merge: true`:** `gh pr merge --admin`, `gh pr merge --admin=true`, `gh pr merge --no-verify`, e as formas encadeadas `foo && gh pr merge --admin`, `gh pr merge --admin ; bar`.
  - Config malformada → **bloqueado** (fail-closed).
  - Falham até 5b.

### 5b. GREEN — implementar a exceção gated por config (fail-closed, single-source)

- [x] Editar [hooks/pre-bash.js](../../../hooks/pre-bash.js): tornar `main()` `async`; na regra `gh pr merge`, antes de bloquear, `await import("../governance/pr/pr-config.js")` e chamar `autoMergeEnabled(event.cwd)` — **mesma resolução de raiz do reader**. Allow só com `autoMergeEnabled === true` **e** o comando sem `--admin`/`--admin=true`/`--no-verify` (inclusive encadeados por `&&`/`;`); caso contrário mantém o bloqueio. **Fail-closed:** qualquer erro no import/leitura → bloqueia (é a exceção deliberada ao default fail-open do hook — [design.md](design.md) §Carve-out do hook). **Não** é a via `AIDAKIT_BYPASS`. Rodar 5a → verde.

## 6. Documentation

- [x] `docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md` — **já autorado neste pacote de plano** (deliverable obrigatório); confirmar `node governance/validators/check-adr-format.js docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md` → exit 0.
- [x] `docs/decisions/README.md` — **já atualizado** (linha na tabela + agrupamento temático); confirmar links e a adjacência ADR-007/008 (numeração global, [DOCS.md §2](../../../DOCS.md)).
- [x] `GOVERNANCE.md` §1 regra 1 e §4 (linha `gh pr merge`) — **anexar** um ponteiro para a ADR-008 (exceção escopada a opt-in), **mantendo o texto default-deny verbatim** — nunca reescrever a regra 1 numa forma permissiva (uma supersessão escopada não pode virar global). Em §4, anexar também a nota de que o carve-out de `gh pr merge` é **fail-closed**, exceção ao default fail-open geral do §4 (finding must-fix do crítico). Ação de escalação 2 autorizada pelo dono. Bump de footer. A revisão do diff deve verificar que o texto original permaneceu verbatim e só recebeu o ponteiro.
- [x] `docs/reference/config.md` — nova linha em "Fields at a glance" + seção `pr` (só `auto_merge`: propósito, default `false`, fail-closed, consumidores reader+hook). Bump de footer.
- [x] `aidakit.config.example.yaml` — bloco `pr:` comentado com `auto_merge: false` e a nota de que ligar exige o opt-in de ADR-008.
- [x] Via `aidakit:roadmap`, registrar a feature no roadmap (novo épico de automação de entrega **ou** a linha mais próxima) — **nunca** escrever campo de status nem editar o `ROADMAP.md` derivado à mão ([ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md)). Independente de ordem com as tasks 2–5. Épico novo `EPIC-delivery-automation` (nenhum dos dois épicos existentes cobria governança de entrega/merge); registrado em `docs/roadmap/README.md`; `ROADMAP.md` regenerado via `derive-roadmap-status.js` (nunca editado à mão).
- [x] Este pacote de change completo (proposal, design, tasks, evidence).

## 7. Validation (executável)

- [x] `node governance/__tests__/pr-automation.test.mjs` → verde (reader + resolução de raiz + roteamento das duas caudas + carve-out do hook com shapes de flag/encadeamento). Contagens na [evidence.md](evidence.md).
- [x] `node governance/__tests__/engine.test.mjs` → verde (sem regressão; API do engine inalterada).
- [x] Suite completa: `for t in governance/__tests__/*.test.mjs; do node "$t" || echo "FAIL $t"; done` → tudo verde. Registrar na [evidence.md](evidence.md).
- [x] Smoke CLI vivo (raiz isolada `AIDAKIT_PROJECT_ROOT`): (a) sem config → `start full …` dirige até o `human_gate` `merge` como hoje; (b) com `aidakit.config.yaml` `pr.auto_merge: true` → `merge_route` sai exit 0 e o flow alcança `auto_merge`; simular fallback (`blocked`) e confirmar a rota para `merge`. Capturar transcrições na [evidence.md](evidence.md). (Rodado no flow `fast`, mais curto — cobertura equivalente à cauda `full`, já validada estruturalmente em `pr-automation.test.mjs`.)
- [x] `node governance/validators/check-pr-automation.js --field auto_merge` em raiz sem config → exit 1; em raiz com `pr.auto_merge: true` → exit 0. Registrar.
- [x] `node governance/validators/check-adr-format.js docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md` → exit 0.
- [x] `node governance/validators/check-links.js docs/features/configurable-pr-automation docs/decisions GOVERNANCE.md docs/reference/config.md` → exit 0.
- [x] `node governance/validators/derive-roadmap-status.js --root .` → exit 0; esta change deriva `in-progress`.

## 8. Release

- [x] Bump `version` em `.claude-plugin/plugin.json` **estritamente acima da versão em `main` no início da implementação — re-ler, não assumir** (`main` estava em `0.6.1`; a árvore de trabalho já tinha `0.7.0` de change in-flight — recomendado `0.8.0` para feature entregue). É o que faz `claude plugin update` copiar o novo comportamento ([PROCESS.md §5](../../../PROCESS.md)). `node governance/validators/check-plugin-version.js .` → exit 0; registrar na [evidence.md](evidence.md). **Nota:** durante a implementação, um commit concorrente (`24fcad2`, change `flow-run-progress-table`) avançou o HEAD do worktree compartilhado e já tinha fixado `plugin.json` em `0.7.0` — confirmado por `git show HEAD:.claude-plugin/plugin.json` antes do bump; `0.8.0` continua estritamente acima. Ver `evidence.md` → Unresolved Deviations.

## 9. Cleanup

- [x] `git status` mostra só o escopo declarado: `governance/pr/pr-config.js`, `governance/validators/check-pr-automation.js`, `governance/flows/{full,fast}.yaml`, `skills/merge/SKILL.md`, `hooks/pre-bash.js`, `governance/__tests__/pr-automation.test.mjs` (+ hook test), `docs/decisions/ADR-008-*.md` + `README.md`, `GOVERNANCE.md`, `docs/reference/config.md`, `aidakit.config.example.yaml`, os arquivos de roadmap da task 6, `.claude-plugin/plugin.json`, e este diretório de change. **`skills/ship/SKILL.md` NÃO deve aparecer no diff.** Confirmado — ver `evidence.md` → Files Touched (inclui também `skills/catalog/INDEX.md`, dentro do escopo previsto pela task 4; e, do round 3/Fix 1, `governance/engine/project-root.js` (novo) + `governance/validators/check-doc-manifest.js` (modificado) — escopo extra justificado pelo achado explícito do arquiteto de fold-ar a duplicação de root-climb num único dono).
- [x] `## Validation Outputs`, `## Files Touched` e `## Unresolved Deviations` preenchidos na [evidence.md](evidence.md).

## 10. Ship (passo separado — fora do escopo do implementador)

- [ ] Ship: commit convencional no branch do worktree, PR `feat(flow): opt-in autonomous PR merge (pr.auto_merge, ADR-008)` para `main`, **parar na URL** — o merge desta change (do próprio kit, sem `aidakit.config.yaml`) é do humano ([GOVERNANCE.md](../../../GOVERNANCE.md) §1).
