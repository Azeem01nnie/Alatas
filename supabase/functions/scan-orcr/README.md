# scan-orcr (optional / unused by desk)

The fleet desk OR/CR scanner now uses **local Tesseract.js** only.
This Edge Function is kept for optional experiments but is not required.

To disable cloud OCR secrets later:

```bash
npx supabase secrets unset GEMINI_API_KEY GOOGLE_SERVICE_ACCOUNT_JSON DOCUMENT_AI_PROCESSOR DOCUMENT_AI_LOCATION GOOGLE_CLOUD_VISION_API_KEY OPENAI_API_KEY
```
