import supabase from '../lib/supabase.js';

export const calculatePrice = (req, res) => {
    const { distance_km, vehicle_type, services = [] } = req.body;

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

    const rate = PRICE_PER_KM[vehicle_type];
    let price = BASE_PRICE + (distance_km * rate);

    services.forEach(service => {
        if (SERVICE_PRICES[service]) price += SERVICE_PRICES[service];
    });

    res.json({ price: Math.round(price) });
};

export const createTrip = async (req, res) => {
    const {
        origin_address, destination_address, distance_km, vehicle_type,
        price, category, photos, services, driver_id
    } = req.body;

    const status = driver_id ? 'driver_pending' : 'pending';

    const { data, error } = await supabase
        .from('trips')
        .insert([{
            user_id: req.user.id,
            origin_address,
            destination_address,
            distance_km,
            price,
            status,
            vehicle_type,
            category,
            driver_id: driver_id || null,
            photos: photos || [],
            services: services || []
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
};

export const getPendingTrips = async (req, res) => {
    const { data: profile } = await supabase
        .from('profiles')
        .select('vehicle_type')
        .eq('id', req.user.id)
        .maybeSingle();

    let query = supabase
        .from('trips')
        .select('*, profiles!trips_user_id_fkey(full_name)')
        .eq('status', 'pending')
        .or(`driver_id.is.null,driver_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false });

    if (profile?.vehicle_type) {
        query = query.eq('vehicle_type', profile.vehicle_type);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
};

export const acceptTrip = async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('trips')
        .update({ driver_id: req.user.id, status: 'driver_pending' })
        .eq('id', id)
        .eq('status', 'pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(400).json({ error: 'Trip not found or already accepted' });

    res.json({ trip: data[0] });
};

export const confirmDriver = async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('trips')
        .update({ status: 'accepted' })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .eq('status', 'driver_pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(400).json({ error: 'Trip not found' });

    res.json({ trip: data[0] });
};

export const rejectDriver = async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('trips')
        .update({ status: 'pending', driver_id: null })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .eq('status', 'driver_pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
};

export const updateTripStatus = async (req, res) => {
    const { id } = req.params;
    const { status, photo_url } = req.body;

    const VALID_TRANSITIONS = {
        accepted: ['loading'],
        loading: ['in_progress'],
        in_progress: ['completed'],
    };

    const { data: trip, error: fetchError } = await supabase
        .from('trips')
        .select('status, driver_id')
        .eq('id', id)
        .single();

    if (fetchError || !trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.driver_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const allowed = VALID_TRANSITIONS[trip.status] || [];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Transición inválida' });

    const updates = { status };
    if (status === 'loading' && photo_url) updates.proof_loading_photo = photo_url;
    if (status === 'in_progress') updates.start_time = new Date().toISOString();
    if (status === 'completed') {
        updates.proof_delivery_photo = photo_url || null;
        updates.end_time = new Date().toISOString();
    }

    const { data, error } = await supabase.from('trips').update(updates).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
};

export const cancelTrip = async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('trips')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .eq('status', 'pending')
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trip: data[0] });
};

export const updateLocation = async (req, res) => {
    const { id } = req.params;
    const { lat, lon } = req.body;

    const { data, error } = await supabase
        .from('trips')
        .update({ driver_lat: lat, driver_lon: lon })
        .eq('id', id)
        .eq('driver_id', req.user.id)
        .in('status', ['accepted', 'loading', 'in_progress'])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
};
