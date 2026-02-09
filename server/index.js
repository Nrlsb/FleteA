const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing!');
}
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
