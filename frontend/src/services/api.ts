import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
