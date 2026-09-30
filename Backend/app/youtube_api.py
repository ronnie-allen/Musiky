import re

import requests

from app.utils.config import Config

_DURATION_PATTERN = re.compile(r"P(?:(?P<days>\d+)D)?T?(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?")


class YouTubeError(RuntimeError):
    """Raised when YouTube cannot be reached or returns an error."""


def parse_duration(value):
    """Convert an ISO-8601 YouTube duration (PT4M13S) into seconds."""
    if not value:
        return None
    match = _DURATION_PATTERN.fullmatch(value.strip())
    if not match:
        return None
    parts = {key: int(val) for key, val in match.groupdict().items() if val}
    return (
        parts.get("days", 0) * 86400
        + parts.get("hours", 0) * 3600
        + parts.get("minutes", 0) * 60
        + parts.get("seconds", 0)
    )


def is_configured() -> bool:
    return bool(Config.YOUTUBE_API_KEY)


def search_videos(query, max_results=None):
    if not query or not query.strip():
        raise ValueError("A search query is required")
    if not is_configured():
        raise YouTubeError("YOUTUBE_API_KEY is not configured on the server")

    limit = max_results or Config.YOUTUBE_MAX_RESULTS
    params = {
        "part": "snippet,contentDetails",
        "type": "video",
        "q": query.strip(),
        "maxResults": max(1, min(25, int(limit))),
        "videoEmbeddable": "true",
        "safeSearch": "moderate",
        "key": Config.YOUTUBE_API_KEY,
    }

    try:
        response = requests.get(Config.YOUTUBE_SEARCH_URL, params=params, timeout=Config.YOUTUBE_TIMEOUT_SECONDS)
    except requests.Timeout as exc:
        raise YouTubeError("YouTube took too long to respond") from exc
    except requests.RequestException as exc:
        raise YouTubeError(f"Could not reach YouTube: {exc}") from exc

    if response.status_code in (400, 403):
        raise YouTubeError("YouTube rejected the request. Check YOUTUBE_API_KEY and its quota.")
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise YouTubeError(f"YouTube returned HTTP {response.status_code}") from exc

    items = response.json().get("items") or []
    results = []
    for item in items:
        snippet = item.get("snippet") or {}
        video_id = ((item.get("id") or {}).get("videoId")) or ""
        if not video_id:
            continue
        thumbnails = snippet.get("thumbnails") or {}
        thumbnail = (
            (thumbnails.get("medium") or {}).get("url")
            or (thumbnails.get("default") or {}).get("url")
            or ""
        )
        results.append(
            {
                "video_id": video_id,
                "title": snippet.get("title") or "Unknown title",
                "thumbnail": thumbnail,
                "channel": snippet.get("channelTitle") or "",
                "published_at": snippet.get("publishedAt") or "",
                "duration": parse_duration((item.get("contentDetails") or {}).get("duration")),
            }
        )
    return results
