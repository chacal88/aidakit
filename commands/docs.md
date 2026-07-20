---
description: Implanta, audita, indexa ou arquiva a arquitetura padronizada de documentos do projeto (DOCS.md)
---

Invoque a skill `aidakit:docs` deste plugin e siga o protocolo dela conforme o modo pedido: **init** (implanta a estrutura canônica de DOCS.md num projeto), **audit** (verifica as 7 regras — links, placement, formato de ADR, banners de legado, índices, drift), **index** (reconstrói/sincroniza INDEX.md e decisions/README.md), **archive** (arquiva doc ou change concluída: pasta datada, banner de legado, promoção de specs WORKING→DURABLE). Mover/apagar doc sempre confirma com o humano.

Modo e alvo: $ARGUMENTS

<!-- aidakit v0.3 — comando da skill docs, 2026-07-17 -->
