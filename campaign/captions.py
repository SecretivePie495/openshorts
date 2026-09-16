"""Generate campaign-compliant captions + mandatory hashtags."""

import re

CAPTION_TEMPLATE = """{hook}
{brand_line}
{hashtags}"""


def generate_campaign_caption(
    clip: dict,
    brief,
    custom_hook: str = "",
    brand_line: str = "",
) -> str:
    """Build a caption that follows the brief's exact format.

    Returns the full caption text with required hashtags in the brief's order.
    """
    hook = custom_hook or clip.get("viral_hook_text") or clip.get("hook_text") or ""
    hook = hook.strip()

    hashtags = ""
    if brief and getattr(brief, "hashtag_order", None):
        hashtags = " ".join(brief.hashtag_order)
    elif brief and getattr(brief, "required_hashtags", None):
        hashtags = " ".join(brief.required_hashtags)

    parts = [hook]
    if brand_line:
        parts.append(brand_line.strip())
    elif brief and getattr(brief, "client", None):
        parts.append(brief.client.strip())
    if hashtags:
        parts.append(hashtags)

    return "\n".join(p for p in parts if p)


def enforce_hashtag_order(text: str, ordered_tags: list[str]) -> str:
    """Re-order any hashtags in ``text`` to match the brief's required order.

    Only touches words starting with #; leaves the rest alone.
    """
    present = [t for t in ordered_tags if t in text]
    if not present:
        return text
    # Replace the hashtag run with ordered tags.
    def _replace_hashtags(m):
        return " ".join(present)
    return re.sub(r"(?:#\w+\s*)+", _replace_hashtags, text)
