// src/services/Api.js
// VITE_API_BASE lets a local build talk to a local backend; production uses the live API.
const API_BASE = import.meta.env.VITE_API_BASE || 'https://electropheuria.com/api';

/** Absolute URL for a path the API returns (e.g. "/api/banners/3/image?v=…"). */
export const apiAssetUrl = (path) => {
  if (!path || /^(https?:|data:)/.test(path)) return path || null;
  return new URL(API_BASE, window.location.origin).origin + path;
};

const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const token = sessionStorage.getItem('dashboard_token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        sessionStorage.removeItem('dashboard_token');
        window.location.href = '/dashboard/login';
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `API error: ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    // Handle 204 No Content (e.g. DELETE responses with no body)
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const api = {
  getProducts: async () => {
    const res = await apiCall('/products');
    return Array.isArray(res) ? res : (res.data ?? []);
  },
  getProduct: (id) => apiCall(`/products/${id}`),
  getDeals: async () => {
    const res = await apiCall('/deals');
    return Array.isArray(res) ? res : (res.data ?? []);
  },
  getDeal: (id) => apiCall(`/deals/${id}`),
  getOrders: async () => {
    const res = await apiCall('/orders');
    return Array.isArray(res) ? res : (res.data ?? []);
  },
  getSales: () => apiCall('/orders/history'),
  getStats: () => apiCall('/stats'),  // Keep if this endpoint exists
  getMonthlySales: (year) => apiCall(`/monthly-sales?year=${year}`),
  
  // Products CRUD
  addProduct: (productData) => apiCall('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),

  updateProduct: (productData) => apiCall(`/products/${productData.id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  }),
  
  deleteProduct: (id) => apiCall(`/products/${id}`, { method: 'DELETE' }),
  
  // Deals CRUD
  addDeal: (dealData) => apiCall('/deals', {
    method: 'POST',
    body: JSON.stringify(dealData),
  }),

  updateDeal: (dealData) => apiCall(`/deals/${dealData.id}`, {
    method: 'PUT',
    body: JSON.stringify(dealData),
  }),
  
  deleteDeal: (id) => apiCall(`/deals/${id}`, { method: 'DELETE' }),

  // Cable variant image: uploaded as a real file (multipart), stored by Laravel on the public disk.
  // Resolves to { path, url }; `path` is what gets saved with the product variant.
  uploadVariantImage: async (file, filename = 'variant.jpg') => {
    const token = sessionStorage.getItem('dashboard_token');
    const body = new FormData();
    body.append('image', file, file.name || filename);
    const response = await fetch(`${API_BASE}/product-variants/images`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || `Upload failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  // Homepage banners
  getBanners: async () => {
    const res = await apiCall('/banners');
    return Array.isArray(res) ? res : [];
  },
  getAdminBanners: async () => {
    const res = await apiCall('/admin/banners');
    return Array.isArray(res) ? res : [];
  },
  getAdminBanner: (id) => apiCall(`/admin/banners/${id}`),
  addBanner: (data) => apiCall('/banners', { method: 'POST', body: JSON.stringify(data) }),
  updateBanner: (id, data) => apiCall(`/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setBannerActive: (id, active) => apiCall(`/banners/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  reorderBanners: (ids) => apiCall('/banners/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  deleteBanner: (id) => apiCall(`/banners/${id}`, { method: 'DELETE' }),

  // Finance tracker (admin only)
  getFinance: () => apiCall('/finance'),
  updateFinanceSettings: (data) => apiCall('/finance/settings', { method: 'PUT', body: JSON.stringify(data) }),
  addCashMovement: (data) => apiCall('/finance/movements', { method: 'POST', body: JSON.stringify(data) }),
  updateCashMovement: (id, data) => apiCall(`/finance/movements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCashMovement: (id) => apiCall(`/finance/movements/${id}`, { method: 'DELETE' }),
  getFinanceSpending: (from, to) => {
    const q = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
    return apiCall(`/finance/spending${q ? `?${q}` : ''}`);
  },
  addExpense: (data) => apiCall('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id, data) => apiCall(`/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id) => apiCall(`/finance/expenses/${id}`, { method: 'DELETE' }),
  updateFinanceItem: (type, id, data) => apiCall(`/finance/items/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Clients
  getClients: () => apiCall('/clients'),
  getClientOrders: (userId) => apiCall(`/clients/${userId}/orders`),

  // Orders
  createOrder: (orderData) => apiCall('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),

  updateOrderStatus: (id, status) => apiCall(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  // Auth
  login: (email, password) => apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  forgotPassword: (email) => apiCall('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  resetPassword: (data) => apiCall('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  logout: () => apiCall('/auth/logout', {
    method: 'POST',
  }),
};

export default api;
