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
// Tolerant body parser: try to coerce simple malformed JSON-like payloads
// (e.g. {name:Aditya,email:...}) into valid JSON to avoid 400 parse errors
import getRawBody from 'raw-body';

app.use(async (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return next();
  }

  try {
    // Read raw body without calling req.setEncoding or attaching listeners
    const raw = await getRawBody(req, { encoding: 'utf8' });
    if (!raw) return next();

    try {
      const parsed = JSON.parse(raw);
      req.body = parsed;
      (req as any).rawBody = raw;
      // mark body as consumed so body-parser doesn't try to read again
      (req as any)._body = true;
      return next();
    } catch (err) {
      // Attempt simple coercion for malformed JSON-like strings
      try {
        let s = raw.trim();
        if (s.startsWith('{') && s.endsWith('}')) {
          s = s.replace(/([\{,\s])(\w[\w\-\.]*)\s*:/g, '$1"$2":');
          s = s.replace(/:\s*([^\",\}\[\]\s][^,\}]*)/g, ':"$1"');
          s = s.replace(/,\s*}/g, '}');
          const coerced = JSON.parse(s);
          req.body = coerced;
          (req as any).rawBody = raw;
          (req as any)._body = true;
          return next();
        }
      } catch (e) {
        // fallthrough to next and let express.json handle errors
      }

      (req as any).rawBody = raw;
      return next();
    }
  } catch (readErr: any) {
    // raw-body will throw if stream encoding was set earlier; log and continue to let express.json handle
    console.warn('raw-body read failed in tolerant parser:', readErr?.message || readErr);
    return next();
  }
});
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
