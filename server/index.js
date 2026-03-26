import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import pino from 'pino-http';
import rateLimit from 'express-rate-limit';

// Routes
import tripsRouter from './routes/trips.js';
import driversRouter from './routes/drivers.js';
import ratingsRouter from './routes/ratings.js';
import chatRouter from './routes/chat.js';

const app = express();
const port = process.env.PORT || 3000;

// Logging
const logger = pino({
  transport: {
    target: 'pino-pretty',
  },
});
app.use(logger);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Validate required env vars
if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  console.error('Supabase URL or Key is missing!');
}

app.use(cors({
  origin: [
    'https://flete-a.vercel.app',
    /\.vercel\.app$/,
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json());

app.use('/api/trips', tripsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/chat', chatRouter);

app.get('/', (req, res) => {
  res.send('Fletea API is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
