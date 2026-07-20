---
description: Explica, audita ou faz onboarding da governança de execução do projeto (GOVERNANCE.md + hook)
---

Invoque a skill `aidakit:governance` deste plugin e siga o protocolo dela conforme o modo: **explicar** (responde dúvidas citando a seção exata de GOVERNANCE.md — inclusive por que um comando foi bloqueado pelo hook `pre-bash` e como usar `AIDAKIT_BYPASS=1` com pedido explícito do humano), **auditar** (revisa conformidade: log de bypasses, vereditos single-writer, ausência de commit direto na main por agente, scripts versionados), **onboarding** (prepara um repo: as 3 escalações, proteção de branch, ADR de adoção). A skill nunca desativa regra nem concede exceção — exceção é decisão humana registrada.

Modo e contexto: $ARGUMENTS

<!-- aidakit v0.3 — comando da skill governance, 2026-07-17 -->
