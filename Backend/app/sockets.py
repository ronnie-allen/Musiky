import time

from flask import request
from flask_socketio import join_room, leave_room

from app import socketio
from app.events import (
    broadcast_now_playing,
    broadcast_participants,
    broadcast_playback,
    broadcast_queue,
    emit_error,
    emit_room_state,
    system_message,
)
from app.models.room import Room, RoomFullError, normalize_video
from app.utils.config import Config

_sid_rooms = {}
_last_chat_at = {}
CHAT_THROTTLE_SECONDS = 0.3


def _sanitize_name(raw):
    name = " ".join(str(raw or "").split())[:40]
    return name or "Guest"


def _require_room():
    room_code = _sid_rooms.get(request.sid)
    if not room_code:
        emit_error(request.sid, "Join a room before sending events.")
        return None
    if Room.find_room(room_code) is None:
        emit_error(request.sid, f"Room {room_code} no longer exists.")
        return None
    return room_code


def _require_host(room_code):
    room = Room.find_room(room_code)
    if not room:
        return False
    if room.get("host_sid") == request.sid:
        return True
    emit_error(request.sid, "Only the host can change what is playing.")
    return False


def _ensure_host(room):
    """Claim host for the first participant, or re-elect if the host is gone."""
    host_sid = room.get("host_sid")
    participants = room.get("participants", [])
    if host_sid and any(p["sid"] == host_sid for p in participants):
        return host_sid
    if not participants:
        return None
    new_host = participants[0]
    Room.set_host(room["room_code"], new_host["sid"])
    return new_host["sid"]


@socketio.on("join")
def handle_join(data):
    data = data or {}
    room_code = str(data.get("room") or "").strip()
    name = _sanitize_name(data.get("name"))

    room = Room.find_room(room_code)
    if room is None:
        emit_error(request.sid, f"Room {room_code} does not exist or has expired.")
        return

    try:
        room = Room.add_participant(room_code, request.sid, name)
    except RoomFullError as exc:
        emit_error(request.sid, str(exc))
        return
    if room is None:
        emit_error(request.sid, f"Room {room_code} does not exist or has expired.")
        return

    join_room(room_code)
    previous_room = _sid_rooms.get(request.sid)
    _sid_rooms[request.sid] = room_code
    if previous_room and previous_room != room_code:
        leave_room(previous_room)

    if _ensure_host(room) == request.sid:
        system_message(room_code, f"{name} started this room.")

    emit_room_state(room_code, request.sid)
    socketio.emit("participant_joined", {"sid": request.sid, "name": name}, to=room_code)
    broadcast_participants(room_code)
    system_message(room_code, f"{name} joined the room")


@socketio.on("leave")
def handle_leave(data=None):
    _drop_from_room(request.sid)


@socketio.on("disconnect")
def handle_disconnect():
    _drop_from_room(request.sid)


def _drop_from_room(sid):
    room_code = _sid_rooms.pop(sid, None)
    _last_chat_at.pop(sid, None)
    if not room_code:
        return
    leave_room(room_code)
    room, name = Room.remove_participant(room_code, sid)
    if room is None:
        return
    if room.get("host_sid") == sid:
        new_host = _ensure_host(room)
        if new_host:
            host_room = Room.find_room(room_code)
            host_name = next(
                (p["name"] for p in (host_room or {}).get("participants", []) if p["sid"] == new_host),
                None,
            )
            if host_name:
                system_message(room_code, f"{host_name} is now the host.")
    socketio.emit("participant_left", {"sid": sid, "name": name}, to=room_code)
    broadcast_participants(room_code)
    if name:
        system_message(room_code, f"{name} left the room")


@socketio.on("playback")
def handle_playback(data):
    room_code = _require_room()
    if not room_code:
        return
    data = data or {}
    action = data.get("action")

    if action not in ("play", "pause", "seek", "volume", "mute"):
        emit_error(request.sid, f"Unknown playback action '{action}'.")
        return

    changes = {}
    if action in ("play", "pause"):
        changes["state"] = "playing" if action == "play" else "paused"
        try:
            changes["position"] = float(data.get("position") or 0.0)
        except (TypeError, ValueError):
            emit_error(request.sid, "position must be a number.")
            return
    if action == "seek":
        try:
            changes["position"] = float(data.get("position") or 0.0)
        except (TypeError, ValueError):
            emit_error(request.sid, "position must be a number.")
            return
    if action == "volume":
        try:
            changes["volume"] = float(data.get("volume", 100.0))
        except (TypeError, ValueError):
            emit_error(request.sid, "volume must be a number.")
            return
    if action == "mute":
        changes["muted"] = bool(data.get("muted", False))

    playback = Room.update_playback(room_code, **changes)
    broadcast_playback(room_code, playback, skip_sid=request.sid)


@socketio.on("play_video")
def handle_play_video(data):
    room_code = _require_room()
    if not room_code or not _require_host(room_code):
        return
    data = data or {}
    video = normalize_video(data.get("video") or data)
    if not video:
        emit_error(request.sid, "A video with a video_id is required.")
        return
    autoplay = bool(data.get("autoplay", True))
    playback = Room.set_current_video(room_code, video, autoplay=autoplay)
    broadcast_now_playing(room_code, video, source=_sanitize_name(data.get("name")))
    broadcast_playback(room_code, playback)
    # playing a queued track takes it out of the queue so it is not replayed later
    remaining = Room.remove_from_queue(room_code, video["video_id"])
    if remaining is not None:
        broadcast_queue(room_code)


@socketio.on("advance")
def handle_advance(data=None):
    room_code = _require_room()
    if not room_code or not _require_host(room_code):
        return
    autoplay = bool((data or {}).get("autoplay", True))
    nxt = Room.pop_next_from_queue(room_code)
    playback = Room.set_current_video(room_code, nxt, autoplay=autoplay)
    broadcast_now_playing(room_code, nxt, source="queue")
    broadcast_playback(room_code, playback)
    broadcast_queue(room_code)


@socketio.on("queue_add")
def handle_queue_add(data):
    room_code = _require_room()
    if not room_code:
        return
    data = data or {}
    name = _sanitize_name(data.get("name"))
    video = normalize_video(data.get("video") or data)
    if not video:
        emit_error(request.sid, "A video with a video_id is required.")
        return
    queue, added = Room.add_to_queue(room_code, video, added_by=name)
    if not added:
        emit_error(request.sid, "That video is already queued or the queue is full.")
        return
    broadcast_queue(room_code)
    system_message(room_code, f"{name} queued “{video['title']}”")


@socketio.on("queue_remove")
def handle_queue_remove(data):
    room_code = _require_room()
    if not room_code or not _require_host(room_code):
        return
    video_id = str((data or {}).get("video_id") or "")
    if not video_id:
        emit_error(request.sid, "video_id is required.")
        return
    if Room.remove_from_queue(room_code, video_id) is not None:
        broadcast_queue(room_code)


@socketio.on("queue_clear")
def handle_queue_clear(data=None):
    room_code = _require_room()
    if not room_code or not _require_host(room_code):
        return
    Room.clear_queue(room_code)
    broadcast_queue(room_code)


@socketio.on("chat_message")
def handle_chat_message(data):
    room_code = _require_room()
    if not room_code:
        return
    text = str((data or {}).get("text") or "").strip()
    if not text:
        return
    text = text[: Config.CHAT_MAX_LENGTH]

    now = time.monotonic()
    last = _last_chat_at.get(request.sid, 0.0)
    if now - last < CHAT_THROTTLE_SECONDS:
        emit_error(request.sid, "You are sending messages too quickly.")
        return
    _last_chat_at[request.sid] = now

    room = Room.find_room(room_code) or {}
    name = next(
        (p["name"] for p in room.get("participants", []) if p["sid"] == request.sid),
        "Guest",
    )
    socketio.emit(
        "new_message",
        {"name": name, "text": text, "ts": time.time() * 1000, "system": False},
        to=room_code,
    )
