from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from app.utils.config import Config
from app.utils.db import ensure_indexes

socketio = SocketIO(
    cors_allowed_origins=Config.CORS_ORIGINS,
    async_mode="threading",
    logger=False,
    engineio_logger=False,
)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})

    socketio.init_app(app, cors_allowed_origins=Config.CORS_ORIGINS)
    ensure_indexes()

    from app.routes import api
    from app import sockets  # noqa: F401  (imported for its event handlers)

    app.register_blueprint(api)

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(_error):  # pragma: no cover - defensive
        return jsonify({"error": "Internal server error"}), 500

    return app
