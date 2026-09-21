// LinkVault PWA - Mobile Link Management App
// Supabase Config
const SUPABASE_URL = localStorage.getItem('lv_supabase_url') || '';
const SUPABASE_KEY = localStorage.getItem('lv_supabase_key') || '';

// State
let links = [];
let categories = [];
let currentFilter = 'all';
let currentCategory = 'all';
let searchQuery = '';
let editingLinkId = null;
let selectedLinkId = null;

// Supabase Client
async function supabaseQuery(table, method = 'GET', body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, opts);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  const theme = localStorage.getItem('lv_theme');
  if (theme === 'dark') document.body.classList.add('dark');

  const password = localStorage.getItem('lv_password');
  if (password) {
    showLockScreen();
  } else {
    showApp();
  }
}

function showLockScreen() {
  document.getElementById('lockScreen').classList.add('active');
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('lockScreen').classList.remove('active');
  document.getElementById('app').style.display = '';
  loadAll();
}

function loadAll() {
  loadCategories();
  loadLinks();
  loadStats();
}

function loadData(type) {
  const data = localStorage.getItem('lv_' + type);
  return data ? JSON.parse(data) : null;
}

function saveData(type, data) {
  localStorage.setItem('lv_' + type, JSON.stringify(data));
}

async function saveToSupabase(table, data) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await supabaseQuery(table, 'POST', data);
    } catch (e) {
      console.error('Supabase save error:', e);
    }
  }
}

async function deleteFromSupabase(table, id) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await supabaseQuery(`${table}?id=eq.${id}`, 'DELETE');
    } catch (e) {
      console.error('Supabase delete error:', e);
    }
  }
}

async function loadLinks() {
  // Try Supabase first
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      links = await supabaseQuery('links?select=*&order=created_at.desc');
      if (!links) links = [];
    } catch (e) {
      console.error('Supabase load error:', e);
      links = loadData('links') || [];
    }
  } else {
    links = loadData('links') || [];
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    links = links.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      (l.description && l.description.toLowerCase().includes(q))
    );
  }

  if (currentCategory !== 'all') {
    links = links.filter(l => l.category === currentCategory);
  }

  if (currentFilter === 'favorites') {
    links = links.filter(l => l.favorite);
  } else if (currentFilter === 'recent') {
    links = links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
  } else if (currentFilter === 'frequent') {
    links = links.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));
  } else if (currentFilter === 'broken') {
    links = links.filter(l => l.broken);
  }

  renderLinks();
}

function loadCategories() {
  categories = loadData('categories');
  if (!categories || categories.length === 0) {
    categories = [
      { id: 'dev', name: 'Development', icon: '💻', color: '#6366f1' },
      { id: 'design', name: 'Design', icon: '🎨', color: '#ec4899' },
      { id: 'tools', name: 'Tools', icon: '🔧', color: '#f59e0b' },
      { id: 'news', name: 'News', icon: '📰', color: '#10b981' },
      { id: 'social', name: 'Social', icon: '🌐', color: '#3b82f6' },
      { id: 'learning', name: 'Learning', icon: '📚', color: '#8b5cf6' },
      { id: 'other', name: 'Other', icon: '📁', color: '#6b7280' }
    ];
    saveData('categories', categories);
  }
  renderCategories();
  updateCategorySelect();
}

function loadStats() {
  const allLinks = loadData('links') || [];
  document.getElementById('statTotal').textContent = allLinks.length;
  document.getElementById('statFav').textContent = allLinks.filter(l => l.favorite).length;
  document.getElementById('statBroken').textContent = allLinks.filter(l => l.broken).length;
}

function renderLinks() {
  const container = document.getElementById('linksList');
  if (links.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔗</div><h3>No links found</h3><p>Add your first link to get started!</p></div>';
    return;
  }
  container.innerHTML = links.map(link => createLinkHTML(link)).join('');
}

function createLinkHTML(link) {
  const domain = new URL(link.url).hostname.replace('www.', '');
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const cat = categories.find(c => c.id === link.category);
  const catLabel = cat ? `<span class="link-cat" style="background:${cat.color}20;color:${cat.color}">${cat.icon} ${cat.name}</span>` : '';

  return `
    <div class="link-item" data-id="${link.id}" onclick="openLink('${link.id}')">
      <div class="link-content">
        <img class="link-favicon" src="${favicon}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🔗</text></svg>'">
        <div class="link-info">
          <div class="link-title">${esc(link.title)}</div>
          <div class="link-domain">${esc(domain)}</div>
          ${catLabel}
        </div>
      </div>
      <div class="link-actions">
        <button class="link-action-btn fav-btn ${link.favorite ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite('${link.id}')">
          ${link.favorite ? '★' : '☆'}
        </button>
        <button class="link-action-btn" onclick="event.stopPropagation();showSwipeActions('${link.id}')">⋮</button>
      </div>
    </div>
  `;
}

function renderCategories() {
  const container = document.getElementById('categoryChips');
  let html = `<button class="cat-chip active" data-cat="all" onclick="filterCategory('all')">All</button>`;
  categories.forEach(cat => {
    html += `<button class="cat-chip" data-cat="${cat.id}" onclick="filterCategory('${cat.id}')">${cat.icon} ${cat.name}</button>`;
  });
  container.innerHTML = html;
}

function updateCategorySelect() {
  const select = document.getElementById('linkCategory');
  select.innerHTML = '<option value="">No category</option>';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
  });
}

function openLink(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;

  link.accessCount = (link.accessCount || 0) + 1;
  link.lastAccessed = new Date().toISOString();
  saveData('links', loadData('links').map(l => l.id === id ? link : l));
  window.open(link.url, '_blank');
}

function toggleFavorite(id) {
  const allLinks = loadData('links') || [];
  const link = allLinks.find(l => l.id === id);
  if (link) {
    link.favorite = !link.favorite;
    saveData('links', allLinks);
    saveToSupabase('links', link);
    loadAll();
  }
}

function deleteLink(id) {
  if (!confirm('Delete this link?')) return;
  const allLinks = loadData('links') || [];
  saveData('links', allLinks.filter(l => l.id !== id));
  deleteFromSupabase('links', id);
  hideSwipeActions();
  loadAll();
  showToast('Link deleted');
}

function openLinkModal(link = null) {
  editingLinkId = link ? link.id : null;
  document.getElementById('modalTitle').textContent = link ? 'Edit Link' : 'Add Link';
  document.getElementById('linkTitle').value = link ? link.title : '';
  document.getElementById('linkUrl').value = link ? link.url : '';
  document.getElementById('linkDescription').value = link ? (link.description || '') : '';
  document.getElementById('linkCategory').value = link ? (link.category || '') : '';
  document.getElementById('linkTags').value = link ? (link.tags || '').join(', ') : '';
  document.getElementById('linkModal').classList.add('active');
}

function saveLink() {
  const title = document.getElementById('linkTitle').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  const description = document.getElementById('linkDescription').value.trim();
  const category = document.getElementById('linkCategory').value;
  const tags = document.getElementById('linkTags').value.split(',').map(t => t.trim()).filter(Boolean);

  if (!title || !url) {
    showToast('Title and URL are required');
    return;
  }

  try { new URL(url); } catch { showToast('Invalid URL'); return; }

  const allLinks = loadData('links') || [];

  if (editingLinkId) {
    const idx = allLinks.findIndex(l => l.id === editingLinkId);
    if (idx !== -1) {
      allLinks[idx] = { ...allLinks[idx], title, url, description, category, tags };
    }
  } else {
    allLinks.push({
      id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title, url, description, category, tags,
      favorite: false, broken: false,
      accessCount: 0, createdAt: new Date().toISOString(), lastAccessed: null
    });
  }

  saveData('links', allLinks);
  saveToSupabase('links', allLinks[allLinks.length - 1]);
  document.getElementById('linkModal').classList.remove('active');
  editingLinkId = null;
  loadAll();
  showToast(editingLinkId ? 'Link updated' : 'Link added');
}

function showSwipeActions(id) {
  selectedLinkId = id;
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('swiped');
}

function hideSwipeActions() {
  document.querySelectorAll('.link-item.swiped').forEach(el => el.classList.remove('swiped'));
  selectedLinkId = null;
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('lv_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

function exportLinks() {
  const data = {
    links: loadData('links') || [],
    categories: loadData('categories') || [],
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'linkvault-export-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Links exported');
}

function importLinks() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.links) {
          const existing = loadData('links') || [];
          const merged = [...existing, ...data.links.filter(l => !existing.find(e => e.url === l.url))];
          saveData('links', merged);
        }
        if (data.categories) {
          const existing = loadData('categories') || [];
          const merged = [...existing, ...data.categories.filter(c => !existing.find(e => e.id === c.id))];
          saveData('categories', merged);
        }
        loadAll();
        showToast('Links imported successfully');
      } catch { showToast('Invalid import file'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function setPassword() {
  const pass = document.getElementById('settingsPassword').value.trim();
  if (pass) {
    localStorage.setItem('lv_password', pass);
    showToast('Password set');
  } else {
    localStorage.removeItem('lv_password');
    showToast('Password removed');
  }
}

function saveSupabaseConfig() {
  const url = document.getElementById('supabaseUrl').value.trim();
  const key = document.getElementById('supabaseKey').value.trim();
  if (url && key) {
    localStorage.setItem('lv_supabase_url', url);
    localStorage.setItem('lv_supabase_key', key);
    showToast('Supabase configurado!');
  } else {
    localStorage.removeItem('lv_supabase_url');
    localStorage.removeItem('lv_supabase_key');
    showToast('Supabase removido');
  }
}

async function syncNow() {
  const url = localStorage.getItem('lv_supabase_url');
  const key = localStorage.getItem('lv_supabase_key');
  if (!url || !key) {
    showToast('Configure Supabase primeiro');
    return;
  }
  showToast('Sincronizando...');
  try {
    // Upload local links to cloud
    const localLinks = loadData('links') || [];
    if (localLinks.length > 0) {
      await supabaseQuery('links', 'POST', localLinks);
    }
    // Download cloud links
    const cloudLinks = await supabaseQuery('links?select=*&order=created_at.desc');
    if (cloudLinks && cloudLinks.length > 0) {
      saveData('links', cloudLinks);
    }
    loadAll();
    showToast('Sincronizado!');
  } catch (e) {
    console.error('Sync error:', e);
    showToast('Erro ao sincronizar');
  }
}

function handleUnlock() {
  const input = document.getElementById('lockPassword');
  const stored = localStorage.getItem('lv_password');
  if (input.value === stored) {
    showApp();
    input.value = '';
  } else {
    showToast('Wrong password');
    input.value = '';
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function setupEventListeners() {
  // Lock screen
  document.getElementById('unlockBtn').addEventListener('click', handleUnlock);
  document.getElementById('lockPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });

  // Menu
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.add('active');
    document.getElementById('menuOverlay').classList.add('active');
  });
  document.getElementById('closeMenu').addEventListener('click', closeMenu);
  document.getElementById('closeMenuBtn').addEventListener('click', closeMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMenu);

  // Menu items
  document.getElementById('menuAll').addEventListener('click', () => { closeMenu(); filterCategory('all'); });
  document.getElementById('menuFavorites').addEventListener('click', () => { closeMenu(); setFilter('favorites'); });
  document.getElementById('menuRecent').addEventListener('click', () => { closeMenu(); setFilter('recent'); });
  document.getElementById('menuFrequent').addEventListener('click', () => { closeMenu(); setFilter('frequent'); });
  document.getElementById('menuBroken').addEventListener('click', () => { closeMenu(); setFilter('broken'); });
  document.getElementById('menuSettings').addEventListener('click', () => {
    closeMenu();
    document.getElementById('settingsModal').classList.add('active');
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    loadLinks();
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Add link
  document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal());
  document.getElementById('addIcon').addEventListener('click', () => openLinkModal());

  // Modal
  document.getElementById('saveLinkBtn').addEventListener('click', saveLink);
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('linkModal').classList.remove('active');
    editingLinkId = null;
  });

  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Settings
  document.getElementById('exportBtn').addEventListener('click', exportLinks);
  document.getElementById('importBtn').addEventListener('click', importLinks);
  document.getElementById('savePassBtn').addEventListener('click', setPassword);
  document.getElementById('saveSupabaseBtn').addEventListener('click', saveSupabaseConfig);
  document.getElementById('syncNowBtn').addEventListener('click', syncNow);
  
  // Load saved Supabase config
  document.getElementById('supabaseUrl').value = localStorage.getItem('lv_supabase_url') || '';
  document.getElementById('supabaseKey').value = localStorage.getItem('lv_supabase_key') || '';
  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
  });

  // Swipe actions
  document.querySelectorAll('.swipe-fav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (selectedLinkId) toggleFavorite(selectedLinkId);
      hideSwipeActions();
    });
  });
  document.querySelectorAll('.swipe-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (selectedLinkId) {
        const link = links.find(l => l.id === selectedLinkId);
        if (link) openLinkModal(link);
      }
      hideSwipeActions();
    });
  });
  document.querySelectorAll('.swipe-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (selectedLinkId) deleteLink(selectedLinkId);
    });
  });

  // Touch support for swipe
  let touchStartX = 0;
  document.getElementById('linksList').addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  document.getElementById('linksList').addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff < -50) {
      const item = e.target.closest('.link-item');
      if (item) showSwipeActions(item.dataset.id);
    } else if (diff > 50) {
      hideSwipeActions();
    }
  });

  // Close modals on overlay click
  document.getElementById('linkModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('linkModal')) {
      document.getElementById('linkModal').classList.remove('active');
      editingLinkId = null;
    }
  });
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsModal')) {
      document.getElementById('settingsModal').classList.remove('active');
    }
  });
}

function closeMenu() {
  document.getElementById('sideMenu').classList.remove('active');
  document.getElementById('menuOverlay').classList.remove('active');
}

function filterCategory(catId) {
  currentCategory = catId;
  document.querySelectorAll('.cat-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat === catId);
  });
  loadLinks();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  loadLinks();
}
