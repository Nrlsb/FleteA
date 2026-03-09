const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Validate required env vars
if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  console.error('Supabase URL or Key is missing!');
}

// Routes
const tripsRouter = require('./routes/trips');
const driversRouter = require('./routes/drivers');
const ratingsRouter = require('./routes/ratings');

app.use('/api/trips', tripsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/ratings', ratingsRouter);

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
