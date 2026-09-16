"""Campaign clipping support: brief parsing, rule injection, compliance."""

from .brief import CampaignBrief, parse_brief, load_brief
from .scoring import apply_campaign_to_prompts
from .captions import generate_campaign_caption, CAPTION_TEMPLATE
from .compliance import check_clip_compliance, ComplianceResult

__all__ = [
    "CampaignBrief",
    "parse_brief",
    "load_brief",
    "apply_campaign_to_prompts",
    "generate_campaign_caption",
    "CAPTION_TEMPLATE",
    "check_clip_compliance",
    "ComplianceResult",
]
