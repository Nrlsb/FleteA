import supabase from '../lib/supabase.js';

export const calculatePrice = async (req, res) => {
    const { distance_km, vehicle_type, services = [], driver_id } = req.body;

    // Current global defaults
    let basePrice = 3000;
    let pricePerKm = {
        flete_chico: 900,
        flete_mediano: 1500,
        mudancera: 2500
    };
    let servicePrices = {
        helper: 2000,
        packing: 1500
    };

    // If driver_id is provided, try to fetch their custom rates
    if (driver_id) {
        const { data: driverProfile } = await supabase
            .from('profiles')
            .select('base_price, price_per_km, helper_price, packing_price')
            .eq('id', driver_id)
            .maybeSingle();

        if (driverProfile) {
            if (driverProfile.base_price) basePrice = Number(driverProfile.base_price);
            if (driverProfile.price_per_km) {
                // If they set a generic price_per_km, use it for any vehicle type
                // Or we could have per-vehicle prices, but for now let's use it as a multiplier or override
                const customRate = Number(driverProfile.price_per_km);
                pricePerKm = {
                    flete_chico: customRate,
                    flete_mediano: customRate * 1.5, // Maintain ratios if only one rate set? 
                    mudancera: customRate * 2.5
                };
                // OR better: if they set price_per_km, it overrides the specific vehicle rate for THEIR vehicle
                // But the user might be quote-ing for a different vehicle type.
                // Let's assume price_per_km is their base rate and we scale it or they only set it for their vehicle.
                // Simplified: use it as the rate for the requested vehicle_type if they set it.
                pricePerKm[vehicle_type] = customRate;
            }
            if (driverProfile.helper_price) servicePrices.helper = Number(driverProfile.helper_price);
            if (driverProfile.packing_price) servicePrices.packing = Number(driverProfile.packing_price);
        }
    }

    const rate = pricePerKm[vehicle_type] || 1000;
    let price = basePrice + (distance_km * rate);

    services.forEach(service => {
        if (servicePrices[service]) price += servicePrices[service];
    });

    res.json({ price: Math.round(price) });
};

export const createTrip = async (req, res) => {
    const {
        origin_address, destination_address, origin_lat, origin_lon,
        destination_lat, destination_lon, distance_km, vehicle_type,
        price, category, photos, services, driver_id
    } = req.body;

    const status = driver_id ? 'driver_pending' : 'pending';

    const { data, error } = await supabase
        .from('trips')
        .insert([{
            user_id: req.user.id,
            origin_address,
            destination_address,
            origin_lat,
            origin_lon,
            destination_lat,
            destination_lon,
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

    if (error) {
        console.error('Supabase error creating trip:', error);
        return res.status(500).json({ error: error.message });
    }

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

    if (error) {
        console.error('Error in acceptTrip:', error.message);
        return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
        console.warn('acceptTrip: Trip not found or already accepted. ID:', id);
        return res.status(400).json({ error: 'Trip not found or already accepted' });
    }

    console.log(`Trip ${id} successfully accepted by driver ${req.user.id}`);
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
