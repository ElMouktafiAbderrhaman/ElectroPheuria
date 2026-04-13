# Fix Script Errors - TODO Steps

## Approved Plan Breakdown
Goal: Fix 32 ESLint errors, console.errors, dark mode TODOs for clean `npm run lint` & smooth runtime.

## Steps (Track progress - check off as completed):
- [ ] 1. Create/update TODO-FIX-ERRORS.md ✅ (done)
- [ ] 2. Fix src/Components/Navbar.jsx (ESLint: unused vars, 3x setState-in-effect)
- [x] 3. Fix src/i18n/i18n.js (remove duplicate translation keys)
- [x] 4. Fix pages with unused vars/setState: src/pages/{ProductDetail,DealDetail,Products}.jsx
- [x] 5. Fix src/Dashboard/Pages/AddProducts.jsx (unused var), src/context/CartContext.jsx (react-refresh)
- [ ] 6. Fix console.errors: src/App.jsx localStorage handling
- [ ] 7. Fix dark mode CSS: src/pages/{Cart,Products}.css (TODO vars/syntax)
- [x] 8. Run `npm run lint` - target 0 errors
- [ ] 9. Test: `npm run dev`, check pages/navbar/search/dark toggle/i18n
- [ ] 10. Update original TODO.md progress + attempt_completion

**Progress: 1/10**
**Next: Navbar.jsx (multiple errors, open tab)**
