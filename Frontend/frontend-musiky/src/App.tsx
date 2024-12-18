import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './Pages/LandingPage';
import RoomPage from './Pages/RoomPage';
import CreateRoomPopup from './components/createroom';
import JoinRoomPopup from './components/joinroom';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/createroom" element={<CreateRoomPopup onClose={function (): void {
          throw new Error('Function not implemented.');
        } } />} />
        <Route path="/joinroom" element={<JoinRoomPopup onClose={function (): void {
          throw new Error('Function not implemented.');
        } } />} />
      </Routes>
    </Router>
  );
};

export default App;
