# Design — configurable-pr-automation

**Change ID:** `configurable-pr-automation`
**Date:** `2026-07-24`
**Owner:** `@chacal88`
**Phase / Package:** `config + engine/flows + hook (aidakit.config, governance/, hooks/) — feature com supersessão de governança (ADR-008)`
**PRD:** `n/a`
**Tech Spec:** `n/a`

> **Precedência:** se divergir de [GOVERNANCE.md](../../../GOVERNANCE.md), [DOCS.md](../../../DOCS.md), [PROCESS.md](../../../PROCESS.md) ou de [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md), a doutrina/ADR vence e este arquivo é corrigido. Os trechos YAML/JSON abaixo são a **forma-alvo** (implementada no passo de implementação, não agora).

## Estado atual (grounded)

Cauda dos dois flows, hoje idêntica:

```
pr    (invoke aidakit:ship)     on_success: merge      on_failure: aborted
merge (human_gate [merged,discard])  on_result: {merged: done, discard: aborted}
done / aborted (terminal)
```

Fontes: [full.yaml:273-303](../../../governance/flows/full.yaml), [fast.yaml:203-234](../../../governance/flows/fast.yaml). O `pr` já **abre** o PR: `aidakit:ship` roda `/commit-push-pr` do `commit-commands` e para na URL ([skills/ship/SKILL.md:34-37](../../../skills/ship/SKILL.md)). Portanto, in-flow, o único toque humano na cauda hoje é o **merge** — e é só ele que esta change governa.

Fatos do engine que restringem o design:

1. **O engine nunca lê `aidakit.config.yaml`.** Só skills geradoras leem (campo `language`). O engine é Node puro, zero-dep. Esta change adiciona a primeira leitura de config em runtime, num helper zero-dep dedicado (`pr-config.js`), sem YAML externo.
2. **Um `human_gate` sempre pausa.** [governance/engine/steps/human-gate.js:12-46](../../../governance/engine/steps/human-gate.js): na primeira entrada pausa; com valor inválido re-pausa. **Não existe predicado que faça um `human_gate` se auto-pular por config.** Logo, tornar o merge condicional exige um gate `runs` determinístico **antes** do `human_gate`.
3. **`runs` roteia por exit code** (0→success, ≠0→failure — [steps/runs.js:56-57](../../../governance/engine/steps/runs.js)), e interpola valores como **dado de ambiente** (`$AIDAKIT_VAR_n`, [ADR-006](../../decisions/ADR-006-flow-values-as-data.md)). É a metade determinística ("comando") do split comando-vs-agente. Precedentes de gate `runs` que roteiam por leitura: `route_mode` e `check_registered` ([fast.yaml:25-45](../../../governance/flows/fast.yaml)), `dna_gate` ([full.yaml:208-216](../../../governance/flows/full.yaml)).
4. **O hook bloqueia `gh pr merge` incondicionalmente.** [hooks/pre-bash.js:47-50](../../../hooks/pre-bash.js). Sem alterar o hook, o merge autônomo é bloqueado mesmo dentro do flow — o hook intercepta qualquer bash. Portanto o carve-out do hook é parte **obrigatória** do design.
5. **O parser valida no LOAD** que todo alvo de roteamento (`on_success`/`on_failure`/`on_result`) aponta para um id existente ([parser.js:201-221](../../../governance/engine/parser.js)) e que ids são únicos. Os passos novos precisam de ids únicos e alvos resolvíveis.
6. **`${context.select.change_id}` já existe em `main`** ([full.yaml:37-39](../../../governance/flows/full.yaml), [fast.yaml:81](../../../governance/flows/fast.yaml), via `flow-request-vs-change-id`, commit `c43205f`). A ação `auto_merge` o consome direto — sem plumbing novo.

## Uma única alavanca: `pr.auto_merge`

Decisão do dono: **um único campo**, `pr.auto_merge` (bool, default `false`). O `pr.auto_open` foi descartado — como o passo `pr` já abre um PR pronto e para na URL ([skills/ship/SKILL.md:34-37](../../../skills/ship/SKILL.md)), o caso `false` de um `auto_open` não teria efeito observável, e o único toque manual real é o merge. `aidakit:ship` fica **inalterado**; esta change não adiciona leitura de config a ship.

| Flag | Ponto de disparo | Realização |
|---|---|---|
| `pr.auto_merge` | passo `merge` (hoje `human_gate`) | **gate `runs` + ação `invoke`** — é decisão de roteamento (mergear sozinho vs. portão humano). Um `human_gate` não se auto-pula (fato 2), então entra o gate `merge_route`. |

## Config schema — novo bloco `pr:`

Em `aidakit.config.yaml` (raiz do projeto-alvo). Forma-alvo:

```yaml
pr:
  auto_merge: false  # bool — faz o merge automaticamente quando o PR está mergeável; gated por ADR-008
```

- Default `false`. Bloco `pr:` ausente (ou `auto_merge: false`) = comportamento de hoje, exato.
- Documentado em [docs/reference/config.md](../../reference/config.md) (nova linha na tabela "Fields at a glance" + seção `pr`) e em [aidakit.config.example.yaml](../../../aidakit.config.example.yaml). O nome `auto_merge` segue a convenção snake_case dos consumidores; alinhar com a convenção existente do `config.md` na implementação.

## Leitura de config — single-source `governance/pr/pr-config.js` + wrapper CLI

Para o **reader** (gate `runs`) e o **hook** não divergirem na forma de achar/interpretar a config, a leitura mora num **único módulo** compartilhado.

- **`governance/pr/pr-config.js`** (novo, Node/ESM, zero-dep além do binário `git` já usado em outros pontos do kit — `node:fs`/`node:path`/`node:child_process`, mais o parser interno `yaml-min.js` já usado pelo engine):
  - `resolveRoot(startDir)` — resolve a raiz do projeto: honra `AIDAKIT_PROJECT_ROOT`; senão sobe a partir de `startDir` até achar `.aidakit/`. **Correção anti-drift (GOVERNANCE.md §8, implementação):** [governance/engine/persistence.js](../../../governance/engine/persistence.js) `projectRoot()` **não sobe diretórios** — só honra `AIDAKIT_PROJECT_ROOT` ou cai em `process.cwd()`. A semântica de "sobe até achar `.aidakit/`" citada aqui é a de `findProjectRoot()`, o helper local já existente em [governance/validators/check-doc-manifest.js:99-108](../../../governance/validators/check-doc-manifest.js) — é esse o precedente que `resolveRoot` espelha, não `persistence.js`. Sem impacto no comportamento-alvo (já era o comportamento pretendido); só a citação estava errada.
  - **`resolveBaseRef(root)`** (novo, round 2 — veto de segurança) — resolve o ref **confiável** cujo `aidakit.config.yaml` comitado governa o opt-in: honra `AIDAKIT_BASE_REF` explícito; senão o branch default do remoto (`git rev-parse --abbrev-ref origin/HEAD`, prefixo `origin/` removido); senão um `main` local; senão um `master` local. Retorna `null` (fail-closed) quando nada resolve — repo não-git, sem remoto e sem `main`/`master`, `HEAD` destacado sem nenhum dos anteriores.
  - **`autoMergeEnabled(startDir)`** — **TRUST SOURCE (round 2 — veto de segurança):** lê `pr.auto_merge` do **branch base confiável** via `git -C <root> show <base-ref>:aidakit.config.yaml` — **nunca** da working tree/branch do PR. Retorna `true` **só** se `pr.auto_merge` for booleano `true` no ref base; **fail-closed** em toda borda: repo não é git, `resolveBaseRef` retorna `null`, arquivo ausente naquele ref, bloco `pr:` ausente, valor não-`true`, ou qualquer erro de git/leitura/parse → `false`. Parse mínimo e conservador (não precisa de YAML completo para um booleano nomeado; qualquer ambiguidade → `false`).
    > **Por que ler do branch base, não da working tree (achado do crítico de segurança, round 1 de review).** A leitura original lia `<root>/aidakit.config.yaml` do disco — que, numa invocação carregada por um PR, É o próprio diff do PR. Um PR poderia então adicionar `pr.auto_merge: true` ao seu próprio diff e conceder a si mesmo o merge autônomo — contradizendo a própria ADR-008, que enquadra o opt-in como "uma decisão prévia, já mergeada, registrada". A correção: ler exclusivamente do branch base já mergeado. Semântica resultante: o PR que introduz o opt-in **não** é auto-mergeado por essa introdução (um humano mergeia esse primeiro); só os PRs **posteriores** à config já estar no base herdam a automação.
- **`governance/validators/check-pr-automation.js`** (novo) — wrapper CLI fino sobre `pr-config.js`, mesmo contrato dos outros validadores (JSON no stdout, md no stderr — [DOCS.md §6d](../../../DOCS.md)):
  - `--field auto_merge` (único campo definido) → **exit 0** se `autoMergeEnabled()` é `true`; **exit 1** caso contrário (fail-closed para o caminho manual); **exit 2** em erro de uso (`--field` ausente/inválido).
  - Startdir do reader: `AIDAKIT_PROJECT_ROOT || process.cwd()` — a mesma `resolveRoot` do helper.

> **Por que single-source (finding do crítico).** CJS consegue `await import()` de um módulo ESM, então o hook (CJS) importa `pr-config.js` (ESM) dinamicamente em vez de reimplementar a leitura. Assim reader e hook **nunca divergem** — inclusive na leitura pelo branch base (round 2): os dois chamam a mesma `autoMergeEnabled`, então nenhum dos dois pode ler a working tree enquanto o outro lê o base. Alternativa considerada — dois leitores independentes, aceitando o tradeoff porque ambos são fail-closed (drift só poderia **over-block**, nunca false-allow) — foi **rejeitada** em favor do single-source, mais simples de auditar.

## Rewiring da cauda dos flows (`full.yaml` e `fast.yaml`, idêntico nos dois)

Forma-alvo — só a cauda muda; `merge`, `done`, `aborted` ficam **intactos**:

```yaml
  - id: pr
    type: invoke
    description: commit + PR via commit-commands. Abre o PR e para na URL. Nunca faz merge.
    invoke_target: aidakit:ship
    expects: [success, failure]
    on_success: merge_route      # (era: merge)
    on_failure: aborted

  - id: merge_route              # NOVO gate runs
    type: runs
    description: |
      Roteia a cauda por config. exit 0 = pr.auto_merge ligado (tenta merge autônomo) ·
      exit≠0 = ausente/false/erro (cai no human_gate de hoje). Fail-closed para o humano.
    command: "node \"$AIDAKIT_GOVERNANCE/validators/check-pr-automation.js\" --field auto_merge"
    on_success: auto_merge
    on_failure: merge

  - id: auto_merge               # NOVO invoke (gated por ADR-008)
    type: invoke
    description: |
      aidakit:merge — merge autônomo OPT-IN (ADR-008). Confere mergeabilidade no host e
      faz o merge pelo mecanismo normal (gh pr merge, sem --admin/--no-verify/bypass). Qualquer
      dúvida/falha (não mergeável, gh não configurado, sem permissão, branch protection,
      changes-requested) → outcome blocked/failure → cai no human_gate reportando o motivo.
    invoke_target: aidakit:merge
    input:
      request: "${inputs.request}"
      change_id: "${context.select.change_id}"
    expects: [merged, blocked, failure]
    on_result:
      merged: done
      blocked: merge             # fallback explícito para o portão humano
      failure: merge

  - id: merge                    # INALTERADO — fallback universal + caminho padrão
    type: human_gate
    ...
```

Propriedades:

- **Caminho padrão (sem config) byte-idêntico ao comportamento de hoje:** `pr → merge_route (exit≠0) → merge (human_gate) → done`. Um hop determinístico a mais, invisível no resultado.
- **Caminho `auto_merge` habilitado:** `pr → merge_route (exit 0) → auto_merge → done` (sucesso) ou `→ merge` (qualquer fallback). O `human_gate` é o destino de fallback **universal** — nunca há merge silencioso.
- **`change_id` no input do `auto_merge`** usa `${context.select.change_id}`, output estruturado do `select` já presente em `main` ([full.yaml:37-39](../../../governance/flows/full.yaml), [fast.yaml:81](../../../governance/flows/fast.yaml) — [flow-request-vs-change-id](../flow-request-vs-change-id/design.md), commit `c43205f`).

## Merge autônomo — `aidakit:merge` (novo skill, gated por ADR-008)

Skill invocado só pelo passo `auto_merge` (não é comando — [ADR-005](../../decisions/ADR-005-command-namespacing.md): nenhum comando novo). **Segue o template de SKILL.md** (When to use / Prerequisites / Process / Outputs / Gates and guardrails), como [skills/ship/SKILL.md](../../../skills/ship/SKILL.md) — não a anatomia de agente da [GOVERNANCE.md](../../../GOVERNANCE.md) §7 (que rege *agents*, não *skills*).

- **Input:** `change_id`, `request` (contexto).
- **Pré-condições garantidas pela posição no flow:** bench de review + hardening + doc-gate já passaram (o `auto_merge` só é alcançável depois de `check_docs` → `pr`). O skill **não re-executa** review; assume o que o flow garante.
- **Checagem de mergeabilidade (host, read-only):** `gh pr view --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup` do PR do branch da change. Mergeável ⟺ sem check obrigatório falhando, sem `CHANGES_REQUESTED`, sem bloqueio de branch protection, `mergeable == MERGEABLE`.
- **Ação:** se mergeável → `gh pr merge` pelo mecanismo normal do host (respeita as regras do host; **sem** `--admin`, `--no-verify`, `AIDAKIT_BYPASS` — `gh pr merge` não tem flag `--force`). Outcome `merged`.
- **Fallback explícito:** não mergeável / `gh` não configurado / sem token/permissão / erro → outcome `blocked` (não-mergeável) ou `failure` (erro operacional), **sem tentar bypass**. O flow roteia para o `human_gate` reportando o motivo.
- **Passa os mesmos guardrails da [GOVERNANCE.md](../../../GOVERNANCE.md) §4** que um merge humano passaria — é a condição registrada em [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md).

**`aidakit:ship` permanece inalterado** — abre o PR e para na URL, "nunca faz merge" ([skills/ship/SKILL.md:45](../../../skills/ship/SKILL.md)). Nenhuma leitura de config nova em ship.

## Carve-out do hook — `hooks/pre-bash.js`

A regra `gh pr merge` ([pre-bash.js:47-50](../../../hooks/pre-bash.js)) ganha uma exceção **gated por config**, imposta em lockstep com [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md).

- **Exceção fail-closed, escopada ao default fail-open do §4.** O hook em geral é fail-open ("na dúvida, allow" — [GOVERNANCE.md:37](../../../GOVERNANCE.md), e o `try/catch` que sai 0 em [pre-bash.js:71](../../../hooks/pre-bash.js)). Este carve-out é a **exceção deliberada**: para `gh pr merge`, na dúvida **bloqueia** (fail-closed). A [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) e o ponteiro na `GOVERNANCE.md` §4 declaram isso explicitamente, para quem lê o §4 isolado não ser induzido a achar que o default fail-open vale aqui.
- **Leitura via single-source:** antes de bloquear, o `main()` do hook (tornado `async`) faz `await import("../governance/pr/pr-config.js")` e chama `autoMergeEnabled(event.cwd)` — **a mesma resolução de raiz e de branch base do reader** (honra `AIDAKIT_PROJECT_ROOT` / sobe até `.aidakit/`; lê do branch base confiável via `git show`, nunca da working tree — round 2). Isso evita o cenário do ADR-reviewer: `gh pr merge` rodado de um subdiretório não pode fazer o reader rotear para `auto_merge` enquanto o hook bloqueia (ou vice-versa) — os dois resolvem a raiz e o base igual.
- **Gatilho da regra (round 3 — veto de segurança, corrige um bypass verificado ao vivo).** A regra deixou de disparar só por adjacência literal `gh\s+pr\s+merge` — esse regex nunca via `X=gh; $X pr merge --admin`, `gh${IFS}pr${IFS}merge --admin`, `$(echo gh) pr merge --admin` nem `` `echo gh` pr merge --admin `` (nenhum contém o substring literal "gh pr merge"), então esses comandos nunca chegavam a ser tokenizados — passavam direto. Gatilho novo: o texto cru contém `gh` **e** `merge` como substrings, case-insensitive, em qualquer ordem — amplo o bastante para despachar todas as obfuscações acima para o tokenizador (onde as checagens de `$`/`` ` ``/chave já existentes as bloqueiam), estreito o bastante para nunca disparar em `git merge $branch` (sem `gh`), `gh pr view $PR`/`gh pr list | grep merge` (sem `merge` consecutivo a `gh pr`, ver o bullet do wrapper abaixo). Um comando que dispara o gatilho amplo mas, tokenizado de forma limpa, não contém nenhuma invocação `gh pr merge` de fato (`mergeInvocationFound: false`) atravessa sem afetação — a regra não se aplica a ele.
- **Prefixo de wrapper de comando não derrota a detecção (round 4 — corrige uma regressão introduzida pelo próprio round 3).** O round 3 checava a invocação só em `tokens[0..2]` — `command gh pr merge --admin`, `env gh pr merge --admin`, `builtin gh pr merge --admin`, `exec gh pr merge --admin`, `nice gh pr merge --admin`, `nohup gh pr merge --admin`, `command -p gh pr merge --admin` genuinely invocam `gh pr merge`, só que com `gh` fora da posição 0 — e a regra antiga por substring cru (que casava em qualquer posição) os bloqueava; a checagem posicional do round 3 os deixava passar (regressão real). Corrigido: `findGhPrMergeArgs` busca `gh`/`pr`/`merge` como três tokens **consecutivos em qualquer posição** da lista de tokens de um comando simples, não só no início — funciona para qualquer wrapper sem precisar enumerá-los. Uma menção entre aspas (`echo "run gh pr merge"`) nunca casa: o texto entre aspas colapsa num ÚNICO token (nunca três tokens separados consecutivos), então menções inocentes continuam ilesas.
- **Detecção de flag proibida via TOKENIZAÇÃO real, não substring no texto cru (round 2 — veto de segurança).** Um scan por substring no comando cru (`--admin\b|--no-verify\b`) é **defeito**: `gh pr merge --adm''in` e `gh pr merge --adm\in` nunca contêm o substring `--admin` no texto cru, mas o shell colapsa os dois para o token literal `--admin` antes de `gh` recebê-lo — o scan por substring nunca via isso. A correção: um tokenizador de shell mínimo (`splitShellCommands`) resolve aspas/escapes exatamente como um shell real (aspas simples/duplas, `\` de escape, `;`/`&`/`&&`/`|`/`||`/newline como fronteiras de comando) **antes** de qualquer comparação de flag; qualquer construção que o tokenizador não entende totalmente (`$...`, `` `...` ``, `$(...)`, subshell `(...)`, chaves `{...}`, redirecionamento `<`/`>`, aspas não fechadas) marca o parse inteiro `ambiguous` — e `ambiguous` **sempre bloqueia** (é assim que uma indireção de variável estaticamente visível, `gh pr merge $FLAG`, também é bloqueada: `$` torna o comando inteiro ambíguo antes mesmo de chegar à checagem de allowlist).
- **Ambiguidade semântica sobre os tokens já limpos (round 3 — veto de segurança; escopo corrigido no round 4).** Uma tokenização estruturalmente limpa não é suficiente: um comando pode ainda esconder/reinterpretar seu conteúdo real via **palavras reservadas do shell** (`if`/`then`/`elif`/`else`/`fi`/`for`/`while`/`until`/`do`/`done`/`case`/`esac`/`select`/`function`/`in`/`time`/`!` — `if true; then gh pr merge --admin; fi` põe `gh` em `tokens[1]` do segundo comando simples, não `tokens[0]`, então uma checagem posicional ingênua o perde) ou via um **comando líder que re-interpreta seu próprio argumento LITERAL como shell** — só `eval` (`eval 'gh pr merge --admin'` esconde a invocação inteira dentro de uma string passada como argumento) e `sh -c`/`bash -c` (mesma forma). **`source`/`.` foram REMOVIDOS deste conjunto no round 4** (correção de honestidade — achado de qualidade + tester): diferente de `eval`, `source`/`.` recebem um **nome de arquivo**, não uma string para avaliar; `source ./evil.sh` nunca carrega `gh`/`merge` no texto visível do comando (o payload mora dentro do arquivo), então o gatilho nem dispara para o ataque real — tratar `source`/`.` como "hardened" era uma alegação de completude falsa. Ver o bullet "LIMITE HONESTO" abaixo. Qualquer ocorrência de palavra reservada ou de `eval`/`sh -c`/`bash -c`, em qualquer comando simples do parse, marca a análise inteira `ambiguous` (`hasSemanticAmbiguity`) — mesmo tratamento fail-closed dos casos estruturais acima.
- **ALLOWLIST, não blocklist, sobre os tokens já resolvidos.** Depois de tokenizar (e confirmar ausência de ambiguidade estrutural/semântica), cada invocação `gh pr merge` encontrada (pode haver mais de uma, encadeada) tem seus argumentos comparados contra um allowlist de formas seguras: no máximo um alvo posicional (número de PR / branch-ish / URL-ish, nunca começando com `-`) mais flags reconhecidas (`--merge`/`--squash`/`--rebase`/`--delete-branch`/`--auto`). Qualquer token não reconhecido — `--admin`, `--admin=...`, `--no-verify`, `--body`, uma segunda posicional, um alvo começando com `-`, um token vazio/não resolvido — **rejeita** a invocação inteira. Allowlist, não blocklist: não reconhecido é inseguro por padrão, nunca "assume que está bem". (`gh pr merge` não tem flag `--force` — não faz parte deste allowlist nem dos exemplos de flag proibida.)
- **A checagem de flag proibida/ambiguidade roda ANTES do bypass e independe dele (round 2 — achado do tester).** No design original, quando o carve-out não se aplicava (config ausente OU flag proibida), a execução caía no mesmo bloco de bypass — permitindo que `AIDAKIT_BYPASS=1 gh pr merge --admin` saísse exit 0. Corrigido: a análise (`analyzeMergeCommand`) roda **primeiro**, com sua própria saída antecipada (`exit 2`) que o bypass nunca alcança. Um `gh pr merge` **plano** (sem flag proibida) continua respeitando o bypass/carve-out normalmente — só o par flag-proibida/ambiguidade+`gh pr merge` fica imune ao bypass, não a regra inteira.
- **Não é a via `AIDAKIT_BYPASS`** (override humano consciente, logado — [pre-bash.js:76-91](../../../hooks/pre-bash.js)). É permissão declarada por config e registrada por ADR-008.
- **LIMITE HONESTO — resíduo aceito pelo dono (round 3, veredito de qualidade + decisão consciente do dono; corrigido/expandido no round 4; não superestimar a garantia).** Este carve-out é um guardrail **fail-closed**: permite só uma forma literal reconhecida-segura `gh pr merge <args-seguros>` quando o opt-in do branch base está ligado, e bloqueia flag proibida **e** qualquer construção ambígua/não-reconhecida/obfuscada — hardening cobre as classes verificadas ao vivo cujo payload está **visível no texto do comando**: quoting/escape, agrupamento por chaves, palavras reservadas, `eval`/`sh -c`/`bash -c` (payload inline), indireção por variável/substituição de comando que obfusca o próprio `gh`, e prefixo de wrapper de comando (round 4). **Residual explícito, corrigido no round 4:** `source ./file`, `. ./file`, `bash ./file`, `sh < file` — as formas de arquivo/stdin (não `-c`) — **NÃO são pegas**, e uma versão anterior deste documento (round 3) implicava erroneamente que eram, junto de `eval`/`sh -c`/`bash -c`. Não são a mesma coisa: `source`/`.` recebem um **nome de arquivo**, não uma string inline para avaliar, então quando o payload real mora dentro do arquivo, o texto do comando externo nunca carrega `gh`/`merge` — o gatilho nem dispara. Essa é a MESMA natureza do resíduo de um agente que pula `gh` e chama a API do host diretamente: "o payload não está no texto que este hook consegue ver". **Não é, e não pretende ser, um sandbox.** Um hook `pre-bash` não consegue impedir de forma robusta um agente malicioso ou vítima de prompt injection de obfuscar shell além do que este parser entende, esconder o payload num arquivo/stdin, ou pular `gh` inteiramente e chamar a API do host diretamente — essa é uma propriedade preexistente compartilhada por **toda** regra deste hook, não uma fraqueza específica deste carve-out; inspecionar conteúdo de arquivo/stdin significaria bloquear toda execução de script, o que não é o papel deste hook. Os controles **primários** contra um agente hostil são (a) a disciplina do próprio skill `aidakit:merge` (só invoca `gh pr merge` puro, nunca uma flag proibida) e (b) o opt-in do branch base em si (`governance/pr/pr-config.js`); este hook é defesa em profundidade sobre esses dois, não a fronteira de segurança. Registrado como resíduo aceito em [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) §Consequences.

## Atualização de doutrina — `GOVERNANCE.md`

A [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) supersede [GOVERNANCE.md](../../../GOVERNANCE.md) §1 regra 1 escopado a opt-in. Para doutrina e ADR não divergirem ([DOCS.md §2](../../../DOCS.md) regra 5, hierarquia de verdade autodescrita):

- **§1 regra 1 e §4 (linha `gh pr merge`)** recebem um ponteiro **anexado** para a ADR-008 — o **texto default-deny original fica verbatim**; nunca reescrever a regra 1 numa forma permissiva (isso transformaria uma supersessão escopada numa global). O ponteiro diz, em uma linha, "exceto para projetos que declaram `pr.auto_merge: true` (ADR-008)".
- **§4** ganha ainda a nota de que o carve-out de `gh pr merge` é uma exceção **fail-closed** ao default fail-open geral do §4 (finding must-fix do crítico) — para o leitor do §4 isolado não ser enganado.
- Esta é a ação de **escalação 2** ([GOVERNANCE.md](../../../GOVERNANCE.md) §1) que o dono autorizou conscientemente — não é o agente decidindo sozinho.

## Fluxo de falha/fallback (resumo)

| Situação | Rota |
|---|---|
| Sem config / `auto_merge: false` | `merge_route` exit≠0 → `merge` (human_gate) → hoje |
| `auto_merge: true`, PR mergeável | `merge_route` exit 0 → `auto_merge` → `gh pr merge` → `done` |
| `auto_merge: true`, PR não mergeável | `auto_merge` outcome `blocked` → `merge` (human_gate), reporta o motivo |
| `auto_merge: true`, gh/token/permissão/erro | `auto_merge` outcome `failure` → `merge` (human_gate), reporta o motivo |
| `gh pr merge --admin`/`--no-verify` (mesmo com auto_merge) | hook bloqueia sempre (§4 não superseeded) |
| Config malformada | helper/reader/hook fail-closed → caminho manual |

## Alternativas consideradas

| Opção | Por que rejeitada |
|---|---|
| **Manter `pr.auto_open` como 2º campo** | Descartado pelo dono: o `pr` já abre um PR pronto hoje, então o caso `false` de `auto_open` não teria efeito observável e o único toque manual é o merge. Um só campo (`auto_merge`) elimina a redundância. |
| **Zero passos novos** (só "o roteamento vira condicional") | Não é realizável no engine: um `human_gate` sempre pausa (fato 2). O mínimo fiel é 1 gate `runs` + 1 `invoke`, preservando o `human_gate` como fallback e o caminho padrão idêntico. |
| **Reusar `aidakit:ship` com `mode: "merge"`** (como `mode: "dna"`) | Muda a identidade central de ship ("nunca faz merge", repetida em SKILL.md e na doutrina). Um skill dedicado `aidakit:merge` mantém single-responsibility e deixa a exceção ADR-008 num lugar só. |
| **Ler config dentro do `aidakit:ship` e emitir 3º outcome** para rotear o `pr` | A leitura de config é determinística → deve ser gate `runs` (metade comando), não outcome de skill ([DOCS.md §6e](../../../DOCS.md)). |
| **Dois leitores independentes (hook + validador) sem single-source** | Aceitável (ambos fail-closed → drift só over-block), mas single-source via `await import()` é mais simples de auditar; escolhido. |
| **Toggle global do kit** (env/flag) em vez de config por projeto | Contraria o modelo por projeto do `aidakit.config.yaml`; afetaria o repo do kit e todos os consumidores de uma vez. |
| **Merge via API sem passar pelo hook** | Introduz dependência HTTP e credencial no engine, fura o guardrail por baixo em vez de registrar a exceção; o mecanismo normal do host (`gh`) mantém as regras do host. |

## Rollback

Reversível e de baixo risco por ser opt-in:

- Remover o bloco `pr:` de um projeto (ou pôr `auto_merge: false`) restaura o comportamento manual, sem tocar o kit.
- Reverter a change: `git revert` do PR restaura a cauda `pr → merge`, o hook original e a `GOVERNANCE.md`; a [ADR-008](../../decisions/ADR-008-opt-in-autonomous-pr-merge.md) fica no corpo como **superseded/deprecated** (WORM — não se apaga um ADR; [DOCS.md §2](../../../DOCS.md) regra 2), com um novo ADR registrando a reversão se preciso.
- Nenhum estado de flow em disco fica inválido: caudas antigas sem `merge_route` continuam carregáveis; caudas novas em projetos sem config caem no `human_gate`.

## Convenções congeladas

- **Evidência:** [docs/features/configurable-pr-automation/evidence.md](evidence.md) — comandos, saídas, arquivos e desvios são registrados lá na implementação.
- **Nomes:** helper `governance/pr/pr-config.js`; validador `check-pr-automation.js` (família `check-*`); skill `aidakit:merge`; passos `merge_route` (runs) e `auto_merge` (invoke); campo único `pr.auto_merge`.
- **Dependência satisfeita:** o `input.change_id` do `auto_merge` usa `${context.select.change_id}`, já em `main` ([flow-request-vs-change-id](../flow-request-vs-change-id/design.md), commit `c43205f`).
