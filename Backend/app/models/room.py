from app.utils.db import get_room_collection

class Room:
    @staticmethod
    def create_room(room_code, video_queue=None):
        video_queue = video_queue or []
        get_room_collection().insert_one({
            "room_code": room_code,
            "video_queue": video_queue,
            "participants": [],
        })

    @staticmethod
    def find_room(room_code):
        return get_room_collection().find_one({"room_code": room_code})

    @staticmethod
    def delete_room(room_code):
        get_room_collection().delete_one({"room_code": room_code})
