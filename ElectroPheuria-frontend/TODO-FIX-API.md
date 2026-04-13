# TODO: Fix API 404/DB Errors

## Current State
- Laravel server on 8000 listening
- MySQL likely running (need confirm DBs)
- Vite proxy /api -> 8000 causes 404 (no Laravel routes for /api/clients.php etc)
- Local public/api/*.php use PDO to 'electro_pheuria' DB

## Plan Steps

- [x] 2. Disable vite proxy to use local public/api PDO
- [ ] 3. Update public/api/config.php DB name to 'electropheuria_db'
- [ ] 4. Create tables in DB (products, clients, orders...) 
- [ ] 5. Complete missing public/api files if needed (e.g., implement clients.php logic)
- [ ] 6. Test frontend API calls
- [ ] 7. Re-enable proxy + add Laravel routes if needed later

## Priority
Start with MySQL check + local API.
