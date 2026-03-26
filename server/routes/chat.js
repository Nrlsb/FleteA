import express from 'express';
import requireAuth from '../middleware/auth.js';
import * as chatController from '../controllers/chatController.js';
import { sendMessageSchema } from '../validators/chatValidator.js';

const router = express.Router();

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: 'Datos inválidos', details: result.error.format() });
    }
    req.body = result.data;
    next();
};

router.get('/:tripId', requireAuth, chatController.getMessages);
router.post('/', requireAuth, validate(sendMessageSchema), chatController.sendMessage);

export default router;
