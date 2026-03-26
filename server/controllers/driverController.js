import supabase from '../lib/supabase.js';

export const updateStatus = async (req, res) => {
    const { is_available, location } = req.body;
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
};

export const updateProfile = async (req, res) => {
    const updates = req.body;
    if (updates.full_name) updates.full_name = updates.full_name.trim();

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', req.user.id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data[0] });
};

export const getAvailableDrivers = async (req, res) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, vehicle_type, driver_lat, driver_lon')
        .eq('is_available', true)
        .eq('role', 'driver')
        .not('driver_lat', 'is', null)
        .not('driver_lon', 'is', null);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
};
