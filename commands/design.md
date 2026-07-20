---
description: Dá a coleira ao design — inicia (ou retoma) o flow design pelo engine, que força a ordem das 4 fases DDD e um gate humano entre cada
---

Interface humana para **desenhar a arquitetura de um projeto novo** — do negócio ao plano de implementação — sob o engine de flows executáveis (o engine em `governance/`, que NÃO muda de nome). Diferente da versão conversacional antiga (a skill `aidakit:design`, que se aposenta), aqui o **engine é a coleira**: ele força a ordem das 4 fases DDD e um **gate humano obrigatório** entre cada, em vez de confiar na disciplina de uma skill roteiro. Traduza o pedido do usuário para o CLI do engine e execute via Bash:

- `start design projeto="..."` → `node governance/cli.js start design projeto="..."` (inicia o flow `design` para o projeto nomeado)
- `resume <flow_id> <outcome>` → `node governance/cli.js resume <flow_id> <outcome>` (retoma um flow `design` pausado, passando o outcome do passo)
- `status <flow_id>` → `node governance/cli.js status <flow_id>`
- `abort <flow_id>` → `node governance/cli.js abort <flow_id>`
- `list` → `node governance/cli.js list` (confirma que `design` está entre os flows disponíveis)

**As 4 fases são skills que o flow despacha, na ordem, com gate humano forçado entre cada** (o flow `governance/flows/design.yaml`): fase 1 `aidakit:design-business` (Negócio) → fase 2 `aidakit:design-modeling` (Modelagem DDD) → fase 3 `aidakit:design-architecture` (Arquitetura) → fase 4 `aidakit:design-implementation` (Implementação). Cada fase conduz a entrevista, escreve seu entregável em `docs/design/` e devolve `pronto`; o flow então pausa num `human_gate` para o dono aprovar antes de liberar a próxima fase. A ordem e os gates vivem no flow — o dono não depende de a skill "lembrar" de parar; o engine para por ela.

**A coleira, na prática:** o engine força cada passo. Quando o flow pausa num passo `invoke` (uma das fases), o CLI imprime o despacho (qual skill `aidakit:*` rodar); rode-a, obtenha o outcome (`pronto`) e retome com `resume <flow_id> pronto`. Quando pausa num `human_gate` de aprovação de fase, apresente o prompt ao dono e aguarde a decisão dele antes de retomar — nunca invente um outcome; um outcome inválido re-pausa o gate. É essa inversão de controle que garante que nenhuma fase avance sem o entregável pronto e sem o "aprovo" explícito do dono.

**Retomar um design em andamento:** `node governance/cli.js resume <flow_id> <outcome>` — o engine guarda o estado do flow (fase atual, entregáveis já aprovados, ponto de parada), então o design segue exatamente de onde parou, sem refazer fase aprovada. Use `status <flow_id>` para ver em que fase o flow está.

Ao terminar as 4 fases, o handoff é para `/aidakit:build`, que constrói cada change do plano ao PR (o próprio flow de build escolhe o próximo change pronto no arranque).

Guia dos flows: `docs/guides/flows.md`. Fonte da verdade do engine: `governance/README.md`. Doutrina de autoridade e gates: `GOVERNANCE.md` na raiz do plugin.

Pedido do usuário (nome/descrição do projeto): $ARGUMENTS

<!-- aidakit v0.3 — /aidakit:design vira a COLEIRA: inicia/retoma o flow design (governance/cli.js) que força as 4 fases DDD (skills design-business/modelagem/arquitetura/implementacao) com gate humano entre cada; substitui a skill design conversacional (aposentada), 2026-07-17 -->
