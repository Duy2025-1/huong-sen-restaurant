import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { initSocketServer } from './sockets/socket.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = createApp();
const server = http.createServer(app);

// Initialize Socket.io
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Restaurant Management Backend is running on: http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for Real-time KDS & Table synchronization`);
});
