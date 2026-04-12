import { z } from 'zod';

export const calculatePriceSchema = z.object({
    distance_km: z.number().positive(),
    vehicle_type: z.enum(['flete_chico', 'flete_mediano', 'mudancera']),
    services: z.array(z.string()).optional(),
});

export const createTripSchema = z.object({
    origin_address: z.string().min(5),
    destination_address: z.string().min(5),
    origin_lat: z.coerce.number(),
    origin_lon: z.coerce.number(),
    destination_lat: z.coerce.number(),
    destination_lon: z.coerce.number(),
    distance_km: z.coerce.number().positive(),
    vehicle_type: z.enum(['flete_chico', 'flete_mediano', 'mudancera']),
    price: z.coerce.number().positive(),
    category: z.string(),
    photos: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    driver_id: z.string().uuid().optional(),
});

export const updateStatusSchema = z.object({
    status: z.enum(['loading', 'in_progress', 'completed']),
    photo_url: z.string().url().optional(),
});

export const updateLocationSchema = z.object({
    lat: z.coerce.number(),
    lon: z.coerce.number(),
});
