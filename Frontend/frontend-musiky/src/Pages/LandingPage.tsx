import React, { useState } from 'react';
import CreateRoomPopup from '../components/createroom';
import JoinRoomPopup from '../components/joinroom';

const LandingPage: React.FC = () => {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);

  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center vh-100"
      style={{
        backgroundColor: '#1e1e2f', // Dark purple background
        color: '#ffffff', // White text
      }}
    >
      <h1>Live Music Platform</h1>
      <p>Listen to music live with friends across the globe!</p>
      <div className="mt-4">
        <button
          className="btn"
          style={{
            backgroundColor: '#f39c12', // Primary button (Orange)
            color: '#ffffff', // White text
            border: 'none',
            padding: '10px 20px',
            fontSize: '16px',
            borderRadius: '8px',
            marginRight: '10px',
          }}
          onClick={() => setShowCreateRoom(true)}
        >
          Create Room
        </button>
        <button
          className="btn"
          style={{
            backgroundColor: '#8e44ad', // Secondary button (Purple)
            color: '#ffffff', // White text
            border: 'none',
            padding: '10px 20px',
            fontSize: '16px',
            borderRadius: '8px',
          }}
          onClick={() => setShowJoinRoom(true)}
        >
          Join Room
        </button>
      </div>
      {showCreateRoom && <CreateRoomPopup onClose={() => setShowCreateRoom(false)} />}
      {showJoinRoom && <JoinRoomPopup onClose={() => setShowJoinRoom(false)} />}
    </div>
  );
};

export default LandingPage;
