# What may and may not be claimed about ownership and uniqueness

Source SHA: `74ffed9c5fa858f7accbd2ab6594877de3f50280`
Backing evidence: [`FILE_PROVENANCE.csv`](./FILE_PROVENANCE.csv),
[`AI_PROVENANCE.csv`](./AI_PROVENANCE.csv),
[`CHAIN_OF_TITLE_REGISTER.md`](./CHAIN_OF_TITLE_REGISTER.md),
[`SIMILARITY_FINDINGS.csv`](./SIMILARITY_FINDINGS.csv)

This file exists so that marketing, investor and due-diligence wording can be
taken from a measured position instead of improvised. Each permitted claim below
names the measurement that supports it. Each forbidden claim names what would
have to be true first.

A claim that is not listed as permitted is not thereby forbidden — it is
unassessed, and should be measured before use.

---

## 1. Supported claims / Что можно утверждать

### 1.1 First-party development

**EN:** "Прозрачная Цена is our own software development. Its source code was
written by the rights holder and by tooling operating under the rights holder's
direction."

**RU:** «Прозрачная Цена — наша собственная программная разработка. Исходный код
написан правообладателем и инструментами, работавшими под его управлением.»

Supported by: of 6 881 tracked files, 6 708 are classified
`FIRST_PARTY_PROPRIETARY` on surviving-authorship evidence, 40 carry a recorded
technical origin, and 1 is a generated lockfile. No file in the tree is
classified as vendored third-party source.

### 1.2 No third-party proprietary code in the product

**EN:** "The product contains no third-party proprietary source code. Its
third-party components are openly licensed, declared, and listed in the SBOM."

**RU:** «Продукт не содержит стороннего проприетарного исходного кода. Сторонние
компоненты — открыто лицензированные, декларированные и включённые в SBOM.»

Supported by: `VENDORED_THIRD_PARTY = 0`; no dependency with an unknown or
unresolved licence; SBOM scope complete.

> Do **not** shorten this to "contains no third-party code". That is false. The
> platform depends on openly licensed packages, as essentially all software does.
> The accurate claim is about *proprietary* third-party source inside the product.

### 1.3 Controlled boundary around the crown jewels

**EN:** "The commercially critical components are identified, bounded, and each
carries a recorded origin."

**RU:** «Коммерчески критичные компоненты выделены, ограничены и имеют
зафиксированное происхождение.»

Supported by: a declared protected boundary of 637 `CROWN_JEWEL` and 65
`PROTECTED_PRODUCT_UI` files, each with a provenance record.

### 1.4 Disclosed AI involvement

**EN:** "Development used AI tooling under the rights holder's direction, and
that use is disclosed and attributed per file."

**RU:** «При разработке использовались AI-инструменты под управлением
правообладателя; их использование раскрыто и атрибутировано по файлам.»

Supported by: [`AI_ASSISTED_PROVENANCE.md`](./AI_ASSISTED_PROVENANCE.md) and
per-file surviving-line attribution in `AI_PROVENANCE.csv`.

---

## 2. Forbidden claims / Что утверждать нельзя

### 2.1 Wholly owned — NOT YET SUPPORTED

**Do not claim:** "полностью принадлежит нам", "wholly owned", "все права
принадлежат", "единственный правообладатель".

**Why:** one natural person who is not the rights holder authored material that
survives in the current tree, and no instrument transferring those rights
exists. Until the assignment in
[`PLATON_IP_ASSIGNMENT.md`](./PLATON_IP_ASSIGNMENT.md) is signed, the correct
formulation is:

**RU:** «Первично разработано нами; по одному внешнему участнику оформление прав
в процессе.»
**EN:** "First-party developed, with rights from one external contributor being
formalised."

### 2.2 Unique / novel — NOT ESTABLISHED BY THIS PROGRAMME

**Do not claim:** "уникальная разработка", "аналогов нет", "unique technology",
"проприетарный алгоритм, не имеющий аналогов".

**Why:** the similarity programme measures *textual overlap against a bounded
corpus*. That is evidence of **non-copying**, not evidence of **novelty**. The
two are different questions and only the first was asked.

What may be said instead, and is supported:

**EN:** "No undeclared code overlap was found between the protected components
and the dependency corpus examined."
**RU:** «Недекларированных совпадений кода между защищёнными компонентами и
исследованным корпусом зависимостей не обнаружено.»

That statement is bounded by, and must not be detached from, four limits:

1. It covers the corpus actually examined — the project's own resolved
   dependency tree — not all published software.
2. It is limited by the sensitivity of the method (winnowing fingerprints,
   12-gram, window 8) and by the fact that only protected files are fingerprinted.
3. It concerns literal and near-literal textual similarity. It says nothing
   about functional or architectural resemblance.
4. It says nothing about patents. No patent search was performed, and
   non-copying does not imply non-infringement.

### 2.3 Copyright in AI-authored material — UNSETTLED

**Do not claim:** that every line of the platform is protected by copyright held
by the rights holder.

**Why:** a substantial body of surviving lines has no surviving human-authored
line in the same file. For that material the risk is not that somebody else owns
it — nobody else claims it — but that **copyright may not subsist in it at all**
in some jurisdictions, because authorship is attributed to a human creator. This
cannot be fixed by any signature. See
[`AI_ASSISTED_PROVENANCE.md`](./AI_ASSISTED_PROVENANCE.md) for the measured
extent and the position taken.

Supported alternative:

**EN:** "The rights holder asserts ownership of the codebase as a whole and of
its selection, structure and arrangement, and discloses AI involvement in its
production."
**RU:** «Правообладатель заявляет права на кодовую базу в целом, включая подбор,
структуру и организацию материала, и раскрывает участие AI в её создании.»

### 2.4 Claims already forbidden by AGENTS.md

Unchanged and restated here so this file can be used standalone:
production-ready, fully live, fully integrated, платформа гарантирует оплату,
платформа сама выпускает деньги, банк подключён, ФГИС подключён, ЭДО подключён.

---

## 3. The two questions, answered directly

### «Можно ли доказуемо утверждать: "Прозрачная Цена — наша собственная проприетарная программная разработка"?»

**Yes, with one qualification, and the qualification is specific and closeable.**

Provable today, from reproducible evidence: the platform is first-party
developed; it contains no vendored third-party proprietary source; its
dependencies are openly licensed and declared; its critical components are
bounded and each carries a recorded origin; and no undeclared overlap with the
examined corpus exists.

Not provable today: that *no other person holds rights in any part of it*. One
external contributor's material survives in the tree without an assignment. That
is a single, identified, quantified gap with a prepared instrument attached — not
a general uncertainty about the codebase.

So the defensible claim is: **«собственная разработка» — yes. «Исключительно и
полностью наша» — not until one signature exists.**

### «Что конкретно можно утверждать про уникальность?»

Precisely this, and no more: **no undeclared textual overlap was found with the
dependency corpus examined, at the stated sensitivity.**

This supports "written by us, not copied". It does **not** support "unique",
"novel", "no analogues" or "patent-free". Those are different claims requiring
prior-art and patent analysis that this programme did not perform and does not
purport to replace.
