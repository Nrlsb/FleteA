import { z } from 'zod';

export const updateDriverStatusSchema = z.object({
    is_available: z.boolean(),
    location: z.object({
        lat: z.number(),
        lon: z.number(),
    }).optional(),
});

export const updateDriverProfileSchema = z.object({
    full_name: z.string().min(2).optional(),
    vehicle_type: z.enum(['flete_chico', 'flete_mediano', 'mudancera']).optional(),
    max_cargo_weight: z.number().nullable().optional(),
    vehicle_dimensions: z.string().optional(),
});
