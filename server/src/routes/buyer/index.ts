import { Router } from 'express';
import profileRoutes from './profile.routes';
import requestsRoutes from './requests.routes';
import marketRoutes from './market.routes';
import auctionsRoutes from './auctions.routes';
import purchasesRoutes from './purchases.routes';
import subscriptionsRoutes from './subscriptions.routes';

const router = Router();

router.use(profileRoutes);
router.use(requestsRoutes);
router.use(marketRoutes);
router.use(auctionsRoutes);
router.use(purchasesRoutes);
router.use(subscriptionsRoutes);

export default router;