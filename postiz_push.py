"""Push finished clips to a self-hosted Postiz instance (social scheduler).

Off unless POSTIZ_AUTO_PUBLISH=1. Every failure is logged and swallowed —
a clipping job must never die because the publish leg is broken.

Env:
  POSTIZ_AUTO_PUBLISH    "1" to enable (default off)
  POSTIZ_URL             instance base, e.g. https://postiz-xyz.up.railway.app
  POSTIZ_API_KEY         Postiz -> Settings -> API Keys
  POSTIZ_TARGETS         JSON list, e.g.
                         [{"integration": "<id>", "__type": "tiktok"},
                          {"integration": "<id>", "__type": "youtube",
                           "settings": {"title": "..."}}]
                         Each entry is one posts[] slot on the created post.
  POSTIZ_POST_TYPE       draft (default) | schedule | now
  POSTIZ_SCHEDULE_MINUTES  lead time for "schedule" (default 30)

API notes (v2.12+ public API):
  POST {url}/api/public/v1/upload   multipart file -> {"id","path"}
  POST {url}/api/public/v1/posts    one call per clip; ~90 req/h limit
  Header: Authorization: <api-key>
"""

import json
import os
import time

import httpx


def enabled() -> bool:
    return os.environ.get("POSTIZ_AUTO_PUBLISH", "").strip() == "1"


def _config():
    url = os.environ.get("POSTIZ_URL", "").strip().rstrip("/")
    key = os.environ.get("POSTIZ_API_KEY", "").strip()
    targets_raw = os.environ.get("POSTIZ_TARGETS", "").strip()
    post_type = os.environ.get("POSTIZ_POST_TYPE", "draft").strip().lower()
    lead = int(os.environ.get("POSTIZ_SCHEDULE_MINUTES", "30"))
    if not url or not key or not targets_raw:
        return None
    try:
        targets = json.loads(targets_raw)
        assert isinstance(targets, list) and targets
    except (ValueError, AssertionError) as e:
        print(f"   ❌ Postiz: bad POSTIZ_TARGETS JSON ({e}) — skipping push")
        return None
    return url, key, targets, post_type, lead


def _request(method, url, key, retries=3, **kwargs):
    last = None
    for attempt in range(retries):
        try:
            resp = httpx.request(
                method, url, headers={"Authorization": key},
                timeout=kwargs.pop("timeout", 120.0), **kwargs)
            if resp.status_code == 429:
                print("   ⚠️ Postiz: rate limited (429), waiting 60s")
                time.sleep(60)
                last = resp
                continue
            if resp.status_code >= 500:
                last = resp
                time.sleep(2 ** attempt * 5)
                continue
            return resp
        except httpx.HTTPError as e:
            last = e
            time.sleep(2 ** attempt * 5)
    raise RuntimeError(f"Postiz request failed after {retries} tries: {last}")


def _upload_video(url, key, path):
    with open(path, "rb") as fh:
        resp = _request(
            "POST", f"{url}/api/public/v1/upload", key,
            files={"file": (os.path.basename(path), fh, "video/mp4")},
            timeout=600.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"upload {resp.status_code}: {resp.text[:300]}")
    body = resp.json()
    return {"id": body["id"], "path": body["path"]}


def _caption_for(clip, campaign):
    parts = [clip.get("video_title_for_youtube_short") or clip.get("title") or ""]
    tags = (campaign or {}).get("hashtags") or clip.get("hashtags") or []
    if tags:
        parts.append(" ".join(f"#{t.lstrip('#')}" for t in tags))
    return "\n\n".join(p for p in parts if p).strip()


def _post_slot(target, clip, file_ref, caption):
    settings = dict(target.get("settings") or {})
    ttype = settings.get("__type") or target.get("__type")
    if ttype == "youtube":
        title = (clip.get("video_title_for_youtube_short")
                 or clip.get("title") or "New clip").strip()[:100]
        if len(title) < 2:
            title = (title + " clip").strip()
        settings.setdefault("title", title)
        settings.setdefault("type", os.environ.get(
            "POSTIZ_YT_VISIBILITY", "public"))
        settings.setdefault("selfDeclaredMadeForKids", "no")
    elif ttype in ("instagram", "instagram-standalone"):
        settings.setdefault("post_type", "reels")
    slot = {
        "integration": {"id": target["integration"]},
        "value": [{"content": caption, "image": [file_ref]}],
    }
    if ttype and "__type" not in settings:
        settings["__type"] = ttype
    if settings:
        slot["settings"] = settings
    return slot


def push_clips(output_dir, shorts, clips_data):
    """Create one Postiz post per finished clip. Never raises."""
    if not enabled():
        return
    try:
        cfg = _config()
        if not cfg:
            print("   ℹ️ Postiz push enabled but POSTIZ_URL/POSTIZ_API_KEY/"
                  "POSTIZ_TARGETS incomplete — skipping")
            return
        url, key, targets, post_type, lead_minutes = cfg
        campaign = clips_data.get("campaign")
        pushed = 0
        for i, clip in enumerate(shorts):
            name = clip.get("delivered_file")
            path = os.path.join(output_dir, name) if name else None
            if not path or not os.path.exists(path) or os.path.getsize(path) == 0:
                print(f"   ⚠️ Postiz: clip {i+1} has no finished file — skipped")
                continue
            try:
                file_ref = _upload_video(url, key, path)
                caption = _caption_for(clip, campaign)
                payload = {
                    "type": post_type if post_type in ("draft", "now") else "schedule",
                    "date": time.strftime(
                        "%Y-%m-%dT%H:%M:%S.000Z",
                        time.gmtime(time.time() + lead_minutes * 60)),
                    "shortLink": False,
                    "tags": [],
                    "posts": [_post_slot(t, clip, file_ref, caption)
                              for t in targets],
                }
                resp = _request("POST", f"{url}/api/public/v1/posts", key,
                                json=payload)
                if resp.status_code >= 400:
                    raise RuntimeError(
                        f"posts {resp.status_code}: {resp.text[:300]}")
                posted = resp.json().get("postIds") or resp.json().get("ids")
                pushed += 1
                print(f"   📤 Postiz: clip {i+1} pushed "
                      f"({post_type}) {posted or ''}")
            except Exception as e:
                print(f"   ❌ Postiz: clip {i+1} push failed: {e}")
        if pushed:
            print(f"   ✅ Postiz: {pushed}/{len(shorts)} clip(s) pushed to "
                  f"{url} ({post_type})")
    except Exception as e:
        print(f"   ❌ Postiz push aborted: {type(e).__name__}: {e}")
