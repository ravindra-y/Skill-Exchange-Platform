import React, { createContext, useState, useEffect } from 'react';
import axios from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await axios.get('/auth/me');
        setUser(data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/auth/login', { email, password });
    setUser(data);
  };

  const signup = async (userData) => {
    const { data } = await axios.post('/auth/signup', userData);
    setUser(data);
  };

  const logout = async () => {
    await axios.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
