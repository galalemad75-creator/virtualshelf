/**
 * VirtualShelf — Shared Database Service
 * All 4 apps (admin, customer, warehouse, store) use this
 */
const VS_DB = {
  supa: null,
  ready: false,

  async init() {
    try {
      if (!window.supabase) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        document.head.appendChild(s);
        await new Promise(r => s.onload = r);
      }
      this.supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await this.supa.from('vs_products').select('id').limit(1);
      this.ready = true;
      console.log('[VS-DB] ✅ Connected');
    } catch (e) {
      console.warn('[VS-DB] Offline mode:', e.message);
    }
  },

  // ===== PRODUCTS =====
  async getProducts() {
    if (!this.ready) return JSON.parse(localStorage.getItem('vs_products') || '[]');
    const { data } = await this.supa.from('vs_products').select('*').eq('is_active', true).order('name');
    if (data) localStorage.setItem('vs_products', JSON.stringify(data));
    return data || [];
  },

  async updateStock(id, stock) {
    if (!this.ready) return;
    await this.supa.from('vs_products').update({ stock, updated_at: new Date().toISOString() }).eq('id', id);
  },

  async addProduct(product) {
    if (!this.ready) return;
    const { data } = await this.supa.from('vs_products').insert(product).select().single();
    return data;
  },

  async deleteProduct(id) {
    if (!this.ready) return;
    await this.supa.from('vs_products').update({ is_active: false }).eq('id', id);
  },

  // ===== ORDERS =====
  async getOrders(limit = 50) {
    if (!this.ready) return JSON.parse(localStorage.getItem('vs_orders') || '[]');
    const { data } = await this.supa.from('vs_orders').select('*').order('created_at', { ascending: false }).limit(limit);
    if (data) localStorage.setItem('vs_orders', JSON.stringify(data));
    return data || [];
  },

  async createOrder(order) {
    const orderNum = 'VS-' + String(Date.now()).slice(-4);
    const newOrder = { order_number: orderNum, ...order, status: 'pending' };
    if (!this.ready) {
      const orders = JSON.parse(localStorage.getItem('vs_orders') || '[]');
      orders.unshift(newOrder);
      localStorage.setItem('vs_orders', JSON.stringify(orders));
      return newOrder;
    }
    const { data } = await this.supa.from('vs_orders').insert(newOrder).select().single();
    // Reduce stock
    for (const item of order.items) {
      await this.supa.rpc('reduce_stock', { product_name: item.name, qty: item.qty }).catch(() => {});
    }
    return data;
  },

  async updateOrderStatus(id, status) {
    if (!this.ready) return;
    await this.supa.from('vs_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  },

  // ===== INVENTORY =====
  async logInventory(product_id, action, quantity, notes = '') {
    if (!this.ready) return;
    await this.supa.from('vs_inventory_log').insert({ product_id, action, quantity, notes });
  },

  async getInventoryLog(limit = 50) {
    if (!this.ready) return [];
    const { data } = await this.supa.from('vs_inventory_log').select('*, product:vs_products(name, emoji)').order('created_at', { ascending: false }).limit(limit);
    return data || [];
  },

  // ===== ALERTS =====
  async getAlerts() {
    if (!this.ready) return [];
    const { data } = await this.supa.from('vs_alerts').select('*, product:vs_products(name, emoji)').eq('is_read', false).order('created_at', { ascending: false });
    return data || [];
  },

  async dismissAlert(id) {
    if (!this.ready) return;
    await this.supa.from('vs_alerts').update({ is_read: true }).eq('id', id);
  },

  // ===== STATS =====
  async getStats() {
    if (!this.ready) return { totalProducts: 0, totalOrders: 0, revenue: 0, lowStock: 0 };
    const [products, orders] = await Promise.all([
      this.supa.from('vs_products').select('id, stock', { count: 'exact' }).eq('is_active', true),
      this.supa.from('vs_orders').select('id, total', { count: 'exact' }).neq('status', 'cancelled')
    ]);
    return {
      totalProducts: products.count || 0,
      totalOrders: orders.count || 0,
      revenue: (orders.data || []).reduce((s, o) => s + (o.total || 0), 0),
      lowStock: (products.data || []).filter(p => p.stock < 10).length
    };
  },

  // ===== REALTIME =====
  subscribe(table, callback) {
    if (!this.ready) return null;
    return this.supa.channel(`vs_${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: `vs_${table}` }, callback)
      .subscribe();
  }
};

window.VS_DB = VS_DB;
