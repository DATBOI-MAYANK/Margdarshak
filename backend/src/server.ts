import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import authRoutes from './routes/auth.routes';
import itineraryRoutes from './routes/itinerary.routes';
import translationRoutes from './routes/translation.routes';
import weatherRoutes from './routes/weather.routes';
import uploadRoutes from './routes/upload.routes';
import collaboratorRoutes from './routes/collaborator.routes';
import messageRoutes from './routes/message.routes';
import chatRoutes from './routes/chat.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import pool from './config/database';
import { socketService } from './services/socket.service';

dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io
socketService.initialize(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Smart Travel Itinerary Planner API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/translate', translationRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/collaborators', collaboratorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/chat', chatRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);


// PostgreSQL Database connection test
const testDatabaseConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✓ PostgreSQL database connected successfully');
  } catch (error) {
    console.error('✗ PostgreSQL database connection failed:', error);
    console.error('Please ensure PostgreSQL is running and credentials are correct in .env file');
  }
};

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  testDatabaseConnection();
});

export default app;
