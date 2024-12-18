import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface JoinRoomPopupProps {
  onClose: () => void;
}

const JoinRoomPopup: React.FC<JoinRoomPopupProps> = ({ onClose }) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (roomCode.length === 6 && /^[0-9]+$/.test(roomCode)) {
      navigate(`/room/${roomCode}`);
    } else {
      setError('Please enter a valid 6-digit room code.');
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1050,
      }}
    >
      <div
        className="card"
        style={{
          width: '28rem',
          backgroundColor: '#2e2e4f',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <div
          className="d-flex justify-content-between align-items-center"
          style={{
            backgroundColor: '#8e44ad',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
          }}
        >
          <h5 style={{ margin: 0 }}>Join Room</h5>
          <button
            type="button"
            className="btn-close btn-close-white"
            aria-label="Close"
            onClick={onClose}
            style={{ position: 'relative', right: '-5px' }}
          ></button>
        </div>
        <div className="card-body text-center mt-3">
          <input
            className="form-control mb-3"
            type="text"
            placeholder="Enter 6-digit Room Code"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value);
              setError('');
            }}
            style={{
              backgroundColor: '#f1f1f1',
              borderColor: '#f1f1f1',
              color: '#333',
            }}
          />
          {error && <p className="text-danger" style={{ color: '#e74c3c' }}>{error}</p>}
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            style={{ backgroundColor: '#f39c12', borderColor: '#f39c12' }}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinRoomPopup;
