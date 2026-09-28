import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

socket.on('connect', () => {
  console.log('⚡ Connected to RMS Real-time Server, socket ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from RMS Real-time Server');
});
