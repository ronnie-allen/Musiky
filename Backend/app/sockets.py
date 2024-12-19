from flask_socketio import emit, join_room, leave_room
from app import socketio

@socketio.on("join")
def handle_join(data):
    room = data.get("room")
    join_room(room)
    emit("user_joined", {"message": "A new user joined the room"}, to=room)

@socketio.on("playback_control")
def handle_playback(data):
    room = data.get("room")
    emit("sync_playback", data, to=room)

@socketio.on("chat_message")
def handle_chat(data):
    room = data.get("room")
    emit("new_message", data, to=room)

@socketio.on("leave")
def handle_leave(data):
    room = data.get("room")
    leave_room(room)
