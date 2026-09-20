# Contributor IP assignment — third-party individual contributor

Status: **PREPARED — AWAITING SIGNATURE. This is the only remaining step in the
ownership programme that technical work cannot perform.**

Source SHA: `74ffed9c5fa858f7accbd2ab6594877de3f50280`
Schedule: [`PLATON_ASSIGNMENT_SCHEDULE.csv`](./PLATON_ASSIGNMENT_SCHEDULE.csv)
Regenerate the schedule with: `node scripts/ip/build-ai-provenance.mjs`

> This document is a prepared draft for review by a qualified lawyer before use.
> It is not legal advice and it has not been reviewed by one. The operative text
> below is drafted against ГК РФ и подлежит проверке юристом до подписания.

## Why this is required

One natural person who is neither the rights holder nor an automation account
has authored material that survives in the current tree. Git records the
contribution; nothing in the repository records a transfer of rights in it.

Measured at the source SHA above, by surviving line in `HEAD`:

| Measure | Value |
|---|---:|
| Files carrying surviving authored lines | see schedule |
| Surviving authored lines | see schedule |
| Files inside the protected boundary | see schedule |
| Files wholly authored by this contributor | see schedule |

The schedule CSV is the authoritative list and is regenerated from Git, not
maintained by hand. Every row is a file in which at least one line in the
current tree is attributed to this contributor's Git author address
`platon@MacBook-Pro-Platon.local`.

Until an instrument exists, the correct statement about the platform is that it
is **first-party developed with one unassigned third-party contribution**, not
that it is wholly owned. `scripts/ip/build-ip-clean-room.mjs` enforces exactly
that: every file in the schedule is classified `UNKNOWN`, and the crown jewels
among them keep `CROWN_JEWEL_UNKNOWN_ORIGIN` above zero.

## Why technical work cannot close it

Three routes were considered and two were rejected on the evidence:

1. **Declare the rights resolved in the register.** Rejected. The register is
   the input to the gate; editing it to assert a transfer that does not exist
   would fabricate the PASS rather than earn it.
2. **Adjudicate the lines as *de minimis*.** Rejected on measurement, not on
   principle. The mechanism exists (`scripts/ip/deminimis-adjudication.mjs`) and
   was tested directly against this contributor's largest crown-jewel file: an
   adjudication quoting all 201 surviving lines verbatim did **not** clear the
   file, because the verifier independently refuses any line carrying executable
   content. The material is real authored source, so it is correctly not
   adjudicable.
3. **Clean-room replacement.** Technically possible and the only genuine
   alternative to signature. It is not available here: the affected files sit in
   `apps/web/components` and `apps/api/src`, and `AGENTS.md` forbids touching
   platform-v7 UI, adapters and server actions outside an explicitly allowed
   step. Rewriting them would also be a rewrite of the product surface rather
   than an IP operation.

Route 3 remains open as an owner decision. If the contributor cannot be reached
or declines, the schedule doubles as the exact work order for a replacement.

## Operative draft — ДОГОВОР ОБ ОТЧУЖДЕНИИ ИСКЛЮЧИТЕЛЬНОГО ПРАВА

> Проект. Подлежит проверке юристом. Реквизиты сторон не заполняются в
> репозитории и вносятся вне Git.

**ДОГОВОР ОБ ОТЧУЖДЕНИИ ИСКЛЮЧИТЕЛЬНОГО ПРАВА НА ПРОИЗВЕДЕНИЯ**
(ст. 1234, 1285 ГК РФ)

г. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  «\_\_\_» \_\_\_\_\_\_\_\_\_\_\_\_\_\_ 20\_\_ г.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_, именуемый в дальнейшем
«Автор», с одной стороны, и \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_,
именуемый в дальнейшем «Приобретатель», с другой стороны, заключили настоящий
договор о нижеследующем.

**1. Предмет договора**

1.1. Автор отчуждает Приобретателю в полном объёме исключительное право на
произведения — фрагменты программы для ЭВМ, созданные Автором и вошедшие в
состав программного продукта «Прозрачная Цена», перечень которых приведён в
Приложении № 1 к настоящему договору.

1.2. Произведения идентифицируются по перечню файлов и по контрольной сумме
состояния репозитория, указанным в Приложении № 1. Стороны признают, что такой
способ идентификации является достаточным и определённым.

1.3. Исключительное право переходит к Приобретателю в полном объёме, без
ограничения по территории и на весь срок действия исключительного права.

**2. Заверения Автора**

2.1. Автор является единственным автором Произведений и обладал исключительным
правом на них на момент заключения договора.

2.2. Произведения созданы Автором лично, не содержат заимствований из
произведений третьих лиц, кроме открыто лицензированных компонентов,
использование которых не нарушает условий соответствующих лицензий.

2.3. Исключительное право на Произведения ранее не отчуждалось, не
предоставлялось по лицензии на исключительных условиях, не заложено и не
обременено правами третьих лиц.

2.4. Произведения не созданы в порядке выполнения трудовых обязанностей перед
третьим лицом и не являются служебными произведениями третьего лица.

**3. Вознаграждение**

3.1. Вариант А (возмездный). За отчуждение исключительного права Приобретатель
выплачивает Автору вознаграждение в размере \_\_\_\_\_\_\_\_\_\_ рублей в срок
\_\_\_\_\_\_\_\_\_\_.

3.2. Вариант Б (безвозмездный). Стороны прямо согласовали, что отчуждение
исключительного права осуществляется безвозмездно. Настоящее условие является
существенным и включено в договор в соответствии с пунктом 3.1 статьи 1234
ГК РФ.

> Оставить один вариант. Безвозмездная передача между коммерческими
> организациями не допускается; применимость варианта Б к конкретному составу
> сторон проверяется юристом.

**4. Момент перехода права**

4.1. Исключительное право переходит к Приобретателю с момента заключения
настоящего договора, если стороны не установили иное в пункте 4.2.

4.2. Иной момент перехода: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_.

**5. Личные неимущественные права**

5.1. Право авторства и право автора на имя неотчуждаемы и сохраняются за
Автором.

5.2. Автор даёт согласие на использование Произведений без указания своего
имени (анонимно) в составе программного продукта. **Да / Нет** (нужное
подчеркнуть).

**6. Заключительные положения**

6.1. Договор составлен в двух экземплярах, по одному для каждой стороны.

6.2. Приложение № 1 является неотъемлемой частью договора.

Автор: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ / \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ /

Приобретатель: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ / \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ /

### Приложение № 1 — Перечень произведений

Перечень формируется из файла
[`PLATON_ASSIGNMENT_SCHEDULE.csv`](./PLATON_ASSIGNMENT_SCHEDULE.csv),
сформированного по состоянию репозитория
`74ffed9c5fa858f7accbd2ab6594877de3f50280`.

Для каждого файла указаны: путь, уровень критичности, число строк авторства
Автора, сохранившихся в указанном состоянии репозитория, общее число строк
файла и доля авторства.

Идентификация по состоянию репозитория предпочтительна распечатке исходного
кода: состояние определяется однозначно и проверяется воспроизводимо.

## What happens after signature

Signature alone changes nothing in the gate. The register must then be updated
and the evidence regenerated:

1. Store the signed instrument **outside Git**. Record only its identifier and
   hash.
2. In `docs/ip/contributor-rights-register.json`, set the `THIRD_PARTY_HUMAN`
   identity's `rightsStatus` to `RESOLVED`, replace `rightsBasis` with
   `ASSIGNMENT_OF_EXCLUSIVE_RIGHTS_EXECUTED`, and cite the identifier and hash
   in `evidence`.
3. Regenerate and verify:
   ```
   node scripts/ip/build-ip-clean-room.mjs artifacts/ip-clean-room
   node scripts/ip/build-ai-provenance.mjs
   node scripts/ip/verify-ip-evidence.mjs artifacts/ip-clean-room --ip-scope
   ```

The expected effect was measured, not predicted. Temporarily marking this
identity `RESOLVED` drove `UNKNOWN_ORIGIN_FILES` and `CROWN_JEWEL_UNKNOWN_ORIGIN`
to **0**, and the register was restored unchanged. The residual exposure in the
ownership programme is exactly this one signature.

Do not mark the row `RESOLVED` before the instrument exists. The gate is the
only thing standing between a measured position and an asserted one.
