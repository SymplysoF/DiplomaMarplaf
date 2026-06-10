import { Router } from 'express';
import customersRequests from './customerRequests';

const router = Router();

router.use(customersRequests);

export default router;
