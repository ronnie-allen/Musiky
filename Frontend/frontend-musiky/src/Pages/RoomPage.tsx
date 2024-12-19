import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const SOCKET_SERVER_URL = 'http://localhost:5000'; // Backend Socket.IO server
const YOUTUBE_API_URL = 'http://localhost:5000/api/search'; // Flask API URL

const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [messages, setMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null); // Store the selected video ID
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false); // State to manage search modal visibility

  // Function to handle video search
  const handleSearch = async () => {
    if (!searchQuery) return;

    try {
      const response = await axios.get(`${YOUTUBE_API_URL}?q=${searchQuery}`);
      if (response.data.items) {
        setVideos(response.data.items); // Store the list of videos from the API response
        setIsSearchOpen(true); // Open the search modal
      } else {
        console.error('No videos found in the response:', response);
        setVideos([]); // Clear videos if no items are found
      }
    } catch (error) {
      console.error('Error fetching videos:', error); // Log error for debugging
      alert('There was an error fetching videos. Please try again.');
    }
  };

  // Handle sending a message (for chat functionality)
  const sendMessage = () => {
    if (currentMessage.trim()) {
      setMessages((prevMessages) => [...prevMessages, `You: ${currentMessage}`]);
      setCurrentMessage('');
    }
  };

  // Close search results modal
  const closeSearchModal = () => {
    setIsSearchOpen(false);
  };

  return (
    <div className="vh-100 d-flex flex-column" style={{ backgroundColor: '#1e1e2f' }}>
      <header className="p-2" style={{ backgroundColor: '#8e44ad', color: '#ffffff' }}>
        <h3>Room Code: {roomCode}</h3>
      </header>
      
      {/* Video Section */}
      <div className="w-100 p-3" style={{ color: '#ffffff' }}>
        <h4>Search for a YouTube Video</h4>
        <div className="d-flex align-items-center mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="form-control me-2"
            style={{ flex: 1 }}
          />
          <button onClick={handleSearch} className="btn btn-warning">Search</button>
        </div>

        {/* Search Results Modal */}
        {isSearchOpen && (
          <div className="search-modal" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999, overflowY: 'scroll', padding: '20px'
          }}>
            <div className="modal-content" style={{
              backgroundColor: '#2e2e4f', padding: '20px', borderRadius: '5px', color: '#ffffff'
            }}>
              <button onClick={closeSearchModal} className="btn btn-danger" style={{ position: 'absolute', top: '10px', right: '10px' }}>
                Close
              </button>
              <h5>Video Results:</h5>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {videos.map((video, index) => (
                  <li
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '10px',
                      cursor: 'pointer',
                      color: '#ffffff',
                    }}
                    onClick={() => setSelectedVideo(video.id.videoId)} // Set the selected video
                  >
                    <img
                      src={video.snippet.thumbnails.default.url}
                      alt={video.snippet.title}
                      style={{ width: '50px', height: '50px', marginRight: '10px' }}
                    />
                    <p style={{ margin: 0 }}>{video.snippet.title}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {selectedVideo && (
          <div className="mt-3">
            <h5>Now Playing:</h5>
            <iframe
              width="100%"
              height="300"
              src={`https://www.youtube.com/embed/${selectedVideo}?autohide=1&controls=1&showinfo=0&mute=0&modestbranding=1&origin=http://localhost`}
              title="YouTube Audio"
              allow="autoplay; encrypted-media"
              frameBorder="0"
            ></iframe>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div className="w-100 p-3" style={{ backgroundColor: '#2e2e4f', color: '#ffffff', borderLeft: '2px solid #f39c12', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h5>Chat</h5>
        <div className="chat-box flex-grow-1" style={{ maxHeight: 'calc(100% - 120px)', overflowY: 'auto', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
          {messages.map((msg, index) => (
            <p key={index} style={{ margin: 0, padding: '5px 0' }}>{msg}</p>
          ))}
        </div>
        
        {/* Bottom Chatbox */}
        <div className="d-flex align-items-center" style={{ backgroundColor: '#8e44ad', padding: '10px' }}>
          <input
            className="form-control me-2"
            placeholder="Type a message"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            style={{ backgroundColor: '#2e2e4f', color: '#ffffff', border: '1px solid #f39c12', flex: 1 }}
          />
          <button className="btn btn-warning" onClick={sendMessage} style={{ backgroundColor: '#f39c12', color: '#fff' }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
