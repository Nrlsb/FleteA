import express from 'express';
import requireAuth from '../middleware/auth.js';
import * as tripController from '../controllers/tripController.js';
import {
    calculatePriceSchema,
    createTripSchema,
    updateStatusSchema,
    updateLocationSchema
} from '../validators/tripValidator.js';

const router = express.Router();

// Middleware de validación genérico para Zod
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: 'Datos inválidos',
            details: result.error.format()
        });
    }
    req.body = result.data;
    next();
};

router.post('/calculate-price', requireAuth, validate(calculatePriceSchema), tripController.calculatePrice);
router.post('/create', requireAuth, validate(createTripSchema), tripController.createTrip);
router.get('/pending', requireAuth, tripController.getPendingTrips);
router.post('/:id/accept', requireAuth, tripController.acceptTrip);
router.post('/:id/confirm_driver', requireAuth, tripController.confirmDriver);
router.post('/:id/reject_driver', requireAuth, tripController.rejectDriver);
router.post('/:id/status', requireAuth, validate(updateStatusSchema), tripController.updateTripStatus);
router.delete('/:id', requireAuth, tripController.cancelTrip);
router.post('/:id/location', requireAuth, validate(updateLocationSchema), tripController.updateLocation);

export default router;
