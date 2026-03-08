import { Router } from 'express';
import { searchTransport, getIATACode } from '../controllers/transport.controller';

const router = Router();

/**
 * POST /api/transport/search
 * Body: { source, destination, date (yyyy-MM-dd), passengers }
 * Returns ranked bus / train / flight options with real API data
 */
router.post('/search', searchTransport);

/**
 * GET /api/transport/iata?city=Mumbai
 * Utility: resolve city name → IATA airport code
 */
router.get('/iata', getIATACode);

export default router;
