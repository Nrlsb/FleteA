import { z } from 'zod';

export const createRatingSchema = z.object({
    trip_id: z.string().uuid(),
    reviewee_id: z.string().uuid(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
});
