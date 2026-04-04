import express from 'express';
import requireAuth from '../middleware/auth.js';
import * as ratingController from '../controllers/ratingController.js';
import { createRatingSchema } from '../validators/ratingValidator.js';

const router = express.Router();

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: 'Datos inválidos', details: result.error.format() });
    }
    req.body = result.data;
    next();
};

router.post('/', requireAuth, validate(createRatingSchema), ratingController.createRating);
router.get('/:userId', requireAuth, ratingController.getUserRatings);
router.get('/trip/:tripId', requireAuth, ratingController.getTripRatings);

export default router;
