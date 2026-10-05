"""Backend tests: REST API, Socket.IO events, and host rules.

Runs entirely in-process against mongomock, so no MongoDB or YouTube key is
needed:

    PYTHONPATH=. MONGO_MOCK=1 python Backend/tests/test_api.py
"""
import json
import os
import sys
import time

failures = []
checks = 0


def check(label, ok, extra=""):
    global checks
    checks += 1
    if ok:
        print(f"  PASS  {label}")
    else:
        failures.append(label)
        print(f"  FAIL  {label} {json.dumps(extra, default=str) if extra != '' else ''}")


VIDEO_A = {
    "video_id": "aaaaaaaaaaa",
    "title": "Smoke Track A",
    "channel": "Smoke Channel",
    "duration": 213,
    "thumbnail": "http://127.0.0.1:5099/thumb/aaaaaaaaaaa.jpg",
}
VIDEO_B = {
    "video_id": "bbbbbbbbbbb",
    "title": "Smoke Track B",
    "channel": "Smoke Channel",
    "duration": 190,
    "thumbnail": "http://127.0.0.1:5099/thumb/bbbbbbbbbbb.jpg",
}


def main():
    from app import create_app, socketio

    app = create_app()
    client = app.test_client()

    print("== health and room creation ==")
    res = client.get("/api/health")
    check("health returns ok", res.status_code == 200 and res.get_json()["status"] == "ok", res.get_json())
    check("health reports the database", res.get_json().get("database") == "connected", res.get_json())

    res = client.post("/api/rooms", json={})
    check("create room returns 201", res.status_code == 201, res.status_code)
    check("create returns only the code", list(res.get_json()) == ["room_code"], res.get_json())
    code = res.get_json()["room_code"]
    check("room code is six digits", len(code) == 6 and code.isdigit(), code)

    room = client.get(f"/api/rooms/{code}").get_json()
    check("room starts empty", not room.get("current") and not room.get("video_queue"), room)
    playback = room["playback"]
    check("playback starts paused at zero",
          playback["state"] == "paused" and playback["position"] == 0.0, playback)
    check("playback defaults are sane",
          playback["volume"] == 100 and playback["muted"] is False, playback)

    res = client.get(f"/api/rooms/{code}")
    check("fetch room by code", res.status_code == 200 and res.get_json()["room_code"] == code)

    res = client.get("/api/rooms/999999")
    check("unknown room is a 404", res.status_code == 404, res.status_code)

    print("\n== validation ==")
    check("search without q is a 400", client.get("/api/search").status_code == 400)
    # this process has no API key, so search must fail loudly instead of crashing
    search = client.get("/api/search?q=smoke")
    check("search without a key is a 502", search.status_code == 502, search.status_code)
    check("search error is explained", "youtube" in search.get_json()["error"].lower(), search.get_json())

    print("\n== queue over REST ==")
    res = client.post(f"/api/rooms/{code}/queue", json={"video": VIDEO_A, "name": "Rest User"})
    check("queue add returns 201", res.status_code == 201, res.status_code)
    check("queue holds the track", len(res.get_json()["video_queue"]) == 1)
    check("queue records who added", res.get_json()["video_queue"][0]["added_by"] == "Rest User",
          res.get_json()["video_queue"][0])

    res = client.post(f"/api/rooms/{code}/queue", json={"video": VIDEO_A})
    check("duplicate queue entry is refused", res.status_code == 409, res.status_code)

    res = client.post(f"/api/rooms/{code}/queue", json={"video": {"title": "no id"}})
    check("queue add without a video id is a 400", res.status_code == 400, res.status_code)

    print("\n== socket flow ==")
    host = socketio.test_client(app)
    guest = socketio.test_client(app)
    check("host connected", host.is_connected())

    host.emit("join", {"room": code, "name": "Host"})
    host_received = host.get_received()
    names = [m["name"] for m in host_received]
    check("host receives room_state", "room_state" in names, names)
    check("host receives its own join", "participant_joined" in names, names)
    state = next(m["args"][0] for m in host_received if m["name"] == "room_state")
    host_sid = next(p["sid"] for p in state["participants"] if p["name"] == "Host")
    check("first participant is the host", state["host_sid"] == host_sid, state["host_sid"])
    check("room lists one participant", len(state["participants"]) == 1, state["participants"])

    guest.emit("join", {"room": code, "name": "Guest"})
    guest.get_received()
    after_guest = host.get_received()
    check("host is told about the guest", any(
        m["name"] == "participants" and len(m["args"][0]) == 2 for m in after_guest
    ), [m["name"] for m in after_guest])

    print("\n== host rules ==")
    guest.emit("play_video", {"video": VIDEO_B})
    guest.get_received()
    state = client.get(f"/api/rooms/{code}").get_json()
    check("listener cannot set now playing", not state.get("current_video"), state.get("current_video"))

    guest.emit("queue_clear", {})
    guest.get_received()
    check("listener cannot clear the queue", len(client.get(f"/api/rooms/{code}").get_json()["video_queue"]) == 1)

    guest.emit("chat_message", {"text": "hello from the listener"})
    guest_msgs = [m["name"] for m in guest.get_received()]
    check("listener can chat", "new_message" in guest_msgs, guest_msgs)

    print("\n== playback ==")
    host.emit("play_video", {"video": VIDEO_B, "autoplay": True})
    host.get_received()
    guest.get_received()

    state = client.get(f"/api/rooms/{code}").get_json()
    check("host set now playing", state["current_video"]["video_id"] == VIDEO_B["video_id"], state["current_video"])
    check("playback is playing from zero", state["playback"]["state"] == "playing"
          and state["playback"]["position"] == 0.0, state["playback"])
    check("playing an unqueued track leaves the queue alone", len(state["video_queue"]) == 1, state["video_queue"])

    guest.get_received()
    host.get_received()
    host.emit("playback", {"action": "pause", "position": 0})
    time.sleep(0.3)
    guest_events = guest.get_received()
    host_events = host.get_received()
    check("pause reached the listener", any(
        m["name"] == "playback_state" and m["args"][0]["state"] == "paused" for m in guest_events
    ), [m["name"] for m in guest_events])
    check("sender does not get its own playback echo", not any(
        m["name"] == "playback_state" for m in host_events
    ), [m["name"] for m in host_events])
    state = client.get(f"/api/rooms/{code}").get_json()
    check("pause stores the position it was given", state["playback"]["position"] == 0.0, state["playback"])

    host.emit("playback", {"action": "seek", "position": 150})
    state = client.get(f"/api/rooms/{code}").get_json()
    check("seek stores the position", abs(state["playback"]["position"] - 150) < 1.5, state["playback"])
    check("seeking does not resume playback", state["playback"]["state"] == "paused", state["playback"])

    guest.emit("playback", {"action": "seek", "position": 5})
    state = client.get(f"/api/rooms/{code}").get_json()
    check("seek does not require the host", abs(state["playback"]["position"] - 5) < 1.5, state["playback"])

    host.emit("playback", {"action": "play", "position": 5})
    check("resume returns to playing", client.get(f"/api/rooms/{code}").get_json()["playback"]["state"] == "playing")

    host.emit("playback", {"action": "volume", "volume": 35})
    check("volume is stored", client.get(f"/api/rooms/{code}").get_json()["playback"]["volume"] == 35)

    host.emit("playback", {"action": "mute", "muted": True})
    check("mute is stored", client.get(f"/api/rooms/{code}").get_json()["playback"]["muted"] is True)

    host.emit("playback", {"action": "nonsense"})
    check("unknown playback action is refused", any(
        m["name"] == "error" for m in host.get_received()
    ))

    print("\n== queue through sockets ==")
    host.emit("queue_add", {"video": VIDEO_A, "name": "Host"})
    host.emit("queue_add", {"video": VIDEO_B, "name": "Host"})
    guest.get_received()
    state = client.get(f"/api/rooms/{code}").get_json()
    check("two tracks queued", len(state["video_queue"]) == 2, state["video_queue"])

    host.emit("queue_add", {"video": VIDEO_A, "name": "Host"})
    guest.get_received()
    check("duplicate over sockets is refused",
          len(client.get(f"/api/rooms/{code}").get_json()["video_queue"]) == 2)

    host.emit("queue_remove", {"video_id": VIDEO_A["video_id"]})
    check("host can remove from the queue",
          [q["video_id"] for q in client.get(f"/api/rooms/{code}").get_json()["video_queue"]] == [VIDEO_B["video_id"]])

    host.emit("advance", {"autoplay": True})
    state = client.get(f"/api/rooms/{code}").get_json()
    check("advance plays the next track", state["current_video"]["video_id"] == VIDEO_B["video_id"], state["current_video"])
    check("advance empties the queue", state["video_queue"] == [], state["video_queue"])

    print("\n== host handover ==")
    host.disconnect()
    time.sleep(0.3)
    guest_msgs = [m for m in guest.get_received() if m["name"] in ("room_state", "new_message")]
    guest_sid = next((p["sid"] for m in guest_msgs if m["name"] == "room_state"
                      for p in m["args"][0]["participants"] if p["name"] == "Guest"), None)
    check("remaining listener inherits the host", any(
        m["name"] == "room_state" and m["args"][0]["host_sid"] == guest_sid for m in guest_msgs
    ), [m["name"] for m in guest_msgs])
    check("handover is announced", any(
        m["name"] == "new_message" and "is now the host" in m["args"][0]["text"] for m in guest_msgs
    ))

    guest.emit("play_video", {"video": VIDEO_A})
    state = client.get(f"/api/rooms/{code}").get_json()
    check("new host can control playback", state["current_video"]["video_id"] == VIDEO_A["video_id"], state["current_video"])
    guest.disconnect()

    time.sleep(0.3)
    check("empty room still readable", client.get(f"/api/rooms/{code}").status_code == 200)

    if failures:
        print(f"\nFAILED ({len(failures)}): {', '.join(failures)}")
    else:
        print(f"\nALL BACKEND CHECKS PASSED ({checks} checks)")


if __name__ == "__main__":
    main()
    sys.exit(1 if failures else 0)
