import axios from 'axios';

const defaultBaseUrl = import.meta.env.DEV
  ? 'http://localhost:5000/api'
  : 'https://skill-exchange-platform-nypl.onrender.com/api';

const rawBaseUrl = import.meta.env.VITE_API_URL || defaultBaseUrl;
const baseURL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export default api;
