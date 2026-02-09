const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create Rating
router.post('/', async (req, res) => {
    const { trip_id, reviewer_id, reviewee_id, rating, comment } = req.body;

    if (!trip_id || !reviewer_id || !reviewee_id || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
        .from('ratings')
        .insert([{
            trip_id,
            reviewer_id,
            reviewee_id,
            rating,
            comment
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ rating: data[0] });
});

module.exports = router;
