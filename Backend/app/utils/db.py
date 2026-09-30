from app.utils.config import Config

_client = None


def get_client():
    global _client
    if _client is None:
        if Config.MONGO_MOCK:
            from mongomock import MongoClient

            _client = MongoClient()
        else:
            from pymongo import MongoClient

            _client = MongoClient(
                Config.MONGO_URI,
                serverSelectionTimeoutMS=Config.MONGO_TIMEOUT_MS,
                tz_aware=True,
            )
    return _client


def get_db():
    return get_client()[Config.MONGO_DB_NAME]


def get_room_collection():
    return get_db().rooms


def ensure_indexes() -> bool:
    """Create the unique room-code index and the TTL index. Never fatal."""
    try:
        collection = get_room_collection()
        collection.create_index([("room_code", 1)], unique=True, name="room_code_unique")
        collection.create_index("expires_at", expireAfterSeconds=0, name="room_expiry")
        return True
    except Exception:
        return False


def ping() -> bool:
    try:
        get_room_collection().estimated_document_count()
        return True
    except Exception:
        return False
