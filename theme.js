/* ===== VirtualShelf Theme System ===== */
(function(){
  const STORAGE_KEY = 'vs_theme';

  function getTheme(){
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if(icon){
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  window.toggleTheme = function(){
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  // Apply immediately on load
  applyTheme(getTheme());
})();
