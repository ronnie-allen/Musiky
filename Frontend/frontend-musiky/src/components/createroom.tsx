import React, { useState } from 'react';

interface CreateRoomPopupProps {
  onClose: () => void;
}

const CreateRoomPopup: React.FC<CreateRoomPopupProps> = ({ onClose }) => {
  const [roomCode, setRoomCode] = useState<string>('');

  const generateRoomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(code);
  };

  const shareableLink = `${window.location.origin}/room/${roomCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableLink);
    alert('Room link copied to clipboard!');
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
          <h5 style={{ margin: 0 }}>Create Room</h5>
          <button
            type="button"
            className="btn-close btn-close-white"
            aria-label="Close"
            onClick={onClose}
            style={{ position: 'relative', right: '-5px' }}
          ></button>
        </div>
        <div className="card-body text-center mt-3">
          {roomCode ? (
            <>
              <h4>Room Code: <strong>{roomCode}</strong></h4>
              <p className="mt-3">Share this link with your friends:</p>
              <input
                className="form-control mb-3"
                type="text"
                value={shareableLink}
                readOnly
              />
              <div className="d-flex flex-column gap-2">
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#f39c12', borderColor: '#f39c12' }}
                  onClick={copyToClipboard}
                >
                  Copy Link
                </button>
                <div className="d-flex justify-content-center gap-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=Join my room: ${shareableLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${shareableLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#3b5998', borderColor: '#3b5998' }}
                  >
                    Facebook
                  </a>
                  <a
                    href={`mailto:?subject=Join my room&body=Here is the room link: ${shareableLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#8e44ad', borderColor: '#8e44ad' }}
                  >
                    Email
                  </a>
                </div>
              </div>
            </>
          ) : (
            <button
              className="btn btn-primary"
              style={{ backgroundColor: '#f39c12', borderColor: '#f39c12' }}
              onClick={generateRoomCode}
            >
              Generate Room Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateRoomPopup;
