import supabase from '../lib/supabase.js';

export const createRating = async (req, res) => {
    const { trip_id, reviewee_id, rating, comment } = req.body;

    const { data, error } = await supabase
        .from('ratings')
        .insert([{
            trip_id,
            reviewer_id: req.user.id,
            reviewee_id,
            rating,
            comment
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });

    // Update trip flag
    const isClient = data[0].reviewer_id === req.user.id; // Correct check would be based on role
    // But since we know the reviewer_id, we can check the role from profiles or just use the logic from the dashboard
    // In UserDashboard, reviewer_id is user.id. In DriverDashboard, reviewer_id is user.id.
    // We should check the role of the reviewer.

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
    if (profile) {
        const column = profile.role === 'client' ? 'client_rated' : 'driver_rated';
        await supabase.from('trips').update({ [column]: true }).eq('id', trip_id);
    }

    res.json({ rating: data[0] });
};
