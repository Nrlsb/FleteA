import supabase from '../lib/supabase.js';

export const getMessages = async (req, res) => {
    const { tripId } = req.params;

    // Verify user is part of the trip
    const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('user_id, driver_id')
        .eq('id', tripId)
        .single();

    if (tripError || !trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.user_id !== req.user.id && trip.driver_id !== req.user.id) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
};

export const sendMessage = async (req, res) => {
    const { trip_id, content } = req.body;

    // Verify authorization
    const { data: trip } = await supabase
        .from('trips')
        .select('user_id, driver_id')
        .eq('id', trip_id)
        .single();

    if (!trip || (trip.user_id !== req.user.id && trip.driver_id !== req.user.id)) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { data, error } = await supabase
        .from('messages')
        .insert([{
            trip_id,
            sender_id: req.user.id,
            content
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
};
