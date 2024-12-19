from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from app.utils.config import Config

socketio = SocketIO(cors_allowed_origins="*")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)
    socketio.init_app(app)
    return app
