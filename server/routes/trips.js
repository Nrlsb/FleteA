const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const requireAuth = require('../middleware/auth');

// Pricing configuration
const BASE_PRICE = 3000;
const PRICE_PER_KM = {
    flete_chico: 900,
    flete_mediano: 1500,
    mudancera: 2500
};

const SERVICE_PRICES = {
    helper: 2000,
    packing: 1500
};

// Valid status transitions
const VALID_TRANSITIONS = {
    accepted: ['loading'],
    loading: ['in_progress'],
    in_progress: ['completed'],
};

// Calculate Price Endpoint
router.post('/calculate-price', requireAuth, (req, res) => {
    const { distance_km, vehicle_type, services = [] } = req.body;

    if (!distance_km || !vehicle_type) {
        return res.status(400).json({ error: 'Missing distance_km or vehicle_type' });
    }

    const rate = PRICE_PER_KM[vehicle_type];
    if (!rate) {
        return res.status(400).json({ error: 'Invalid vehicle_type' });
    }

    let price = BASE_PRICE + (distance_km * rate);

    if (Array.isArray(services)) {
        services.forEach(service => {
            if (SERVICE_PRICES[service]) price += SERVICE_PRICES[service];
        });
    }

    res.json({ price: Math.round(price) });
});

// Create Trip Endpoint
router.post('/create', requireAuth, async (req, res) => {
    const {
        origin_address,
        destination_address,
        distance_km,
        vehicle_type,
        price,
        category,
        photos,
        services
    } = req.body;

    if (!origin_address || !destination_address || !distance_km || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
        .from('trips')
        .insert([{
            user_id: req.user.id,  // Always from the authenticated token
            origin_address,
            destination_address,
            distance_km,
            price,
            status: 'pending',
            vehicle_type,
            category,
            photos: photos || [],
            services: services || []
        }])
        .select();

    if (error) {
        console.error('Error creating trip:', error);
        return res.status(500).json({ error: error.message });
    }

    res.json({ trip: data[0] });
});

// Get Pending Trips (for Drivers) - filtered by vehicle type
router.get('/pending', requireAuth, async (req, res) => {
    // Fetch the driver's vehicle_type from their profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('vehicle_type')
        .eq('id', req.user.id)
        .maybeSingle();

    let query = supabase
        .from('trips')
        .select('*, profiles:user_id(full_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (profile?.vehicle_type) {
        query = query.eq('vehicle_type', profile.vehicle_type);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Accept Trip
router.post('/:id/accept', requireAuth, async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('trips')
        .update({ driver_id: req.user.id, status: 'accepted' })
        .eq('id', id)
        .eq('status', 'pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(400).json({ error: 'Trip not found or already accepted' });

    res.json({ trip: data[0] });
});

// Update Trip Status (with progression validation)
router.post('/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status, photo_url } = req.body;

    // Fetch current trip to validate
    const { data: trip, error: fetchError } = await supabase
        .from('trips')
        .select('status, driver_id')
        .eq('id', id)
        .single();

    if (fetchError || !trip) return res.status(404).json({ error: 'Trip not found' });

    // Only the assigned driver can update status
    if (trip.driver_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this trip' });
    }

    // Validate status transition
    const allowed = VALID_TRANSITIONS[trip.status] || [];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Invalid transition: ${trip.status} → ${status}` });
    }

    const updates = { status };

    if (status === 'loading' && photo_url) {
        updates.proof_loading_photo = photo_url;
    }
    if (status === 'in_progress') {
        updates.start_time = new Date().toISOString();
    }
    if (status === 'completed') {
        updates.proof_delivery_photo = photo_url || null;
        updates.end_time = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
});

// Cancel a pending trip (only owner)
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('trips')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .eq('status', 'pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) {
        return res.status(400).json({ error: 'Trip not found or cannot be cancelled' });
    }

    res.json({ trip: data[0] });
});

// Update Driver Location during active trip
router.post('/:id/location', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { lat, lon } = req.body;

    if (lat === undefined || lon === undefined) {
        return res.status(400).json({ error: 'Missing lat or lon' });
    }

    const { data, error } = await supabase
        .from('trips')
        .update({ driver_lat: lat, driver_lon: lon })
        .eq('id', id)
        .eq('driver_id', req.user.id)
        .in('status', ['accepted', 'loading', 'in_progress'])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(400).json({ error: 'Trip not found or not active' });
    res.json({ ok: true });
});

module.exports = router;
