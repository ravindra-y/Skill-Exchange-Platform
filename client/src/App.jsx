import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Requests from './pages/Requests';
import Room from './pages/Room';
import Conversations from './pages/Conversations';
import ChatView from './pages/ChatView';

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/discover"     element={<ProtectedRoute><Discover /></ProtectedRoute>} />
                <Route path="/requests"     element={<ProtectedRoute><Requests /></ProtectedRoute>} />
                <Route path="/room/:id"     element={<ProtectedRoute><Room /></ProtectedRoute>} />
                <Route path="/conversations"         element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
                <Route path="/conversations/:exchangeRequestId" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
              </Routes>
            </main>
          </div>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
