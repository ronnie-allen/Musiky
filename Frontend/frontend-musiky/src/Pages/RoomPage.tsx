import React from 'react';
import { useParams } from 'react-router-dom';

const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();

  return (
    <div
      className="vh-100 d-flex flex-column"
      style={{ backgroundColor: '#1e1e2f' }} // Dark purple background
    >
      <header
        className="p-2"
        style={{
          backgroundColor: '#8e44ad', // Purple background
          color: '#ffffff', // White text
        }}
      >
        <h3>Room Code: {roomCode}</h3>
      </header>
      <div className="d-flex flex-grow-1">
        <div className="w-75 p-3">
          <iframe
            width="100%"
            height="400"
            src="https://www.youtube.com/embed"
            title="YouTube Player"
            allowFullScreen
          ></iframe>
        </div>
        <div
          className="w-25 p-3"
          style={{
            backgroundColor: '#2e2e4f', // Deep violet background for chat section
            color: '#ffffff', // White text
            borderLeft: '2px solid #f39c12', // Orange border to match primary button
          }}
        >
          <h5>Chat</h5>
          <div
            className="chat-box"
            style={{
              height: '300px',
              overflowY: 'scroll',
              backgroundColor: '#2e2e4f', // Deep violet chat box
              color: '#ffffff', // White text
            }}
          >
            {/* Chat messages */}
          </div>
          <input
            className="form-control mt-2"
            placeholder="Type a message"
            color='#ffffff'
            style={{
              backgroundColor: '#2e2e4f', // Deep violet background for input
              color: '#ffffff', // White text
              border: '1px solid #f39c12', // Orange border
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
