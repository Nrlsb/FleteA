import { z } from 'zod';

export const calculatePriceSchema = z.object({
    distance_km: z.number().positive(),
    vehicle_type: z.enum(['flete_chico', 'flete_mediano', 'mudancera']),
    services: z.array(z.string()).optional(),
});

export const createTripSchema = z.object({
    origin_address: z.string().min(5),
    destination_address: z.string().min(5),
    distance_km: z.number().positive(),
    vehicle_type: z.enum(['flete_chico', 'flete_mediano', 'mudancera']),
    price: z.number().positive(),
    category: z.string(),
    photos: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
});

export const updateStatusSchema = z.object({
    status: z.enum(['loading', 'in_progress', 'completed']),
    photo_url: z.string().url().optional(),
});

export const updateLocationSchema = z.object({
    lat: z.number(),
    lon: z.number(),
});
