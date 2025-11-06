# Surface Tag

### Test Suite

1. Embedding Types
   - Popup
   - Slide-over
   - Input-Trigger
   - Widget
   - Iframe (inline)
2. Tag Script size
   - 50 KiB uncompressed (local)
   - 9.8 KiB minified (CDN) — takes around 30ms to load
3. Identity API call from script
   - Takes less than 0.5 seconds on slow 4G connection
   - Not causing issues if blocked / failed (also for de-Anon)
4. Website De-Anon
   - Working as expected even if Identity API crashes
5. Post Message to Surface Form Iframe
   - Query Params
   - Prefilled email (input-trigger)
   - cookies
   - Website URL, Origin and Referrer
6. Check form loading speed on withsurface.com
