# TODO: Fix 500 API Errors

## Plan Steps:
1. [x] Verify/create MySQL DB `electro_pheuria` with tables `orders` and `products` (user confirmed)
2. [x] Create `public/api/test.php` 
3. [x] Update `public/api/config.php` with error logging
4. [x] Update PHP queries to match DB schema (stats.php, orders.php, clients.php, client_orders.php updated)
5. [ ] Test frontend API calls (DashboardHome, TestConnection)

**Current: Reload dashboard to test! Check network tab. If sales.php fails (no sales_history table), create or ignore.**
