"""Parse campaign briefs (docx / plain text / dict) into structured rules."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Set


@dataclass
class CampaignBrief:
    name: str
    client: str = ""
    platforms: List[str] = field(default_factory=list)
    required_hashtags: List[str] = field(default_factory=list)
    hashtag_order: List[str] = field(default_factory=list)
    do_list: List[str] = field(default_factory=list)
    dont_list: List[str] = field(default_factory=list)
    forbidden_timestamps: List[str] = field(default_factory=list)
    forbidden_topics: List[str] = field(default_factory=list)
    required_phrases: List[str] = field(default_factory=list)
    min_engagement_pct: float = 0.0
    min_geo_share_pct: float = 0.0
    geo_countries: List[str] = field(default_factory=list)
    caption_rules: List[str] = field(default_factory=list)
    audio_requirements: List[str] = field(default_factory=list)
    source_links: List[str] = field(default_factory=list)
    raw: str = ""
    sponsor_name: str = ""


_HEADER_RE = re.compile(r"^[A-Z][A-Z0-9 &/()',.-]{6,}$", re.MULTILINE)


def _clean(lines: List[str]) -> List[str]:
    out = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith(("✔", "❌", "⚠", "—", "•", ":", "✅")):
            continue
        out.append(line)
    return out


def _extract_section(text: str, header: str, tail: str | None = None) -> List[str]:
    m = re.search(rf"(?i)\b{re.escape(header)}\b", text)
    if not m:
        return []
    start = m.end()
    if tail:
        end = text.find(tail, start)
        if end == -1:
            end = len(text)
    else:
        end = len(text)
    chunk = text[start:end]
    # Stop at the next all-caps section header to avoid greedy capture.
    next_header = _HEADER_RE.search(chunk)
    if next_header:
        chunk = chunk[:next_header.start()]
    return _clean(chunk.splitlines())


def parse_brief(text: str) -> CampaignBrief:
    name = ""
    m = re.search(r"^(.*?)\s+CAMPAIGN\s+BRIEF", text, re.IGNORECASE | re.MULTILINE)
    if m:
        name = m.group(1).strip()

    client = ""
    m = re.search(r"(?i)Client\s*\n(.+)", text)
    if m:
        client = m.group(1).strip()

    hashtags = []
    m = re.search(r"(?i)Put all four in every caption.*?\n((?:•\s*#\S+\s*\n)+)", text, re.DOTALL)
    if m:
        seen: Set[str] = set()
        for t in re.findall(r"#\S+", m.group(1)):
            if t not in seen:
                seen.add(t)
                hashtags.append(t)
    else:
        seen: Set[str] = set()
        for line in text.splitlines():
            s = line.strip()
            if s.startswith("#") and s not in seen:
                seen.add(s)
                hashtags.append(s)

    platforms = []
    for line in _extract_section(text, "Post on these apps", "Tag"):
        if line.startswith("•"):
            platforms.append(line.lstrip("• ").strip())

    do_list = _extract_section(text, "YOU MUST")
    dont_list = _extract_section(text, "YOU WILL NOT GET PAID IF")
    dont_list.extend(_extract_section(text, "DO NOT DO"))
    forbidden = _extract_section(text, "Do not show")
    forbidden.extend(_extract_section(text, "Do not use any clip"))
    forbidden.extend(_extract_section(text, "Do not say"))
    forbidden.extend(_extract_section(text, "Do not focus"))
    forbidden.extend(_extract_section(text, "Keep the film's own sound"))
    forbidden_timestamps = [x for x in forbidden if re.search(r"ending|final choice|Queen|spoiler", x, re.IGNORECASE)]
    forbidden_topics = [x for x in forbidden if x not in forbidden_timestamps]

    geo = []
    m = re.search(r"At least (\d+)%.*?(US|UK|Canada|Australia)", text, re.IGNORECASE)
    if m:
        geo = re.findall(r"(US|UK|Canada|Australia)", text[m.start():m.start()+200])

    caption_rules = _extract_section(text, "YOUR CAPTION")
    audio = _extract_section(text, "Instagram Audio")

    sources = re.findall(r"https?://\S+", text)

    return CampaignBrief(
        name=name or "unnamed campaign",
        client=client,
        platforms=platforms or ["tiktok", "instagram", "youtube", "x"],
        required_hashtags=hashtags,
        hashtag_order=hashtags,
        do_list=do_list[:8],
        dont_list=dont_list[:12],
        forbidden_timestamps=forbidden_timestamps,
        forbidden_topics=forbidden_topics,
        geo_countries=geo or ["US", "UK", "Canada", "Australia"],
        caption_rules=caption_rules,
        audio_requirements=audio,
        source_links=sources,
        raw=text,
    )


def load_brief(path: str) -> CampaignBrief:
    """Load a brief from a .docx, .txt, or JSON file, or inline text."""
    if os.path.exists(path):
        with open(path, "rb") as f:
            header = f.read(8)
        f.seek(0)
        if header[:4] == b"PK\x03\x04":
            try:
                import docx  # type: ignore
            except ImportError:
                raise RuntimeError("python-docx is required to parse .docx briefs. pip install python-docx")
            doc = docx.Document(f)
            text = "\n".join(p.text for p in doc.paragraphs)
        else:
            text = f.read().decode("utf-8", errors="replace")
    else:
        text = path

    if text.strip().startswith("{"):
        data = json.loads(text)
        return CampaignBrief(**data)
    return parse_brief(text)
