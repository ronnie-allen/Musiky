import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, ApiError } from '../lib/api';

interface CreateRoomPopupProps {
  onClose: () => void;
}

export default function CreateRoomPopup({ onClose }: CreateRoomPopupProps) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const shareableLink = roomCode ? `${window.location.origin}/room/${roomCode}` : '';

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.createRoom();
      setRoomCode(response.room_code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy automatically. Copy the link manually.');
    }
  };

  const enterRoom = (event: FormEvent) => {
    event.preventDefault();
    if (roomCode) navigate(`/room/${roomCode}`);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create room">
      <div className="modal-card">
        <div className="panel-head">
          <span>Create a room</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-3">
          {!roomCode ? (
            <>
              <p className="opacity-75 small">
                A six digit code is generated for you. Share it so friends can listen with you.
              </p>
              {error && <p className="small text-danger-soft">{error}</p>}
              <button className="btn btn-accent w-100" onClick={createRoom} disabled={busy}>
                {busy ? 'Creating…' : 'Generate room code'}
              </button>
            </>
          ) : (
            <form onSubmit={enterRoom}>
              <p className="text-center mb-1 opacity-75 small">Your room code</p>
              <p className="room-code text-center mb-3" style={{ fontSize: '2rem' }}>
                {roomCode}
              </p>
              <input className="form-control mb-2" readOnly value={shareableLink} onFocus={(e) => e.currentTarget.select()} />
              <div className="d-flex gap-2 mb-3">
                <button type="button" className="btn btn-ghost flex-grow-1" onClick={copyToClipboard}>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <a
                  className="btn btn-ghost"
                  href={`https://wa.me/?text=${encodeURIComponent(`Join my Musiky room: ${shareableLink}`)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  WhatsApp
                </a>
              </div>
              <button type="submit" className="btn btn-accent w-100">
                Enter room
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
