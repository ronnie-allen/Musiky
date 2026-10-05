from flask import Blueprint, jsonify, request

from app.models.room import Room, RoomExistsError, normalize_video
from app.utils.db import ping as db_ping
from app.youtube_api import YouTubeError, is_configured, search_videos

api = Blueprint("api", __name__, url_prefix="/api")


def error(message, status):
    return jsonify({"error": message}), status


def room_or_404(room_code):
    room = Room.find_room(room_code)
    if room is None:
        return None, error(f"Room {room_code} does not exist or has expired.", 404)
    return room, None


@api.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "database": "connected" if db_ping() else "unavailable",
            "youtube_configured": is_configured(),
        }
    ), 200


@api.post("/rooms")
def create_room():
    payload = request.get_json(silent=True) or {}
    try:
        room = Room.create_room(room_code=payload.get("room_code"))
    except RoomExistsError as exc:
        return error(str(exc), 409)
    return jsonify({"room_code": room["room_code"]}), 201


@api.get("/rooms/<room_code>")
def get_room(room_code):
    room, failure = room_or_404(room_code)
    if failure:
        return failure
    return jsonify(room), 200


@api.post("/rooms/<room_code>/queue")
def enqueue(room_code):
    room, failure = room_or_404(room_code)
    if failure:
        return failure
    payload = request.get_json(silent=True) or {}
    video = normalize_video(payload.get("video") or payload)
    if not video:
        return error("A video with a video_id is required.", 400)
    queue, added = Room.add_to_queue(room_code, video, added_by=payload.get("added_by") or payload.get("name"))
    if queue is None:
        return error("Could not update the queue.", 500)
    if not added:
        return error("That video is already queued or the queue is full.", 409)
    from app.events import broadcast_queue

    broadcast_queue(room_code)
    return jsonify({"video_queue": queue}), 201


@api.delete("/rooms/<room_code>/queue/<video_id>")
def dequeue(room_code, video_id):
    room, failure = room_or_404(room_code)
    if failure:
        return failure
    queue = Room.remove_from_queue(room_code, video_id)
    if queue is None:
        return error("Could not update the queue.", 500)
    from app.events import broadcast_queue

    broadcast_queue(room_code)
    return jsonify({"video_queue": queue}), 200


@api.delete("/rooms/<room_code>/queue")
def clear_queue(room_code):
    room, failure = room_or_404(room_code)
    if failure:
        return failure
    from app.events import broadcast_queue

    queue = Room.clear_queue(room_code)
    broadcast_queue(room_code)
    return jsonify({"video_queue": queue}), 200


@api.get("/search")
def search():
    query = request.args.get("q") or request.args.get("query")
    if not query or not query.strip():
        return error("Query parameter 'q' is required.", 400)
    try:
        max_results = int(request.args.get("maxResults", 10))
    except ValueError:
        return error("'maxResults' must be an integer.", 400)
    try:
        items = search_videos(query, max_results=max_results)
    except ValueError as exc:
        return error(str(exc), 400)
    except YouTubeError as exc:
        return error(str(exc), 502)
    return jsonify({"query": query.strip(), "count": len(items), "items": items}), 200
