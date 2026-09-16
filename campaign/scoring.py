"""Inject campaign rules into Gemini score/detail prompts."""


def apply_campaign_to_prompts(brief, base_score_prompt: str, base_detail_prompt: str) -> tuple[str, str]:
    """Return (score_prompt, detail_prompt) with campaign rules prepended.

    Designed as a no-op when ``brief`` is None or empty.
    """
    if brief is None or not getattr(brief, "dont_list", None):
        return base_score_prompt, base_detail_prompt

    rules_block = _build_rules_block(brief)

    score = f"""{rules_block}

SCORE ADDITIONAL RULES FOR THIS CAMPAIGN:
- Do NOT select clips that show any of the forbidden moments listed above.
- Prefer clips that illustrate the "what this film adds" angles tied to the Odyssey story.
- A clip that requires the audience to already know the story is fine; a clip that
  is just a pretty moment with no link to the story scores low.

""" + base_score_prompt

    detail = f"""{rules_block}

DETAIL ADDITIONAL RULES FOR THIS CAMPAIGN:
- Every selected clip must link to the Odyssey story people already know.
- Do NOT return clips that show forbidden moments even if they score well.
- Hooks must name the concrete moment in this clip, not the video's general topic.

""" + base_detail_prompt

    return score, detail


def _build_rules_block(brief) -> str:
    lines = ["CAMPAIGN RULES — follow exactly:"]
    if brief.dont_list:
        lines.append("FORBIDDEN (never select these moments):")
        for item in brief.dont_list[:10]:
            lines.append(f"  - {item}")
    if brief.forbidden_timestamps:
        lines.append("FORBIDDEN TIMESTAMPS / MOMENTS:")
        for item in brief.forbidden_timestamps:
            lines.append(f"  - {item}")
    if brief.required_phrases:
        lines.append("PREFERRED ANGLES:")
        for item in brief.required_phrases[:8]:
            lines.append(f"  - {item}")
    if brief.do_list:
        lines.append("CAMPAIGN GUIDELINES:")
        for item in brief.do_list[:6]:
            lines.append(f"  - {item}")
    return "\n".join(lines)
