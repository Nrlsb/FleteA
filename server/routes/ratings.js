const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');

// Create Rating
router.post('/', requireAuth, async (req, res) => {
    const { trip_id, reviewee_id, rating, comment } = req.body;

    if (!trip_id || !reviewee_id || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
        .from('ratings')
        .insert([{
            trip_id,
            reviewer_id: req.user.id,  // Always from the authenticated token
            reviewee_id,
            rating,
            comment
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ rating: data[0] });
});

module.exports = router;
