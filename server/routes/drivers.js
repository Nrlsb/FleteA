const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');

// Update Driver Availability
router.post('/status', requireAuth, async (req, res) => {
    const { is_available, location } = req.body;

    if (is_available === undefined) {
        return res.status(400).json({ error: 'Missing is_available' });
    }

    const updates = { is_available };

    if (is_available && location) {
        updates.driver_lat = location.lat;
        updates.driver_lon = location.lon;
    }

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', req.user.id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ driver: data[0] });
});

// Get Available Drivers with location (public)
router.get('/available', async (req, res) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, vehicle_type, driver_lat, driver_lon')
        .eq('is_available', true)
        .eq('role', 'driver')
        .not('driver_lat', 'is', null)
        .not('driver_lon', 'is', null);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
