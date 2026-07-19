from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import datetime

from tai.gold_set import (
    ExpectedDisposition,
    GoldDomain,
    GoldLanguage,
    GoldQuestion,
    GoldSetManifest,
)
from tai.gold_set_candidate import build_platform_agro_candidate as _build_base


def build_platform_agro_candidate(
    *,
    exact_head_sha: str,
    created_at: datetime,
    version: str = "2026.07.19.2",
) -> GoldSetManifest:
    base = _build_base(
        exact_head_sha=exact_head_sha,
        created_at=created_at,
        version=version,
    )
    prompts = {
        GoldLanguage.RU: (
            "Какой официальный источник подтверждает прослеживаемость партии зерна?"
        ),
        GoldLanguage.EN: (
            "Which official source verifies traceability for a grain lot?"
        ),
        GoldLanguage.ZH: "哪个官方来源可以验证粮食批次的可追溯性？",
    }
    questions = tuple(
        GoldQuestion(
            question_id=f"agro.traceability.{language.value}",
            variant_group="agro.traceability",
            domain=GoldDomain.AGRO,
            topic="GRAIN_TRACEABILITY",
            language=language,
            prompt=prompt,
            prompt_sha256=hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            expected_disposition=ExpectedDisposition.ANSWER,
            allowed_statuses=frozenset({"ANSWERED"}),
            required_authority_ids=("official.mcx.opendata",),
            minimum_citations=1,
            required_answer_concepts=(
                "official traceability source",
                "source version",
                "freshness",
            ),
            forbidden_answer_fragments=(
                "unverified traceability",
                "непроверенная прослеживаемость",
                "未经核实的追溯信息",
            ),
            critical=True,
            tags=frozenset(
                {"candidate", "multilingual", "agro", "grain_traceability"}
            ),
        )
        for language, prompt in prompts.items()
    )
    return replace(base, questions=(*base.questions, *questions))
