from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

YOUTUBE_API_KEY = 'AIzaSyBS7_vN8D4Mqtr1ifR1hpN6jvBq1yTcS6A'  # Replace with your YouTube API key
YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search'

@app.route('/api/search', methods=['GET'])
def search_videos():
    query = request.args.get('q')  # Get the search query parameter
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    try:
        response = requests.get(
            YOUTUBE_API_URL,
            params={
                'part': 'snippet',
                'q': query,
                'key': YOUTUBE_API_KEY
            }
        )
        data = response.json()

        if 'items' in data:
            return jsonify(data)  # Return the YouTube API response
        else:
            return jsonify({"error": "No results found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
