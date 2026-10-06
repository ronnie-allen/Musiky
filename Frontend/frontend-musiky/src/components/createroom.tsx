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
          <span>Counter A / open a room</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="modal-sheet">
          {!roomCode ? (
            <>
              <span className="ticket-tab mono">Ticket 01 / press the plate</span>
              <p className="modal-lede">
                We print a six-digit room code. Read it out, or send the stub link, and whoever joins
                hears the same second of the same record.
              </p>
              {error && <p className="small text-danger-soft">{error}</p>}
              <button className="btn btn-accent w-100" onClick={createRoom} disabled={busy}>
                {busy ? 'Creating…' : 'Generate room code'}
              </button>
            </>
          ) : (
            <form onSubmit={enterRoom}>
              <span className="ticket-tab mono">Ticket 02 / keep this stub</span>
              <p className="modal-lede text-center">Room code</p>
              <p className="room-code room-code-xl mb-3">{roomCode}</p>
              <hr className="perforation" />
              <input
                className="form-control invite-stub mb-3"
                readOnly
                value={shareableLink}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="d-flex gap-2 mb-3 flex-wrap">
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
