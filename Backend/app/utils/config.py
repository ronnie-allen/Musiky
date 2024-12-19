import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "mysecret")
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/youtube_rooms")
    YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "YOUR_YOUTUBE_API_KEY")
