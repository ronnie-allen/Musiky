import { useEffect, useState } from 'react';

import CreateRoomPopup from '../components/createroom';
import JoinRoomPopup from '../components/joinroom';
import { api, ApiError } from '../lib/api';

type ServerStatus = { ok: boolean; message?: string; youtube?: boolean };

export default function LandingPage() {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [status, setStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((health) => {
        if (cancelled) return;
        setStatus({
          ok: health.status === 'ok',
          youtube: health.youtube_configured,
          message:
            health.status !== 'ok'
              ? 'The server responded with an unexpected status.'
              : health.database !== 'connected'
                ? 'Connected, but the database is unreachable. Rooms will not persist.'
                : undefined,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus({
          ok: false,
          message:
            err instanceof ApiError
              ? `Cannot reach the server (${err.status}). Start the backend on port 5000.`
              : 'Cannot reach the server. Start the backend on port 5000.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-shell landing">
      <div className="landing-card">
        <span className="brand brand-lg">Musiky</span>
        <h1 className="h4 mt-2 mb-1">Listen to music together, in sync</h1>
        <p className="opacity-75 mb-4">
          Create a room, share the code, and everyone hears the same track at the same second. Chat, queue
          songs and let the host drive.
        </p>

        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <button className="btn btn-accent" onClick={() => setShowCreateRoom(true)}>
            Create room
          </button>
          <button className="btn btn-ghost" onClick={() => setShowJoinRoom(true)}>
            Join with a code
          </button>
        </div>

        {status && (
          <p className={`small mt-4 mb-0 ${status.ok ? 'opacity-75' : 'text-danger-soft'}`}>
            {status.message ??
              (status.youtube === false
                ? 'Tip: set YOUTUBE_API_KEY on the backend to enable search.'
                : 'Backend connected.')}
          </p>
        )}
      </div>

      {showCreateRoom && <CreateRoomPopup onClose={() => setShowCreateRoom(false)} />}
      {showJoinRoom && <JoinRoomPopup onClose={() => setShowJoinRoom(false)} />}
    </div>
  );
}
