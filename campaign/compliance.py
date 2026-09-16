"""Pre-export compliance checks for campaign clips."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ComplianceResult:
    passed: bool
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.passed and not self.errors


def check_clip_compliance(
    clip: dict,
    brief,
    caption: str = "",
    clip_index: int = 0,
) -> ComplianceResult:
    """Run compliance checks against a single clip + caption.

    Checks:
    - Hashtag presence + order
    - No forbidden timestamp references in caption/hook
    - No forbidden topics in hook
    - Engagement rate floor (passed in, not computed here)
    - Language/geo are caller-supplied post-publish metrics; this only checks
      what we can know before export.
    """
    warnings: list[str] = []
    errors: list[str] = []
    hook = (clip.get("viral_hook_text") or clip.get("hook_text") or "").lower()
    title = (clip.get("video_title_for_youtube_short") or "").lower()
    caption_l = caption.lower()

    if brief is None:
        return ComplianceResult(passed=True, warnings=warnings, errors=errors)

    # Exclude the brief's own names from forbidden-topic matching — the film
    # title / client name will naturally appear in hooks and captions.
    stop_words = set()
    client = (getattr(brief, "client", "") or "").lower()
    if client:
        stop_words.update(client.lower().split())
    for h in getattr(brief, "hashtag_order", []) or []:
        stop_words.add(h.lower().lstrip("#"))
    name = (getattr(brief, "name", "") or "").lower()
    if name:
        stop_words.update(name.lower().split())

    def _meaningful(text: str) -> str:
        words = re.findall(r"[a-z0-9']+", text)
        return " ".join(w for w in words if w not in stop_words and len(w) > 2)

    hook_core = _meaningful(hook)
    title_core = _meaningful(title)
    caption_core = _meaningful(caption_l)

    # Hashtag order + presence.
    required = getattr(brief, "hashtag_order", []) or getattr(brief, "required_hashtags", [])
    if required:
        missing = [t for t in required if t not in caption_l]
        if missing:
            errors.append(f"Missing required hashtags: {', '.join(missing)}")
        else:
            positions = [caption_l.find(t.lower()) for t in required]
            if any(p < 0 for p in positions):
                errors.append("Hashtag order check failed")
            elif positions != sorted(positions):
                errors.append("Hashtags out of order. Expected: " + " ".join(required))

    # Forbidden timestamps / spoilers: match on meaningful content to avoid
    # false positives from the brief's own wording.
    for forbidden in getattr(brief, "forbidden_timestamps", []):
        core = _meaningful(forbidden.lower())
        if not core:
            continue
        if re.search(re.escape(core), hook_core) or re.search(re.escape(core), caption_core) or re.search(re.escape(core), title_core):
            errors.append(f"Clip references forbidden moment: {forbidden}")

    # Forbidden topics / claims.
    for topic in getattr(brief, "forbidden_topics", []):
        core = _meaningful(topic.lower())
        if not core:
            continue
        if re.search(re.escape(core), hook_core) or re.search(re.escape(core), caption_core):
            warnings.append(f"Clip may violate rule: {topic}")

    min_eng = getattr(brief, "min_engagement_pct", 0.0)
    if min_eng > 0:
        warnings.append(
            f"Campaign requires ≥ {min_eng:.2%} engagement — verify after posting"
        )

    return ComplianceResult(passed=not errors, warnings=warnings, errors=errors)
