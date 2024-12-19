from googleapiclient.discovery import build
from app.utils.config import Config

youtube = build("youtube", "v3", developerKey=Config.YOUTUBE_API_KEY)

def search_videos(query):
    response = youtube.search().list(
        q=query,
        part="snippet",
        type="video",
        maxResults=10
    ).execute()
    return response.get("items", [])

from app.youtube_api import search_videos

@api.route("/search", methods=["GET"])
def search():
    query = request.args.get("query")
    results = search_videos(query)
    return jsonify(results), 200
