const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Update Driver Availability
router.post('/status', async (req, res) => {
    const { driver_id, is_available, location } = req.body; // location = { lat, lng }

    if (!driver_id || is_available === undefined) {
        return res.status(400).json({ error: 'Missing driver_id or is_available' });
    }

    // Update profile
    // In a real app, we might have a separate 'driver_locations' table for real-time tracking
    // For MVP, updating metadata in profiles or a separate table is fine.
    // Profiles table has 'is_available'.
    const updates = { is_available };

    // If we want to store location, we need a column or a separate table. 
    // Schema has origin/dest for trips, but not current location for drivers.
    // Let's assume we just toggle availability for now.

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', driver_id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ driver: data[0] });
});

module.exports = router;
