import axios from 'axios';

const api = axios.create({
  baseURL: 'https://skill-exchange-platform-nypl.onrender.com/api',
  withCredentials: true,
});

export default api;
