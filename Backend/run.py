from app import create_app, socketio
from app.utils.config import Config

app = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        allow_unsafe_werkzeug=Config.DEBUG,
    )
