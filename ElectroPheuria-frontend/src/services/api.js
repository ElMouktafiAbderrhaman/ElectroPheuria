// src/services/Api.js
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const api = {
  getProducts: () => apiCall('/products.php'),
  getOrders: () => apiCall('/orders.php'),
  getSales: () => apiCall('/sales.php'),
  getStats: () => apiCall('/stats.php'),
  getMonthlySales: (year) => apiCall(`/monthly-sales?year=${year}`),
  getDeals: () => apiCall('/deals.php'),
  
  addProduct: (productData) => apiCall('/add_product.php', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),

  addDeal: (dealData) => apiCall('/add_deal.php', {
    method: 'POST',
    body: JSON.stringify(dealData),
  }),
  
  deleteProduct: (id) => apiCall(`/delete_product.php?id=${id}`, { method: 'DELETE' }),
  
  deleteDeal: (id) => apiCall(`/delete_deal.php?id=${id}`, { method: 'DELETE' }),

  updateProduct: (productData) => apiCall('/update_product.php', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),

  updateDeal: (dealData) => apiCall('/update_deal.php', {
    method: 'POST',
    body: JSON.stringify(dealData),
  }),

  getClientOrders: (userId) => apiCall(`/client_orders.php?user_id=${userId}`),
  getClients: () => apiCall('/clients.php'),

  createOrder: (orderData) => apiCall('/orders.php', {
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
