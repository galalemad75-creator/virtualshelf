/* ===== VirtualShelf Auth System ===== */
// Roles: admin, customer, warehouse, store
// Each role can only access its own app

const VS_AUTH = {
  // ---- User Database (localStorage-backed) ----
  users: JSON.parse(localStorage.getItem('vs_users')) || [
    { username: 'admin',     role: 'admin',     name: 'Admin',      avatar: 'AD' },
    { username: 'customer',  role: 'customer',  name: 'Customer',   avatar: 'CU' },
    { username: 'warehouse', role: 'warehouse', name: 'Warehouse',  avatar: 'WH' },
    { username: 'store',     role: 'store',     name: 'Store',      avatar: 'ST' },
  ],
  // Passwords stored as hashes — never in plain text!
  _passwords: JSON.parse(localStorage.getItem('vs_passwords')) || {},

  // Role → Allowed app path
  roleAccess: {
    admin:     ['admin/', 'store/', 'warehouse/', 'customer/'],
    customer:  ['customer/'],
    warehouse: ['warehouse/'],
    store:     ['store/'],
  },

  // Role → Home page after login
  roleHome: {
    admin:     'admin/index.html',
    customer:  'customer/index.html',
    warehouse: 'warehouse/index.html',
    store:     'store/index.html',
  },

  // ---- Core Functions ----
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

  // Simple hash function for client-side password storage
  _hash(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36);
  },

  setPassword(username, password) {
    this._passwords[username] = this._hash(password);
    localStorage.setItem('vs_passwords', JSON.stringify(this._passwords));
  },

  login(username, password) {
    const user = this.users.find(u => u.username === username);
    if (!user) return null;
    // Check if password is set
    if (!this._passwords[username]) {
      // First time — set the password
      this.setPassword(username, password);
    }
    if (this._passwords[username] !== this._hash(password)) return null;
    const session = { username: user.username, role: user.role, name: user.name, avatar: user.avatar, loginTime: Date.now() };
    this.setCurrentUser(session);
    return session;
  },

  // Check if current user can access a given path
  canAccess(path) {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true; // admin = god mode
    const allowed = this.roleAccess[user.role] || [];
    return allowed.some(prefix => path.includes(prefix));
  },

  // Guard: call on every protected page
  enforce() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = getAuthURL();
      return;
    }
    // Check if user can access current page
    const currentPath = window.location.pathname;
    if (!this.canAccess(currentPath)) {
      // Redirect to their own app
      const basePath = getBasePath();
      window.location.href = basePath + this.roleHome[user.role];
    }
  },

  // Update all UI elements that show user info
  updateUI() {
    const user = this.getCurrentUser();
    if (!user) return;

    // Update name displays
    document.querySelectorAll('[data-vs-name]').forEach(el => el.textContent = user.name);
    // Update avatar displays
    document.querySelectorAll('[data-vs-avatar]').forEach(el => el.textContent = user.avatar);
    // Update role displays
    document.querySelectorAll('[data-vs-role]').forEach(el => {
      const roleNames = { admin: 'Store Owner', customer: 'Customer', warehouse: 'Warehouse Staff', store: 'Store Manager' };
      el.textContent = roleNames[user.role] || user.role;
    });
    // Add logout buttons
    document.querySelectorAll('[data-vs-logout]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    });
  }
};

// ---- Helper: find base path (works from any subfolder) ----
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
