import express from 'express';
import requireAuth from '../middleware/auth.js';
import * as driverController from '../controllers/driverController.js';
import { updateDriverStatusSchema, updateDriverProfileSchema } from '../validators/driverValidator.js';

const router = express.Router();

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: 'Datos inválidos', details: result.error.format() });
    }
    req.body = result.data;
    next();
};

router.post('/status', requireAuth, validate(updateDriverStatusSchema), driverController.updateStatus);
router.put('/profile', requireAuth, validate(updateDriverProfileSchema), driverController.updateProfile);
router.get('/available', driverController.getAvailableDrivers);

export default router;
