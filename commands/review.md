---
description: Roda o gate de revisão pré-ship — banca adversarial de agentes em paralelo, agrega vereditos, decide consenso
---

Invoque a skill `aidakit:review` deste plugin e siga o protocolo dela: validação estrutural mecânica primeiro, depois a banca adversarial (os agentes revisores em paralelo, convocados por matriz papel×flag), agregação dos vereditos com severidades, e decisão de consenso (rodadas com teto). Report, don't fix — a skill reporta, não conserta; o merge é sempre humano.

Alvo da revisão (change-id ou `--diff`): $ARGUMENTS

<!-- aidakit v0.3 — comando da skill review, 2026-07-17 -->
