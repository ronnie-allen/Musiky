from pymongo import MongoClient
from app.utils.config import Config

client = MongoClient(Config.MONGO_URI)
db = client.youtube_rooms

def get_room_collection():
    return db.rooms
