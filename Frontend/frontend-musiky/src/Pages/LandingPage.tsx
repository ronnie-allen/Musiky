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
      <div className="landing-sheet">
        <div className="landing-masthead">
          <span className="brand brand-lg">Musiky</span>
          <div className="landing-edition mono">
            <span>No. 01</span>
            <span>Shared listening rooms</span>
          </div>
        </div>

        <div className="landing-grid">
          <div className="landing-lede">
            <p className="landing-kicker">One record &middot; every ear &middot; same second</p>
            <h1 className="landing-headline">
              Press
              <br />
              play
              <br />
              <em>together</em>
            </h1>
            <p className="landing-deck">
              Open a room, read the six-digit code out loud, and everyone hears the same track at the
              same second. Queue requests, trade notes in the ledger, and let the host work the desk.
            </p>
          </div>

          <div className="ticket-counter">
            <div className="ticket-stack">
              <span className="ticket-tab mono">Counter A / open a room</span>
              <button className="btn btn-accent w-100" onClick={() => setShowCreateRoom(true)}>
                Create room
              </button>
            </div>
            <div className="ticket-stack">
              <span className="ticket-tab mono">Counter B / redeem a code</span>
              <button className="btn btn-ghost w-100" onClick={() => setShowJoinRoom(true)}>
                Join with a code
              </button>
            </div>
            <span className="ticket-fine">
              No account. No installs. A room that goes quiet for good is never coming back.
            </span>
          </div>
        </div>

        {status && (
          <div className="landing-status-bar">
            <span className="status-tag">Line check: {status.ok ? 'pass' : 'fail'}</span>
            <p className={`small landing-status ${status.ok ? '' : 'is-bad'}`}>
              {status.message ??
                (status.youtube === false
                  ? 'Tip: set YOUTUBE_API_KEY on the backend to enable search.'
                  : 'Backend connected.')}
            </p>
          </div>
        )}

        <div className="landing-foot mono">
          <span>Shared playback</span>
          <span>Queue desk</span>
          <span>Room chat</span>
        </div>
      </div>

      {showCreateRoom && <CreateRoomPopup onClose={() => setShowCreateRoom(false)} />}
      {showJoinRoom && <JoinRoomPopup onClose={() => setShowJoinRoom(false)} />}
    </div>
  );
}
