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
    res.json({ rating: data[0] });
};
