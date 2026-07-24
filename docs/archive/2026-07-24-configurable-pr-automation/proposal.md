# Proposal — configurable-pr-automation

**Change ID:** `configurable-pr-automation`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `config + engine/flows + hook (aidakit.config, governance/, hooks/) — feature com supersessão de governança (ADR-008)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

## Why

Hoje a cauda dos dois flows termina sempre da mesma forma: o passo `pr` invoca `aidakit:ship` (que **já abre** o PR pronto-para-review e para na URL) e o passo `merge` é um `human_gate` — o humano faz o merge no host e confirma ([governance/flows/full.yaml:273-293](../../../governance/flows/full.yaml), [governance/flows/fast.yaml:203-224](../../../governance/flows/fast.yaml)). Isso está correto por padrão: [GOVERNANCE.md](../../../GOVERNANCE.md) §1 regra 1 diz que o merge de um PR nunca é do agente — o humano é o portão final.

Como o `pr` já abre o PR, **o único toque manual que sobra na cauda é o merge**. Há projetos onde o dono confia no pipeline do kit (bench de review + hardening + doc-gate garantidos pela posição no flow) e quer que a cauda faça esse merge sozinha, em vez de o humano fazê-lo à mão a cada change. Não existe hoje forma de um projeto declarar essa preferência: a cauda é hardcoded para o humano nos dois flows, e o hook `hooks/pre-bash.js:48` bloqueia `gh pr merge` incondicionalmente.

Esta change adiciona uma configuração **por projeto** — um único campo, `pr.auto_merge` em `aidakit.config.yaml` — que deixa o projeto escolher se a cauda faz o merge automaticamente, com **opt-in explícito**. O padrão (`pr.auto_merge: false` ou bloco `pr:` ausente) reproduz exatamente o comportamento de hoje.

## What Changes

- **Config — novo bloco `pr:`** em `aidakit.config.yaml` (consumido em runtime): um único campo booleano, `pr.auto_merge` (default `false`). Documentado em [docs/reference/config.md](../../reference/config.md) e [aidakit.config.example.yaml](../../../aidakit.config.example.yaml).
- **Leitor determinístico** — novo validador `governance/validators/check-pr-automation.js` (Node puro, zero-dep) sobre um helper compartilhado `governance/pr/pr-config.js` (também Node/ESM zero-dep) que resolve a raiz do projeto e lê `pr.auto_merge`: `--field auto_merge` → exit 0 se resolve `true`, exit ≠0 caso contrário (ausente/false/erro — **fail-closed** para o caminho manual). É a "metade comando" do split comando-vs-agente ([DOCS.md §6e](../../../DOCS.md)).
- **Flows** (`governance/flows/full.yaml`, `fast.yaml`) — a cauda `pr → merge` ganha roteamento condicional **sem mudar o restante da topologia**: o `pr` passa a apontar para um novo gate `runs` `merge_route`, que roteia para o merge automático (`auto_merge`, novo `invoke`) quando `pr.auto_merge` está ligado, ou para o `merge` (`human_gate` de hoje, **intacto**) caso contrário. Qualquer dúvida/falha no merge automático cai explicitamente no mesmo `human_gate`.
- **Skill de merge autônomo** — novo `aidakit:merge` (opt-in, gated por [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md)): confere a mergeabilidade no host e faz o merge pelo mecanismo normal do host (`gh pr merge`, sem `--admin`/`--no-verify`/bypass — `gh pr merge` não tem flag `--force`); em qualquer dúvida/falha, reporta e devolve ao `human_gate`.
- **`aidakit:ship` — inalterado.** Ship já abre o PR pronto-para-review e para na URL; segue "nunca faz merge" ([skills/ship/SKILL.md:45](../../../skills/ship/SKILL.md)). Esta change **não** adiciona nenhuma leitura de config a ship.
- **Hook** (`hooks/pre-bash.js`) — a regra que bloqueia `gh pr merge` ganha uma exceção **gated por config**: liberada apenas quando `aidakit.config.yaml` declara `pr.auto_merge: true` (e nunca para `gh pr merge --admin`/`--admin=true`/`--no-verify`, mesmo encadeados por `&&`/`;`). Não é a via `AIDAKIT_BYPASS` — é uma permissão declarada e registrada por ADR-008. O carve-out é **fail-closed** (exceção escopada ao default fail-open geral do §4 — ver [design.md](design.md) §Carve-out do hook).
- **Doutrina** — [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) (nova, esta change) nomeia o conflito com [GOVERNANCE.md](../../../GOVERNANCE.md) §1 regra 1 e o supersede **escopado a projetos opt-in**; `GOVERNANCE.md` §1 regra 1 e §4 (linha `gh pr merge`) ganham um ponteiro **anexado** para a ADR-008, **mantendo o texto default-deny verbatim** ([DOCS.md §2](../../../DOCS.md) regra 5).
- **Release** — bump de `.claude-plugin/plugin.json` acima da versão em `main` no início da implementação ([PROCESS.md §5](../../../PROCESS.md)).

## Non-goals

1. **Não muda a topologia dos flows além da cauda `pr → merge`.** Nenhum passo novo antes do `pr`; o resto do grafo de `full.yaml`/`fast.yaml` fica intacto. Os únicos passos novos são o gate `merge_route` e a ação `auto_merge`, ambos na cauda.
2. **Não cria um toggle global do kit.** A automação é sempre por projeto, via `aidakit.config.yaml`. O repositório do kit em si (sem `aidakit.config.yaml`, só o `.example`) continua no `human_gate`.
3. **Não usa nem introduz bypass de guardrail.** Sem `AIDAKIT_BYPASS`, sem `--no-verify`, sem `gh pr merge --admin` (`gh pr merge` não tem flag `--force`). O merge autônomo passa pelos mesmos guardrails da [GOVERNANCE.md](../../../GOVERNANCE.md) §4 que um merge humano passaria.
4. **Não faz merge silencioso em caso de falha.** Toda falha de automação (gh não configurado, sem token/permissão, branch protection bloqueia, PR não mergeável, changes-requested) cai explicitamente no `human_gate`, reportando o motivo — nunca silêncio, nunca bypass.
5. **Não toca o `aidakit:ship` nem o passo `pr` de abrir o PR.** A abertura do PR já é o comportamento de hoje; esta change só governa o **merge**.

## Affected capabilities

Cauda de entrega dos flows (`governance/flows/full.yaml`, `fast.yaml`), leitura de config em runtime (`governance/validators/check-pr-automation.js` + `governance/pr/pr-config.js`, novos; `aidakit.config.yaml` schema), skill de merge autônomo (`aidakit:merge`, novo), e o hook de execução (`hooks/pre-bash.js`). **Não existe `docs/specs/` neste repo** (confirmado em [flow-request-vs-change-id/proposal.md](../flow-request-vs-change-id/proposal.md) §Affected capabilities) — não há delta de spec de capacidade. A supersessão de governança é registrada como [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md).

## Impact per surface

| Surface | Impacto |
|---|---|
| `aidakit.config.yaml` (schema) | novo bloco `pr:` com o campo único `auto_merge` (bool, default false) |
| `governance/pr/` | `pr-config.js` (novo — peer domain package, round 3: movido de `governance/engine/` a pedido do arquiteto) — helper zero-dep que resolve a raiz/branch base e lê `pr.auto_merge`, fail-closed; single-source para o reader e o hook |
| `governance/engine/` | `project-root.js` (novo, round 3) — helper compartilhado de subida até `.aidakit/`, único dono; usado por `governance/pr/pr-config.js` e `governance/validators/check-doc-manifest.js` |
| `governance/validators/` | `check-pr-automation.js` (novo) — wrapper CLI sobre `pr-config.js` (`--field auto_merge`) |
| `governance/flows/` | `full.yaml`, `fast.yaml`: cauda `pr → merge` vira `pr → merge_route → (auto_merge → done \| merge)`; `merge`/`done`/`aborted` intactos |
| `skills/` | `merge/SKILL.md` (novo — merge autônomo opt-in, ADR-008, template de SKILL.md). `ship/SKILL.md` **inalterado** |
| `hooks/` | `pre-bash.js`: exceção gated por config (fail-closed) na regra `gh pr merge`; `--admin`/`--no-verify` seguem bloqueados; mesma resolução de raiz do reader |
| `docs/decisions/` | `ADR-008-opt-in-autonomous-pr-merge.md` (novo) + `README.md` (índice) |
| doutrina | `GOVERNANCE.md` §1 regra 1 e §4 — ponteiro anexado para ADR-008, texto default-deny verbatim |
| `docs/reference/`, `.example` | `config.md` + `aidakit.config.example.yaml`: documentam o campo `pr.auto_merge` |
| `governance/__tests__/` | `pr-automation.test.mjs` (novo); cobertura do reader, do roteamento das duas caudas e do carve-out do hook (incl. `--admin`/`--no-verify`/encadeamento) |
| `.claude-plugin/` | `version` bump (PROCESS.md §5) |

## Dependencies

- **`flow-request-vs-change-id` — dependência SATISFEITA em `main`** (mergeada, commit `c43205f` "fix(engine): key flow task paths to the reported change-id"). O `select` já declara `outputs: {success: [change_id]}` no disco hoje ([governance/flows/full.yaml:37-39](../../../governance/flows/full.yaml), [fast.yaml:81](../../../governance/flows/fast.yaml)), então a ação `auto_merge` pode receber `change_id: "${context.select.change_id}"` sem plumbing novo. A edição desta change na cauda rebaseia limpo sobre o que já está em `main`.
- Nenhuma dependência de runtime nova (o helper usa só Node/`node:fs`, sem YAML externo). O merge autônomo depende de `gh` configurado no ambiente do projeto opt-in — a ausência dele é tratada como fallback explícito, não como falha do kit.

## Exit criteria

- `node governance/__tests__/pr-automation.test.mjs` → verde: reader retorna exit 0 só quando `pr.auto_merge` resolve `true`, exit ≠0 para config ausente/false/malformada (fail-closed).
- `node governance/__tests__/engine.test.mjs` → verde, incluindo: caminho padrão (sem config) dirige `pr → merge_route (exit≠0) → merge (human_gate)` idêntico a hoje nos dois flows; caminho `auto_merge` habilitado dirige `pr → merge_route (exit 0) → auto_merge → done` no sucesso e `auto_merge → merge` no fallback.
- Cobertura do hook: `gh pr merge` bloqueado por padrão; liberado com `pr.auto_merge: true`; `gh pr merge --admin` / `--admin=true` / `--no-verify` bloqueados mesmo assim, inclusive encadeados por `&&`/`;`; config malformada → bloqueado (fail-closed).
- Suite completa `governance/__tests__/*.test.mjs` → verde (sem regressão).
- `node governance/validators/check-adr-format.js docs/decisions/ADR-008-opt-in-autonomous-pr-merge.md` → exit 0.
- `node governance/validators/check-links.js docs/features/configurable-pr-automation docs/decisions` → exit 0.
- `node governance/validators/derive-roadmap-status.js --root .` → exit 0; esta change deriva `in-progress` (o diretório existe).
- `node governance/validators/check-plugin-version.js .` → exit 0 com o manifesto bumpado.

## Unblocks

Projetos que confiam no pipeline do kit passam a poder eliminar o toque manual do merge por opt-in, sem perder nenhum guardrail. Flows autorais de consumidor herdam o mesmo gate `merge_route` como padrão de roteamento condicional por config.

## Recorded decisions and inherited open decisions

- [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) (nova, esta change) — supersede [GOVERNANCE.md](../../../GOVERNANCE.md) §1 regra 1 escopado a projetos opt-in; registra as condições/guardrails do merge autônomo e declara o carve-out do hook como exceção **fail-closed** escopada ao default fail-open do §4. **Deliverable obrigatório desta change** (decisão consciente do dono; escalação 2 da [GOVERNANCE.md](../../../GOVERNANCE.md) §1 resolvida pelo dono).
- [ADR-006](../../decisions/ADR-006-flow-values-as-data.md) — valores de flow são dado: o gate `runs` `merge_route` interpola apenas campos fixos; a ação `auto_merge` recebe `change_id` como output estruturado do `select` (já em `main`). Sem contradição.
- [ADR-005](../../decisions/ADR-005-command-namespacing.md) — critério mecânico comando-vs-orquestrador: `aidakit:merge` é um **skill** invocado pelo flow, não um comando; nenhum comando novo é criado. Sem contradição.
- [ADR-002](../../decisions/ADR-002-roadmap-status-derived-from-disk.md) — status de roadmap derivado do disco: o registro no roadmap é via `aidakit:roadmap`, nunca editando `ROADMAP.md` à mão.

## Coordenação (soft) com changes in-flight

- `flow-request-vs-change-id` — **já em `main`** (commit `c43205f`); edita a mesma cauda de `full.yaml`/`fast.yaml`. A dependência do `${context.select.change_id}` está satisfeita (ver Dependencies); a edição desta change apenas re-encaminha `pr.on_success` e insere `merge_route`/`auto_merge`.
- `flow-run-progress-table` — toca `governance/cli.js` e renderiza `flow.steps`: os passos novos (`merge_route`, `auto_merge`) aparecem automaticamente na tabela de progresso, sem conflito.
- `roadmap-status-from-shared-git` (in-flight, branch `claude/roadmap-status-from-git`, commit `af88b62`) — **já reserva `ADR-007`**; por isso o superseder desta change é `ADR-008` (numeração global, nunca reciclada — [DOCS.md §2](../../../DOCS.md)). Não toca a cauda dos flows; sem conflito de código.
