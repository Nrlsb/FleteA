const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Helper to get supabase client (already initialized in index.js, but need to pass it or re-init)
// For simplicity in this MVP, we'll re-init or pass it. Let's re-init for now as it's stateless.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Pricing configuration
const BASE_PRICE = 3000;
const PRICE_PER_KM = {
    flete_chico: 900,
    flete_mediano: 1500,
    mudancera: 2500
};

// Calculate Price Endpoint
router.post('/calculate-price', (req, res) => {
    const { distance_km, vehicle_type } = req.body;

    if (!distance_km || !vehicle_type) {
        return res.status(400).json({ error: 'Missing distance_km or vehicle_type' });
    }

    const rate = PRICE_PER_KM[vehicle_type];
    if (!rate) {
        return res.status(400).json({ error: 'Invalid vehicle_type' });
    }

    const price = BASE_PRICE + (distance_km * rate);
    res.json({ price: Math.round(price) }); // Round to nearest integer
});

// Create Trip Endpoint
router.post('/create', async (req, res) => {
    const { user_id, origin_address, destination_address, distance_km, vehicle_type, price } = req.body;

    // Basic validation
    if (!user_id || !origin_address || !destination_address || !distance_km || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
        .from('trips')
        .insert([
            {
                user_id,
                origin_address,
                destination_address,
                distance_km,
                price,
                status: 'pending',
                vehicle_type: vehicle_type
            }
        ])
        .select();

    if (error) {
        // If error is about missing column, I need to fix schema.
        console.error('Error creating trip:', error);
        return res.status(500).json({ error: error.message });
    }

    res.json({ trip: data[0] });
});

// Get Pending Trips (for Drivers)
router.get('/pending', async (req, res) => {
    // In a real app, filters by location and vehicle_type
    const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Accept Trip
router.post('/:id/accept', async (req, res) => {
    const { id } = req.params;
    const { driver_id } = req.body;

    if (!driver_id) {
        return res.status(400).json({ error: 'Missing driver_id' });
    }

    const { data, error } = await supabase
        .from('trips')
        .update({ driver_id, status: 'accepted' })
        .eq('id', id)
        .eq('status', 'pending') // Only accept if pending
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(400).json({ error: 'Trip not found or already accepted' });

    res.json({ trip: data[0] });
});

// Complete Trip
router.post('/:id/complete', async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('trips')
        .update({ status: 'completed' })
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
});

module.exports = router;
