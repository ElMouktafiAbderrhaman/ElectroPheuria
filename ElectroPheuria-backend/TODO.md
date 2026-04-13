# Laravel + React API Test Setup - TODO

## Backend (ElectroPheuria-backend)
- [x] ~~Run `php artisan key:generate`~~ 
- [x] ~~Run `php artisan migrate`~~
- [x] ~~Start server: `php artisan serve`~~ (running on http://127.0.0.1:8000)
- [x] Verify routes/api.php has /test route ✅

## Frontend (ElectroPheuria-frontend)
- [ ] `cd ../ElectroPheuria-frontend && npm install axios`
- [x] ~~Update vite.config.js with /api proxy~~ to http://127.0.0.1:8000 ✅ (already perfect)
- [ ] Create src/components/TestConnection.jsx (Axios GET /api/test, display message)
- [ ] Update src/App.jsx to include TestConnection
- [ ] `npm run dev` → http://localhost:5173 displays message

## Final Verification
- Backend: http://127.0.0.1:8000/api/test → JSON
- Frontend: http://localhost:5173 → Fetches/displays message via proxy

**Start Backend first, then Frontend.**

