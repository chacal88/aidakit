<!-- File: docs/decisions/ADR-014-archive-aware-link-resolution.md — global sequential numbering, never recycled. Registered in the index docs/decisions/README.md. -->
<!-- An ADR is WORM: never edit a past decision. Changed your mind → a new ADR that supersedes or amends this one. -->

# ADR-014: `check-links` resolves archived change packages via the single key, instead of rewriting the documents that cite them

- **Status:** accepted
- **Date:** 2026-07-24

## Context

Two rules of [DOCS.md](../../DOCS.md) collide by construction, and the collision is structural rather than incidental.

**Rule §4 (WORKING → DURABLE)** promotes a completed change package **wholesale** from `docs/features/<change-id>/` to `docs/archive/<YYYY-MM-DD>-<change-id>/`. No stub is left behind, and deliberately so: presence under `docs/features/` **is** the roadmap status — `derive-roadmap-status.js` derives `in-progress` from the directory existing ([features/README.md:10](../features/README.md)) — so a stub would report every shipped change as permanently in flight. The one prior change that examined this, `archive-loop-var-resume`, settled it explicitly: §2 rule 6's legacy banner + anti-link-rot stub "governs *decision/reference* docs (ADRs). Change-artifact archival is DOCS.md §4: a plain promotion move — **no banner, no stub, no content edit**" ([design.md:17](../archive/2026-07-24-archive-loop-var-resume/design.md)).

**Rule §2.4** makes "all internal links resolve" a formal readiness criterion, enforced by `check-links`.

So every inbound citation written **while a change was in flight** breaks the moment that change ships. This is not hypothetical: commit `ab037b7` archived five shipped changes and broke 13 links across 8 files in one move. Eight of those 13 landed in ADR-008, ADR-010 and ADR-011 — inside `## Context`, `## Decision`, `## Consequences` and `### Review trigger`, which **rule §2.2 forbids editing** (WORM). The boundary is not a matter of taste here; `agent-validator-paths` already pinned it when ADR-004 needed a back-link, permitting only a tail metadata append precisely because "the ADR-004 body … is not edited, so WORM is preserved" ([tasks.md:93](../archive/2026-07-24-agent-validator-paths/tasks.md)).

The citations were **correct when written**. ADR-010 was accepted on 2026-07-24, when `docs/features/engine-max-visits/` genuinely existed; the tree moved afterwards, beneath a frozen document. `archive-loop-var-resume` hit the same class on a smaller scale and could only record it as debt — "WORM forbids editing archived files. Pre-existing debt, out of scope" ([proposal.md:23](../archive/2026-07-24-archive-loop-var-resume/proposal.md)) — which left `check-links` unable to return exit 0 over the repo. A rule that cannot be satisfied without breaking another rule is a defect in the enforcement, not in the documents.

`check-links` already contains the answer in miniature. Its walk skips `docs/archive/` because "an archived doc's links reflect the tree **at archive time**, not today's" ([check-links.js:15-17](../../governance/validators/check-links.js)). ADRs are the same class of frozen document; they were simply never covered by that reasoning.

## Decision

**1. The resolution moves to the reader, not to the cited document.** When a link into `docs/features/<change-id>/…` misses on disk, `check-links` makes **one fallback attempt** against `docs/archive/<YYYY-MM-DD>-<change-id>/…`, using the single key of §2 rule 7 (change-id = branch = PR title suffix = archive directory) — the same key the promotion itself is named by. The mapping is therefore mechanical and total: any package the archive contains is reachable from any citation of its working path, with no per-link registration and no edit to a frozen byte.

**2. The fallback is strict, so it absorbs rot without becoming a blanket amnesty.** Four guards, each closing a way it could hide a real defect:

- **Fallback only** — attempted strictly after the literal path misses. An in-flight change resolves literally and never consults the archive.
- **Exact date-prefix match** (`^\d{4}-\d{2}-\d{2}-<change-id>$`), not a suffix or prefix match. `2026-07-24-archive-loop-var-resume` must not satisfy a citation of `loop-var-resume`; both exist in this repo today, so a looser match would already be wrong on the current tree.
- **Ambiguity is reported, never guessed.** Two dated twins for one change-id resolve to nothing and fail.
- **The file inside the archived package must itself exist.** A citation of a document that never shipped stays broken.

A genuine typo (`docs/features/typo-change/design.md`) therefore still fails, which is the property that keeps §2.4 worth enforcing.

**3. `docs/decisions/` is NOT added to the walk skip.** Blanket-skipping ADRs the way `docs/archive/` is skipped would close these 8 findings and simultaneously stop checking every other link in every ADR — including ADR-008's many valid ones, and any typo in an ADR authored tomorrow. `docs/archive/` is frozen wholesale; `docs/decisions/` is an active directory where new documents are written and *should* be validated at authoring time. The precision is the point.

## Consequences

- **Positive:** the two rules stop contradicting each other — §4 can promote a package without §2.4 going red, and without §2.2 being bent to make it green. `check-links` returns exit 0 over the whole repo for the first time since `ab037b7`, restoring it as a usable readiness gate rather than a known-red check people learn to ignore. The fix is **general**: every future archival is absorbed automatically, for every citing document, so this class of rot does not recur once per shipped change. Citations keep their historical text, which is what a decision record should preserve.
- **Negative:**
  - **A broken link and an archived link are no longer distinguishable in the output** — both simply pass. **Accepted:** the alternative is a warning channel the validator's exit-0/1/2 contract does not have, and the four guards in Decision point 2 already keep every *unresolvable* case reported.
  - **The rendered link is still not clickable on a docs host** — the fallback lives in the validator, not in the markdown. **Accepted:** the citing documents are ADRs, read in-repo via grep and editor far more than via a rendered site, and §2 rule 4's stated rationale for relative links is exactly that they "survive grep and offline reading". Making them clickable would require editing WORM bodies, which is the thing this decision exists to avoid.
  - **The validator now reads the directory listing of `docs/archive/`** on each miss, a small cost and a new coupling to the archive's naming convention. **Mitigated:** the listing is read only on the failure path (never for a link that resolves), and the convention it couples to is §2 rule 7, which is already load-bearing for `derive-roadmap-status.js`.
  - **A change-id reused across two archived packages becomes a hard failure**, where before it was merely a broken link. **Accepted:** §2 rule 7 makes change-ids unique by construction, and failing loudly on a violated invariant is the correct behavior.

### Review trigger

Revisit if a document outside `docs/decisions/` starts relying on the fallback for links it *could* simply keep current — the fallback is a WORM concession, not a license to leave editable documents stale; a live skill or guide should be repointed, as the five non-ADR links in this change were. Also revisit if `docs/specs/` (which absorbs spec deltas at archive time, §4) develops the same inbound-citation problem: the fix there is likely the same shape, but the key is a capability name rather than a change-id, so it would be a new decision, not an extension of this one.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Repoint the 8 hrefs in place to the archive paths | Smallest diff; links stay clickable in a rendered view | Edits `## Context`/`## Decision`/`## Consequences`/`### Review trigger` bodies of three accepted ADRs — exactly the surface [DOCS.md](../../DOCS.md) §2 rule 2 freezes and that `agent-validator-paths` confirmed is off-limits; also rewrites history (the citation was true when written) and fixes nothing for the next archival | low |
| Add `<!-- check-links: ignore -->` to ADR-008/010/011 | Uses an existing, documented, self-versioning exemption; cheapest path to exit 0 | Whole-file and blunt: blinds the validator to ALL links in those ADRs, including valid ones and future typos; scales badly (one more exempted ADR per archival) until the gate is meaningless | low |
| Skip `docs/decisions/` in the walk, like `docs/archive/` | Consistent with the existing WORM skip; one line | Same blindness as above, applied to the entire active decisions directory — new ADRs would never have their links checked at authoring time, which is when checking is most valuable | low |
| Leave a stub at `docs/features/<change-id>/` on archival (DOCS.md §2 rule 6) | The doctrine's own stated anti-link-rot mechanism; keeps links clickable | Corrupts roadmap status — `derive-roadmap-status.js` reads presence under `docs/features/` as `in-progress`, so five shipped changes would report as in flight; contradicts §4 and the `archive-loop-var-resume` finding that rule 6 governs decision/reference docs, not change artifacts | medium |
| Record the 8 as roadmap debt and leave `check-links` red | Zero code change; precedent exists (`archive-loop-var-resume`) | A readiness gate that is permanently non-zero stops being a gate; the debt grows by N links on every future archival, and the underlying rule collision is never resolved | low |
| Rewrite inbound citations automatically at archive time (a codemod in the promotion step) | Links stay literally correct on disk; no validator change | Must edit WORM ADR bodies to work — the same §2 rule 2 violation, merely automated, and now applied by a tool rather than a reviewer | medium |
