import os

_TRUE_VALUES = {"1", "true", "yes", "on"}


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUE_VALUES


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "musiky")
    MONGO_MOCK = _env_flag("MONGO_MOCK")
    MONGO_TIMEOUT_MS = _env_int("MONGO_TIMEOUT_MS", 2000)

    YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
    YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
    YOUTUBE_MAX_RESULTS = _env_int("YOUTUBE_MAX_RESULTS", 10)
    YOUTUBE_TIMEOUT_SECONDS = _env_int("YOUTUBE_TIMEOUT_SECONDS", 8)

    ROOM_CODE_LENGTH = _env_int("ROOM_CODE_LENGTH", 6)
    ROOM_TTL_SECONDS = _env_int("ROOM_TTL_SECONDS", 60 * 60 * 6)
    ROOM_MAX_PARTICIPANTS = _env_int("ROOM_MAX_PARTICIPANTS", 50)
    ROOM_MAX_QUEUE = _env_int("ROOM_MAX_QUEUE", 100)
    CHAT_MAX_LENGTH = _env_int("CHAT_MAX_LENGTH", 500)

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ] or ["*"]

    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = _env_int("PORT", 5000)
    DEBUG = _env_flag("FLASK_DEBUG")
