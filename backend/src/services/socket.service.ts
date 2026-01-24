import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
  userName?: string;
}

interface EditingUser {
  oduserId: number;
  email: string;
  name: string;
  socketId: string;
  activeField?: string;
}

interface FieldChange {
  field: string;
  value: any;
  userId: number;
  userName: string;
  timestamp: number;
}

interface ActivityChange {
  action: 'add' | 'update' | 'delete';
  index?: number;
  activity?: any;
  userId: number;
  userName: string;
  timestamp: number;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private editingUsers: Map<string, Map<string, EditingUser>> = new Map(); // roomId -> oduserId -> user
  private userSockets: Map<number, Set<string>> = new Map(); // userId -> Set of socket IDs

  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        
        // Get user name from database
        const result = await pool.query(
          'SELECT name FROM users WHERE id = $1',
          [decoded.id]
        );
        const user = result.rows[0];
        socket.userName = user?.name || decoded.email;
        
        next();
      } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 User connected: ${socket.userName} (${socket.userId})`);

      // Track user's sockets for direct messaging
      if (socket.userId) {
        if (!this.userSockets.has(socket.userId)) {
          this.userSockets.set(socket.userId, new Set());
        }
        this.userSockets.get(socket.userId)!.add(socket.id);
        
        // Join user's personal room for notifications
        socket.join(`user:${socket.userId}`);
      }

      // Join itinerary editing room
      socket.on('join-room', async (data: { itineraryId: number }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        
        // Verify user has access to this itinerary
        const hasAccess = await this.checkAccess(socket.userId!, data.itineraryId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this itinerary' });
          return;
        }

        socket.join(roomId);
        
        // Track editing users
        if (!this.editingUsers.has(roomId)) {
          this.editingUsers.set(roomId, new Map());
        }
        
        const roomUsers = this.editingUsers.get(roomId)!;
        roomUsers.set(socket.userId!.toString(), {
          oduserId: socket.userId!,
          email: socket.userEmail!,
          name: socket.userName!,
          socketId: socket.id
        });

        // Notify others that user joined
        socket.to(roomId).emit('user-joined', {
          userId: socket.userId,
          name: socket.userName,
          email: socket.userEmail
        });

        // Send current editors to the joining user
        const currentEditors = Array.from(roomUsers.values()).filter(u => u.oduserId !== socket.userId);
        socket.emit('current-editors', currentEditors);

        console.log(`👤 ${socket.userName} joined room ${roomId}`);
      });

      // Leave room
      socket.on('leave-room', (data: { itineraryId: number }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        this.handleLeaveRoom(socket, roomId);
      });

      // Field change - when user edits a field
      socket.on('field-change', (data: { itineraryId: number; field: string; value: any }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        
        const change: FieldChange = {
          field: data.field,
          value: data.value,
          userId: socket.userId!,
          userName: socket.userName!,
          timestamp: Date.now()
        };

        // Broadcast to others in the room
        socket.to(roomId).emit('field-update', change);
      });

      // Field focus - show who's editing what
      socket.on('field-focus', (data: { itineraryId: number; field: string }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        
        // Update user's active field
        const roomUsers = this.editingUsers.get(roomId);
        if (roomUsers) {
          const user = roomUsers.get(socket.userId!.toString());
          if (user) {
            user.activeField = data.field;
          }
        }

        socket.to(roomId).emit('field-locked', {
          field: data.field,
          userId: socket.userId,
          userName: socket.userName
        });
      });

      // Field blur - release lock
      socket.on('field-blur', (data: { itineraryId: number; field: string }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        
        // Clear user's active field
        const roomUsers = this.editingUsers.get(roomId);
        if (roomUsers) {
          const user = roomUsers.get(socket.userId!.toString());
          if (user) {
            user.activeField = undefined;
          }
        }

        socket.to(roomId).emit('field-unlocked', {
          field: data.field,
          userId: socket.userId
        });
      });

      // Activity changes
      socket.on('activity-change', (data: { itineraryId: number; action: 'add' | 'update' | 'delete'; index?: number; activity?: any }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        
        const change: ActivityChange = {
          action: data.action,
          index: data.index,
          activity: data.activity,
          userId: socket.userId!,
          userName: socket.userName!,
          timestamp: Date.now()
        };

        socket.to(roomId).emit('activity-update', change);
      });

      // Cursor position (optional - for showing cursor indicators)
      socket.on('cursor-move', (data: { itineraryId: number; field: string; position: number }) => {
        const roomId = `itinerary:${data.itineraryId}`;
        socket.to(roomId).emit('cursor-update', {
          userId: socket.userId,
          userName: socket.userName,
          field: data.field,
          position: data.position
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.userName} (${socket.userId})`);
        
        // Remove from user sockets tracking
        if (socket.userId && this.userSockets.has(socket.userId)) {
          this.userSockets.get(socket.userId)!.delete(socket.id);
          if (this.userSockets.get(socket.userId)!.size === 0) {
            this.userSockets.delete(socket.userId);
          }
        }
        
        // Remove from all rooms
        this.editingUsers.forEach((roomUsers, roomId) => {
          if (roomUsers.has(socket.userId!.toString())) {
            this.handleLeaveRoom(socket, roomId);
          }
        });
      });

      // Join chat room for collaboration
      socket.on('join-chat', async (data: { itineraryId: number }) => {
        const chatRoomId = `chat:${data.itineraryId}`;
        
        // Verify access
        const hasAccess = await this.checkAccess(socket.userId!, data.itineraryId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }

        socket.join(chatRoomId);
        console.log(`💬 ${socket.userName} joined chat room ${chatRoomId}`);
      });

      // Leave chat room
      socket.on('leave-chat', (data: { itineraryId: number }) => {
        const chatRoomId = `chat:${data.itineraryId}`;
        socket.leave(chatRoomId);
        console.log(`💬 ${socket.userName} left chat room ${chatRoomId}`);
      });

      // Typing indicator for chat
      socket.on('chat-typing', (data: { itineraryId: number; isTyping: boolean }) => {
        const chatRoomId = `chat:${data.itineraryId}`;
        socket.to(chatRoomId).emit('user-typing', {
          userId: socket.userId,
          userName: socket.userName,
          isTyping: data.isTyping
        });
      });
    });

    console.log('🔌 Socket.io initialized');
  }

  private handleLeaveRoom(socket: AuthenticatedSocket, roomId: string): void {
    socket.leave(roomId);
    
    const roomUsers = this.editingUsers.get(roomId);
    if (roomUsers) {
      roomUsers.delete(socket.userId!.toString());
      
      // Clean up empty rooms
      if (roomUsers.size === 0) {
        this.editingUsers.delete(roomId);
      }
    }

    // Notify others
    socket.to(roomId).emit('user-left', {
      userId: socket.userId,
      name: socket.userName
    });

    console.log(`👤 ${socket.userName} left room ${roomId}`);
  }

  private async checkAccess(userId: number, itineraryId: number): Promise<boolean> {
    try {
      // Check if user is owner
      const ownerResult = await pool.query(
        'SELECT id FROM itineraries WHERE id = $1 AND user_id = $2',
        [itineraryId, userId]
      );
      if (ownerResult.rows.length > 0) return true;

      // Check if user is collaborator
      const collabResult = await pool.query(
        'SELECT id FROM itinerary_collaborators WHERE itinerary_id = $1 AND user_id = $2',
        [itineraryId, userId]
      );
      if (collabResult.rows.length > 0) return true;

      return false;
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }

  // Get active editors for an itinerary
  getActiveEditors(itineraryId: number): EditingUser[] {
    const roomId = `itinerary:${itineraryId}`;
    const roomUsers = this.editingUsers.get(roomId);
    return roomUsers ? Array.from(roomUsers.values()) : [];
  }

  // Broadcast to all users in a room
  broadcastToRoom(itineraryId: number, event: string, data: any): void {
    if (this.io) {
      this.io.to(`itinerary:${itineraryId}`).emit(event, data);
    }
  }

  // Broadcast to all users in a chat room
  broadcastToItinerary(itineraryId: number, event: string, data: any): void {
    if (this.io) {
      this.io.to(`chat:${itineraryId}`).emit(event, data);
      this.io.to(`itinerary:${itineraryId}`).emit(event, data);
    }
  }

  // Send to specific user
  sendToUser(userId: number, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  // Check if user is online
  isUserOnline(userId: number): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }
}

export const socketService = new SocketService();
export default socketService;
