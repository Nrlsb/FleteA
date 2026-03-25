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

// Update Driver Profile
router.put('/profile', requireAuth, async (req, res) => {
    const { full_name, vehicle_type, max_cargo_weight, vehicle_dimensions } = req.body;

    const VALID_VEHICLE_TYPES = ['flete_chico', 'flete_mediano', 'mudancera'];
    if (vehicle_type && !VALID_VEHICLE_TYPES.includes(vehicle_type)) {
        return res.status(400).json({ error: 'Tipo de vehículo inválido' });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (vehicle_type !== undefined) updates.vehicle_type = vehicle_type;
    if (max_cargo_weight !== undefined) updates.max_cargo_weight = max_cargo_weight || null;
    if (vehicle_dimensions !== undefined) updates.vehicle_dimensions = vehicle_dimensions;

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', req.user.id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data[0] });
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

    if (error) {
        console.error('Error fetching available drivers:', error.message, error.details);
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

module.exports = router;
