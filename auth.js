/* ===== VirtualShelf Auth System ===== */
// Roles: admin, customer, warehouse, store
// Each role can only access its own app

const VS_AUTH = {
  // ---- User Database (localStorage-backed) ----
  users: [
    { username: 'admin',    password: 'admin123',    role: 'admin',     name: 'Emad Hamdy',    avatar: 'EH' },
    { username: 'customer', password: 'cust123',     role: 'customer',  name: 'Ahmed K.',      avatar: 'AK' },
    { username: 'warehouse',password: 'wh123',       role: 'warehouse', name: 'Ahmed Khalil',  avatar: 'AK' },
    { username: 'store',    password: 'store123',    role: 'store',     name: 'Sara M.',       avatar: 'SM' },
  ],

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

  login(username, password) {
    const user = this.users.find(u => u.username === username && u.password === password);
    if (!user) return null;
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
