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
import BlogList from './pages/BlogList';
import BlogPost from './pages/BlogPost';
import BlogEditor from './pages/BlogEditor';
import PlaylistList from './pages/PlaylistList';
import PlaylistView from './pages/PlaylistView';
import PlaylistEditor from './pages/PlaylistEditor';

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col">
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
                
                <Route path="/blog"         element={<ProtectedRoute><BlogList /></ProtectedRoute>} />
                <Route path="/blog/new"     element={<ProtectedRoute><BlogEditor /></ProtectedRoute>} />
                <Route path="/blog/:id"     element={<ProtectedRoute><BlogPost /></ProtectedRoute>} />
                <Route path="/blog/:id/edit" element={<ProtectedRoute><BlogEditor /></ProtectedRoute>} />

                <Route path="/playlister"         element={<ProtectedRoute><PlaylistList /></ProtectedRoute>} />
                <Route path="/playlister/new"     element={<ProtectedRoute><PlaylistEditor /></ProtectedRoute>} />
                <Route path="/playlister/:id"     element={<ProtectedRoute><PlaylistView /></ProtectedRoute>} />
                <Route path="/playlister/:id/edit" element={<ProtectedRoute><PlaylistEditor /></ProtectedRoute>} />
              </Routes>
            </main>
          </div>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
