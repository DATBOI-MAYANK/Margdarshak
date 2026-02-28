import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * GET /api/translate
 * Proxy for MyMemory Translation API to avoid CORS issues
 * Query params: q (text to translate), langpair (e.g., "zh-CN|en")
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, langpair } = req.query;

    if (!q || !langpair) {
      return res.status(400).json({
        error: 'Missing required parameters: q and langpair'
      });
    }

    console.log(`Translation request: "${q}" [${langpair}]`);

    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: q as string,
        langpair: langpair as string
      },
      timeout: 10000
    });

    console.log(`Translation result: "${response.data?.responseData?.translatedText}"`);

    res.json(response.data);
  } catch (error: any) {
    console.error('Translation proxy error:', error.message);
    res.status(500).json({
      error: 'Translation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/translate/batch
 * Batch translation for multiple texts
 * Body: { texts: string[], langpair: string }
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { texts, langpair } = req.body;

    if (!texts || !Array.isArray(texts) || !langpair) {
      return res.status(400).json({
        error: 'Missing required parameters: texts (array) and langpair'
      });
    }

    console.log(`Batch translation request: ${texts.length} texts [${langpair}]`);

    const translations = await Promise.all(
      texts.map(async (text: string) => {
        try {
          const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: { q: text, langpair },
            timeout: 10000
          });
          return {
            original: text,
            translated: response.data?.responseData?.translatedText || text
          };
        } catch (err) {
          console.error(`Failed to translate "${text}":`, err);
          return { original: text, translated: text };
        }
      })
    );

    console.log(`Batch translation complete: ${translations.length} results`);

    res.json({ translations });
  } catch (error: any) {
    console.error('Batch translation error:', error.message);
    res.status(500).json({
      error: 'Batch translation failed',
      message: error.message
    });
  }
});

export default router;
