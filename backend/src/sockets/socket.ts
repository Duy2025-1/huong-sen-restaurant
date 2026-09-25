import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export function initSocketServer(server: HttpServer) {
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ];

  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+):5173$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error('Nguồn không được phép kết nối WebSocket.'));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Join specific room (e.g. table room or role room)
    socket.on('join_room', (room: string) => {
      if (typeof room === 'string' && room.length <= 50) {
        socket.join(room);
      }
    });

    socket.on('leave_room', (room: string) => {
      if (typeof room === 'string') {
        socket.leave(room);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

// Helper events for real-time notification
export const SocketEvents = {
  TABLE_STATUS_CHANGED: 'table_status_changed',
  ORDER_CREATED: 'order_created',
  ORDER_ITEMS_ADDED: 'order_items_added',
  KDS_ITEM_UPDATED: 'kds_item_updated',
  BILL_REQUESTED: 'bill_requested',
  PAYMENT_COMPLETED: 'payment_completed',
  RESERVATION_CREATED: 'reservation_created',
  DISH_AVAILABILITY_CHANGED: 'dish_availability_changed',
};

export function broadcastEvent(event: string, data: any, room?: string) {
  if (!io) return;
  if (room) {
    io.to(room).emit(event, data);
  } else {
    io.emit(event, data);
  }
}
