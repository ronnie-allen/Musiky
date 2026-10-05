import time

from app import socketio
from app.models.room import Room


def room_state(room_code, sid=None):
    """Build the canonical room snapshot handed to clients."""
    room = Room.find_room(room_code)
    if not room:
        return None
    return {
        "room_code": room["room_code"],
        "host_sid": room.get("host_sid"),
        "is_host": bool(sid) and room.get("host_sid") == sid,
        "current_video": room.get("current_video"),
        "video_queue": room.get("video_queue", []),
        "playback": room.get("playback"),
        "participants": [
            {"sid": p["sid"], "name": p["name"]} for p in room.get("participants", [])
        ],
        "expires_at": room.get("expires_at"),
    }


def emit_room_state(room_code, sid):
    state = room_state(room_code, sid)
    if state:
        socketio.emit("room_state", state, to=sid)
    return state


def broadcast_participants(room_code):
    room = Room.find_room(room_code)
    if not room:
        return
    payload = [{"sid": p["sid"], "name": p["name"]} for p in room.get("participants", [])]
    socketio.emit("participants", payload, to=room_code)


def broadcast_room_state(room_code):
    """Re-send each participant their own room_state.

    is_host is per-sid, so the state cannot be broadcast as one shared payload.
    Roster and host ownership both change when somebody joins or leaves.
    """
    room = Room.find_room(room_code)
    if not room:
        return
    for participant in room.get("participants", []):
        state = room_state(room_code, participant.get("sid"))
        if state:
            socketio.emit("room_state", state, to=participant["sid"])


def broadcast_queue(room_code):
    room = Room.find_room(room_code)
    if not room:
        return
    socketio.emit("queue_updated", {"video_queue": room.get("video_queue", [])}, to=room_code)


def broadcast_playback(room_code, playback, skip_sid=None):
    if not playback:
        return
    socketio.emit("playback_state", playback, to=room_code, skip_sid=skip_sid)


def broadcast_now_playing(room_code, video, source=""):
    socketio.emit("now_playing", {"video": video, "source": source}, to=room_code)


def system_message(room_code, text):
    socketio.emit(
        "new_message",
        {"name": "Musiky", "text": text, "ts": time.time() * 1000, "system": True},
        to=room_code,
    )


def emit_error(sid, message):
    socketio.emit("error", {"message": message}, to=sid)
