import { z } from 'zod';

export const sendMessageSchema = z.object({
    trip_id: z.string().uuid(),
    content: z.string().min(1).max(500),
});
