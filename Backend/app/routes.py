from flask import Blueprint, request, jsonify
from app.models.room import Room
import random

api = Blueprint("api", __name__)

@api.route("/create_room", methods=["POST"])
def create_room():
    room_code = "".join(random.choices("0123456789", k=6))
    Room.create_room(room_code)
    return jsonify({"room_code": room_code}), 201

@api.route("/join_room/<room_code>", methods=["GET"])
def join_room(room_code):
    room = Room.find_room(room_code)
    if room:
        return jsonify({"message": "Room found"}), 200
    return jsonify({"error": "Room not found"}), 404
