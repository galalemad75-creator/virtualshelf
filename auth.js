/* ===== VirtualShelf Auth System (v2 — Supabase) ===== */
// Roles: admin, customer, warehouse, store
// Each role can only access its own app

const VS_AUTH = {
  supa: null,
  ready: false,

  // ---- Supabase Connection ----
  async init() {
    try {
      // Load Supabase SDK if not loaded
      if (!window.supabase) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        document.head.appendChild(s);
        await new Promise(r => s.onload = r);
      }
      this.supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Test connection
      await this.supa.from('vs_users').select('id').limit(1);
      this.ready = true;
      console.log('[VS-Auth] ✅ Connected to Supabase');
    } catch (e) {
      console.warn('[VS-Auth] ⚠️ Offline mode:', e.message);
    }
  },

  // ---- Role → Allowed app path ----
  roleAccess: {
    admin:     ['admin/', 'store/', 'warehouse/', 'customer/'],
    customer:  ['customer/'],
    warehouse: ['warehouse/'],
    store:     ['store/'],
  },

  // ---- Role → Home page after login ----
  roleHome: {
    admin:     'admin/index.html',
    customer:  'customer/index.html',
    warehouse: 'warehouse/index.html',
    store:     'store/index.html',
  },

  // ---- Simple hash function (matches existing hashes) ----
  _hash(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36);
  },

  // ---- Session Management ----
  getCurrentUser() {
    const data = localStorage.getItem('vs_current_user');
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser(user) {
    localStorage.setItem('vs_current_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('vs_current_user');
    window.location.href = getAuthURL();
  },

  // ---- Login (Supabase → fallback localStorage) ----
  async login(username, password) {
    const hash = this._hash(password);

    // Try Supabase first
    if (this.ready) {
      try {
        const { data: user, error } = await this.supa
          .from('vs_users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !user) return null;

        // Check password
        if (user.password_hash !== hash) return null;

        // If password hash doesn't match, update it (password change)
        // This only runs if user changed password through UI later

        const session = {
          username: user.username,
          role: user.role,
          name: user.name,
          avatar: user.avatar,
          loginTime: Date.now()
        };
        this.setCurrentUser(session);
        return session;
      } catch (e) {
        console.warn('[VS-Auth] Supabase login failed, trying localStorage:', e.message);
      }
    }

    // Fallback: localStorage (legacy)
    const users = JSON.parse(localStorage.getItem('vs_users') || '[]');
    const passwords = JSON.parse(localStorage.getItem('vs_passwords') || '{}');
    const user = users.find(u => u.username === username);
    if (!user) return null;

    if (!passwords[username]) {
      passwords[username] = hash;
      localStorage.setItem('vs_passwords', JSON.stringify(passwords));
    }
    if (passwords[username] !== hash) return null;

    const session = {
      username: user.username,
      role: user.role,
      name: user.name,
      avatar: user.avatar,
      loginTime: Date.now()
    };
    this.setCurrentUser(session);
    return session;
  },

  // ---- Change Password ----
  async changePassword(username, oldPassword, newPassword) {
    const oldHash = this._hash(oldPassword);
    const newHash = this._hash(newPassword);

    if (this.ready) {
      try {
        // Verify old password
        const { data: user } = await this.supa
          .from('vs_users')
          .select('password_hash')
          .eq('username', username)
          .single();

        if (!user || user.password_hash !== oldHash) return false;

        // Update to new password
        await this.supa
          .from('vs_users')
          .update({ password_hash: newHash })
          .eq('username', username);

        return true;
      } catch (e) {
        console.error('[VS-Auth] Password change failed:', e.message);
        return false;
      }
    }

    // Fallback localStorage
    const passwords = JSON.parse(localStorage.getItem('vs_passwords') || '{}');
    if (passwords[username] !== oldHash) return false;
    passwords[username] = newHash;
    localStorage.setItem('vs_passwords', JSON.stringify(passwords));
    return true;
  },

  // ---- Register New User ----
  async register(username, password, role, name) {
    const hash = this._hash(password);
    const avatars = { admin: 'AD', customer: 'CU', warehouse: 'WH', store: 'ST' };

    if (this.ready) {
      try {
        const { data, error } = await this.supa
          .from('vs_users')
          .insert({
            username: username,
            password_hash: hash,
            role: role,
            name: name,
            avatar: avatars[role] || 'US'
          })
          .select()
          .single();

        if (error) return null;
        return data;
      } catch (e) {
        console.error('[VS-Auth] Registration failed:', e.message);
        return null;
      }
    }

    // Fallback localStorage
    const users = JSON.parse(localStorage.getItem('vs_users') || '[]');
    if (users.find(u => u.username === username)) return null;
    const newUser = { username, role, name, avatar: avatars[role] || 'US' };
    users.push(newUser);
    localStorage.setItem('vs_users', JSON.stringify(users));
    const passwords = JSON.parse(localStorage.getItem('vs_passwords') || '{}');
    passwords[username] = hash;
    localStorage.setItem('vs_passwords', JSON.stringify(passwords));
    return newUser;
  },

  // ---- Access Control ----
  canAccess(path) {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    const allowed = this.roleAccess[user.role] || [];
    return allowed.some(prefix => path.includes(prefix));
  },

  enforce() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = getAuthURL();
      return;
    }
    const currentPath = window.location.pathname;
    if (!this.canAccess(currentPath)) {
      const basePath = getBasePath();
      window.location.href = basePath + this.roleHome[user.role];
    }
  },

  // ---- Update UI Elements ----
  updateUI() {
    const user = this.getCurrentUser();
    if (!user) return;

    document.querySelectorAll('[data-vs-name]').forEach(el => el.textContent = user.name);
    document.querySelectorAll('[data-vs-avatar]').forEach(el => el.textContent = user.avatar);
    document.querySelectorAll('[data-vs-role]').forEach(el => {
      const roleNames = { admin: 'Store Owner', customer: 'Customer', warehouse: 'Warehouse Staff', store: 'Store Manager' };
      el.textContent = roleNames[user.role] || user.role;
    });
    document.querySelectorAll('[data-vs-logout]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    });
  }
};

// ---- Helpers ----
function getBasePath() {
  const path = window.location.pathname;
  if (path.includes('/admin/') || path.includes('/store/') ||
      path.includes('/warehouse/') || path.includes('/customer/')) {
    return path.substring(0, path.lastIndexOf('/') + 1).replace(/\/(admin|store|warehouse|customer)\/$/, '/');
  }
  return './';
}

function getAuthURL() {
  return getBasePath() + 'auth.html';
}
