# scan-orcr — LTO OR/CR scan (Google Document AI primary)

Deploy:

```bash
npx supabase functions deploy scan-orcr
```

## Required: Document AI (replaces Cloud Vision)

1. Enable **Document AI API** + billing on your GCP project  
2. Create a **Form Parser** processor  
3. Create a service account with role **Document AI API User** → download JSON key  
4. Set secrets:

```bash
npx supabase secrets set DOCUMENT_AI_PROCESSOR="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID"
npx supabase secrets set DOCUMENT_AI_LOCATION=us
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat path/to/service-account.json)"
npx supabase functions deploy scan-orcr
```

`DOCUMENT_AI_LOCATION` must match the processor region (`us`, `eu`, etc.).

## Optional: Gemini

Used when the desk selects **Gemini**, or if Document AI fails:

```bash
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY
```

## Desk engines

1. **Document AI** (default) — Form Parser via service account  
2. **Gemini** — multimodal field extract  
3. **Tesseract** — local OCR in the browser  

Cloud Vision is no longer used.
