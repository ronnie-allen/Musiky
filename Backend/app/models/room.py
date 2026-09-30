import secrets
import string
import time
from datetime import datetime, timedelta, timezone

from app.utils.config import Config
from app.utils.db import get_room_collection

VIDEO_FIELDS = ("video_id", "title", "thumbnail", "channel", "duration", "published_at")
PLAYBACK_FIELDS = ("state", "position", "volume", "muted", "updated_at")


class RoomExistsError(RuntimeError):
    pass


class RoomFullError(RuntimeError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_ms() -> float:
    return time.time() * 1000.0


def _iso(value):
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return value


def sanitize_room(document):
    """Turn a raw Mongo document into a JSON-serializable dict."""
    if not document:
        return None

    room = {key: value for key, value in document.items() if key != "_id"}
    for field in ("created_at", "updated_at", "expires_at"):
        if field in room:
            room[field] = _iso(room[field])
    room["participants"] = [
        {"sid": p.get("sid"), "name": p.get("name"), "joined_at": _iso(p.get("joined_at"))}
        for p in room.get("participants", [])
    ]
    room["video_queue"] = [normalize_queue_entry(item) for item in room.get("video_queue", [])]
    room["current_video"] = normalize_video(room.get("current_video"))
    room["playback"] = sanitize_playback(room.get("playback"))
    return room


def normalize_video(raw):
    if not isinstance(raw, dict):
        return None
    video_id = str(raw.get("video_id") or "").strip()
    if not video_id:
        return None
    try:
        duration = int(raw["duration"]) if raw.get("duration") is not None else None
    except (TypeError, ValueError):
        duration = None
    return {
        "video_id": video_id[:64],
        "title": str(raw.get("title") or "Unknown title")[:200],
        "thumbnail": str(raw.get("thumbnail") or "")[:512],
        "channel": str(raw.get("channel") or "")[:120],
        "duration": max(0, duration) if duration is not None else None,
        "published_at": str(raw.get("published_at") or "")[:40],
    }


def normalize_queue_entry(raw):
    """Queue items keep their video fields plus who added them and when."""
    video = normalize_video(raw)
    if not video:
        return None
    entry = dict(video)
    if isinstance(raw, dict):
        entry["added_by"] = str(raw.get("added_by") or "")[:60]
        entry["added_at"] = _iso(raw.get("added_at"))
    return entry


def sanitize_playback(raw):
    playback = dict(raw) if isinstance(raw, dict) else {}
    playback["state"] = "playing" if playback.get("state") == "playing" else "paused"
    try:
        playback["position"] = max(0.0, float(playback.get("position") or 0.0))
    except (TypeError, ValueError):
        playback["position"] = 0.0
    try:
        playback["volume"] = min(100.0, max(0.0, float(playback.get("volume", 100.0))))
    except (TypeError, ValueError):
        playback["volume"] = 100.0
    playback["muted"] = bool(playback.get("muted", False))
    try:
        playback["updated_at"] = float(playback.get("updated_at") or _now_ms())
    except (TypeError, ValueError):
        playback["updated_at"] = _now_ms()
    return {field: playback[field] for field in PLAYBACK_FIELDS}


class Room:
    @staticmethod
    def generate_code() -> str:
        alphabet = string.digits
        return "".join(secrets.choice(alphabet) for _ in range(Config.ROOM_CODE_LENGTH))

    @staticmethod
    def create_room(room_code=None, host_sid=None):
        collection = get_room_collection()
        requested_code = room_code
        for _ in range(5):
            code = requested_code or Room.generate_code()
            now = _now()
            document = {
                "room_code": code,
                "created_at": now,
                "updated_at": now,
                "expires_at": now + timedelta(seconds=Config.ROOM_TTL_SECONDS),
                "host_sid": host_sid,
                "participants": [],
                "current_video": None,
                "video_queue": [],
                "playback": sanitize_playback(None),
            }
            try:
                collection.insert_one(document)
            except Exception as exc:
                if "duplicate" in str(exc).lower():
                    if requested_code:
                        raise RoomExistsError(f"Room {code} already exists") from exc
                    continue  # generated code collided, try another one
                raise
            document["_id"] = None
            return sanitize_room(document)
        raise RuntimeError("Could not allocate a free room code")

    @staticmethod
    def find_room(room_code):
        if not room_code:
            return None
        collection = get_room_collection()
        document = collection.find_one({"room_code": str(room_code)})
        if not document:
            return None
        expires_at = document.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= _now():
                collection.delete_one({"room_code": document["room_code"]})
                return None
        return sanitize_room(document)

    @staticmethod
    def touch(room_code):
        now = _now()
        get_room_collection().update_one(
            {"room_code": room_code},
            {"$set": {"updated_at": now, "expires_at": now + timedelta(seconds=Config.ROOM_TTL_SECONDS)}},
        )

    @staticmethod
    def delete_room(room_code):
        get_room_collection().delete_one({"room_code": room_code})

    @staticmethod
    def set_host(room_code, sid):
        get_room_collection().update_one(
            {"room_code": room_code}, {"$set": {"host_sid": sid, "updated_at": _now()}}
        )

    @staticmethod
    def host_sid(room_code):
        room = Room.find_room(room_code)
        return room.get("host_sid") if room else None

    @staticmethod
    def add_participant(room_code, sid, name):
        collection = get_room_collection()
        room = Room.find_room(room_code)
        if not room:
            return None
        if len(room.get("participants", [])) >= Config.ROOM_MAX_PARTICIPANTS:
            raise RoomFullError("This room is full")
        collection.update_one(
            {"room_code": room_code},
            {"$pull": {"participants": {"sid": sid}}, "$push": {"participants": {"sid": sid, "name": name, "joined_at": _now()}}},
        )
        Room.touch(room_code)
        return Room.find_room(room_code)

    @staticmethod
    def remove_participant(room_code, sid):
        room = Room.find_room(room_code)
        if not room:
            return None, None
        removed = next((p for p in room.get("participants", []) if p.get("sid") == sid), None)
        if not removed:
            return room, None
        get_room_collection().update_one(
            {"room_code": room_code}, {"$pull": {"participants": {"sid": sid}}}
        )
        Room.touch(room_code)
        return Room.find_room(room_code), removed.get("name")

    @staticmethod
    def set_current_video(room_code, video, autoplay=False):
        playback = {
            "state": "playing" if autoplay else "paused",
            "position": 0.0,
            "volume": 100.0,
            "muted": False,
            "updated_at": _now_ms(),
        }
        get_room_collection().update_one(
            {"room_code": room_code},
            {
                "$set": {
                    "current_video": normalize_video(video),
                    "playback": playback,
                    "updated_at": _now(),
                }
            },
        )
        return playback

    @staticmethod
    def clear_current_video(room_code):
        return Room.set_current_video(room_code, None, autoplay=False)

    @staticmethod
    def update_playback(room_code, **changes):
        room = Room.find_room(room_code)
        if not room:
            return None
        playback = sanitize_playback(room.get("playback"))
        for key in ("state", "position", "volume", "muted"):
            if key in changes and changes[key] is not None:
                playback[key] = changes[key]
        playback["updated_at"] = _now_ms()
        playback = sanitize_playback(playback)
        get_room_collection().update_one(
            {"room_code": room_code}, {"$set": {"playback": playback, "updated_at": _now()}}
        )
        return playback

    @staticmethod
    def playback(room_code):
        room = Room.find_room(room_code)
        return room.get("playback") if room else None

    @staticmethod
    def queue(room_code):
        room = Room.find_room(room_code)
        return room.get("video_queue", []) if room else []

    @staticmethod
    def add_to_queue(room_code, video, added_by=None):
        normalized = normalize_video(video)
        if not normalized:
            return None, False
        room = Room.find_room(room_code)
        if not room:
            return None, False
        queue = room.get("video_queue", [])
        if any(item["video_id"] == normalized["video_id"] for item in queue):
            return queue, False
        if len(queue) >= Config.ROOM_MAX_QUEUE:
            return queue, False
        entry = dict(normalized)
        entry["added_by"] = (added_by or "someone")[:60]
        entry["added_at"] = _iso(_now())
        get_room_collection().update_one(
            {"room_code": room_code},
            {"$push": {"video_queue": entry}, "$set": {"updated_at": _now()}},
        )
        return Room.queue(room_code), True

    @staticmethod
    def remove_from_queue(room_code, video_id):
        room = Room.find_room(room_code)
        if not room:
            return None
        get_room_collection().update_one(
            {"room_code": room_code},
            {"$pull": {"video_queue": {"video_id": str(video_id)}}, "$set": {"updated_at": _now()}},
        )
        return Room.queue(room_code)

    @staticmethod
    def clear_queue(room_code):
        get_room_collection().update_one(
            {"room_code": room_code}, {"$set": {"video_queue": [], "updated_at": _now()}}
        )
        return []

    @staticmethod
    def pop_next_from_queue(room_code):
        queue = Room.queue(room_code)
        if not queue:
            return None
        nxt = queue[0]
        Room.remove_from_queue(room_code, nxt["video_id"])
        return nxt
