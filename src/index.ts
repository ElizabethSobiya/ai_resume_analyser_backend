// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import { connectDatabase, disconnectDatabase } from './config/database';
import resumeRoutes from './routes/resume.routes';
import jobRoutes from './routes/job.routes';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
} from './middleware/error.middleware';

const app = express();
const PORT = process.env.PORT || 3001;

// Parse allowed origins from environment
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use(requestLogger);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/jobs', jobRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start() {
  // Start listening FIRST so Render can detect the port
  // Bind to 0.0.0.0 for cloud deployment
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`
========================================
  Resume Analyzer API
========================================
  Environment: ${process.env.NODE_ENV || 'development'}
  Port:        ${PORT}
  Health:      http://localhost:${PORT}/health
  API Base:    http://localhost:${PORT}/api/v1
========================================
    `);
  });

  try {
    // Connect to database after port is bound
    await connectDatabase();
    console.log('Server ready to accept requests');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    // Don't exit - keep server running so Render doesn't restart in a loop
    // The health endpoint will still work for debugging
  }
}

start();
