import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, ApiError } from '../lib/api';

interface JoinRoomPopupProps {
  onClose: () => void;
}

export default function JoinRoomPopup({ onClose }: JoinRoomPopupProps) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const joinRoom = async (event: FormEvent) => {
    event.preventDefault();
    const code = roomCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Room codes are exactly six digits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.getRoom(code);
      navigate(`/room/${code}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('No room with that code. Ask the host for a fresh invite.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Join room">
      <form className="modal-card" onSubmit={joinRoom}>
        <div className="panel-head">
          <span>Join a room</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-3">
          <label className="form-label small opacity-75" htmlFor="room-code">
            Six digit room code
          </label>
          <input
            id="room-code"
            className="form-control mb-2"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={roomCode}
            onChange={(event) => {
              setRoomCode(event.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="123456"
          />
          {error && <p className="small text-danger-soft">{error}</p>}
          <button className="btn btn-accent w-100" type="submit" disabled={busy || !roomCode}>
            {busy ? 'Checking…' : 'Join room'}
          </button>
        </div>
      </form>
    </div>
  );
}
