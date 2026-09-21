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
let currentPage = 1;
const linksPerPage = 50;

// Category icons mapping
const categoryIcons = {
  'Desenvolvimento': 'code',
  'Design': 'palette',
  'Entretenimento': 'play',
  'Social': 'users',
  'Notícias': 'news',
  'Aprendizado': 'book',
  'Compras': 'shopping',
  'Ferramentas': 'tool',
  'Referências': 'folder'
};

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
  const password = localStorage.getItem('lv_password');
  if (password) {
    showLockScreen();
  } else {
    showApp();
  }
}

function showLockScreen() {
  document.getElementById('lockScreen').classList.remove('hidden');
  document.getElementById('lockScreen').classList.add('active');
  document.getElementById('mainApp').classList.add('hidden');
}

function showApp() {
  document.getElementById('lockScreen').classList.remove('active');
  document.getElementById('lockScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
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
    links = links.filter(l => l.favorite || l.is_favorite);
  } else if (currentFilter === 'recent') {
    links = links.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)).slice(0, 20);
  } else if (currentFilter === 'frequent') {
    links = links.sort((a, b) => (b.accessCount || b.access_count || 0) - (a.accessCount || a.access_count || 0));
  } else if (currentFilter === 'broken') {
    links = links.filter(l => l.broken || l.status === 'broken');
  }

  renderLinks();
}

function loadCategories() {
  categories = loadData('categories');
  if (!categories || categories.length === 0) {
    categories = [
      { id: 'dev', name: 'Desenvolvimento', color: '#57c1ff' },
      { id: 'design', name: 'Design', color: '#ec4899' },
      { id: 'tools', name: 'Ferramentas', color: '#ffc533' },
      { id: 'news', name: 'Notícias', color: '#59d499' },
      { id: 'social', name: 'Social', color: '#3b82f6' },
      { id: 'learning', name: 'Aprendizado', color: '#8b5cf6' },
      { id: 'entertainment', name: 'Entretenimento', color: '#ff6161' },
      { id: 'shopping', name: 'Compras', color: '#f59e0b' },
      { id: 'other', name: 'Referências', color: '#6b7280' }
    ];
    saveData('categories', categories);
  }
  renderCategories();
  updateCategorySelect();
}

function loadStats() {
  const allLinks = loadData('links') || [];
  document.getElementById('statTotal').textContent = allLinks.length;
  document.getElementById('statFav').textContent = allLinks.filter(l => l.favorite || l.is_favorite).length;
  document.getElementById('statBroken').textContent = allLinks.filter(l => l.broken || l.status === 'broken').length;
  
  // Update menu badges
  const menuTotal = document.getElementById('menuTotal');
  const menuFav = document.getElementById('menuFav');
  const menuBroken = document.getElementById('menuBroken');
  if (menuTotal) menuTotal.textContent = allLinks.length;
  if (menuFav) menuFav.textContent = allLinks.filter(l => l.favorite || l.is_favorite).length;
  if (menuBroken) menuBroken.textContent = allLinks.filter(l => l.broken || l.status === 'broken').length;
}

function renderLinks() {
  const container = document.getElementById('linksContainer');
  const emptyState = document.getElementById('emptyState');
  const pagination = document.getElementById('pagination');

  if (links.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (pagination) pagination.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');

  // Pagination
  const totalPages = Math.ceil(links.length / linksPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * linksPerPage;
  const end = start + linksPerPage;
  const pageLinks = links.slice(start, end);

  container.innerHTML = pageLinks.map(link => createLinkCard(link)).join('');

  // Render pagination
  if (pagination && totalPages > 1) {
    let paginationHtml = '';
    if (currentPage > 1) {
      paginationHtml += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">‹</button>`;
    }
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    if (currentPage < totalPages) {
      paginationHtml += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">›</button>`;
    }
    paginationHtml += `<span class="page-info">${links.length} links</span>`;
    pagination.innerHTML = paginationHtml;
    pagination.classList.remove('hidden');
  } else if (pagination) {
    pagination.innerHTML = `<span class="page-info">${links.length} links</span>`;
  }
}

function goToPage(page) {
  currentPage = page;
  renderLinks();
  document.getElementById('linksContainer').scrollTop = 0;
}

window.goToPage = goToPage;

function createLinkCard(link) {
  const domain = new URL(link.url).hostname.replace('www.', '');
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const cat = categories.find(c => c.name === link.category || c.id === link.category);
  const catColor = cat ? cat.color : '#6b7280';
  const isFav = link.favorite || link.is_favorite;
  const created = link.createdAt || link.created_at;
  const dateStr = created ? new Date(created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

  return `
    <div class="link-card" data-id="${link.id}">
      <div class="link-card-header">
        <div class="link-favicon">
          <img src="${favicon}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <svg style="display:none" width="16" height="16"><use href="#i-link"/></svg>
        </div>
        <div class="link-info">
          <div class="link-title">${esc(link.title)}</div>
          <div class="link-url">${esc(domain)}</div>
        </div>
        <button class="link-action-btn favorite ${isFav ? 'active' : ''}" data-id="${link.id}">
          <svg width="14" height="14"><use href="#i-star"/></svg>
        </button>
      </div>
      ${link.description ? `<div class="link-description">${esc(link.description)}</div>` : ''}
      <div class="link-meta">
        <span class="link-category">
          <span class="cat-dot" style="background:${catColor}"></span>
          ${esc(link.category || 'Referências')}
        </span>
        ${dateStr ? `<span class="link-date">${dateStr}</span>` : ''}
      </div>
    </div>
  `;
}

function renderCategories() {
  const container = document.getElementById('categoriesScroll');
  const menuContainer = document.getElementById('menuCategories');
  
  let html = `<button class="cat-pill active" data-cat="all">Todos</button>`;
  let menuHtml = '';
  
  categories.forEach(cat => {
    html += `<button class="cat-pill" data-cat="${cat.name}">
      <span class="cat-dot" style="background:${cat.color}"></span>
      ${esc(cat.name)}
    </button>`;
    menuHtml += `
      <button class="nav-item category-nav-item" data-cat="${cat.name}">
        <span class="cat-dot" style="background:${cat.color};width:8px;height:8px;border-radius:50%"></span>
        ${esc(cat.name)}
      </button>
    `;
  });
  
  container.innerHTML = html;
  if (menuContainer) menuContainer.innerHTML = menuHtml;
  
  // Add click handlers
  container.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      currentCategory = pill.dataset.cat;
      currentPage = 1;
      container.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadLinks();
    });
  });
  
  if (menuContainer) {
    menuContainer.querySelectorAll('.category-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        currentCategory = item.dataset.cat;
        currentPage = 1;
        closeMenu();
        loadLinks();
      });
    });
  }
}

function updateCategorySelect() {
  const select = document.getElementById('linkCategory');
  select.innerHTML = '<option value="">Selecionar categoria</option>';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });
}

function openLink(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  window.open(link.url, '_blank');
}

function toggleFavorite(id) {
  const allLinks = loadData('links') || [];
  const link = allLinks.find(l => l.id === id);
  if (link) {
    link.favorite = !link.favorite;
    link.is_favorite = link.favorite;
    saveData('links', allLinks);
    saveToSupabase('links', link);
    loadAll();
  }
}

function deleteLink(id) {
  if (!confirm('Excluir este link?')) return;
  const allLinks = loadData('links') || [];
  saveData('links', allLinks.filter(l => l.id !== id));
  deleteFromSupabase('links', id);
  hideSwipeActions();
  loadAll();
  showToast('Link excluído');
}

function openLinkModal(link = null) {
  editingLinkId = link ? link.id : null;
  document.getElementById('modalTitle').textContent = link ? 'Editar Link' : 'Adicionar Link';
  document.getElementById('linkTitle').value = link ? link.title : '';
  document.getElementById('linkUrl').value = link ? link.url : '';
  document.getElementById('linkDescription').value = link ? (link.description || '') : '';
  document.getElementById('linkCategory').value = link ? (link.category || '') : '';
  document.getElementById('linkPriority').value = link ? (link.priority || 'medium') : 'medium';
  document.getElementById('linkTags').value = link ? (link.tags || []).join(', ') : '';
  document.getElementById('linkNotes').value = link ? (link.notes || '') : '';
  document.getElementById('linkModal').classList.add('active');
}

function saveLink() {
  const title = document.getElementById('linkTitle').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  const description = document.getElementById('linkDescription').value.trim();
  const category = document.getElementById('linkCategory').value;
  const priority = document.getElementById('linkPriority').value;
  const tags = document.getElementById('linkTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const notes = document.getElementById('linkNotes').value.trim();

  if (!title || !url) {
    showToast('Título e URL são obrigatórios');
    return;
  }

  try { new URL(url); } catch { showToast('URL inválida'); return; }

  const allLinks = loadData('links') || [];
  const now = new Date().toISOString();

  if (editingLinkId) {
    const idx = allLinks.findIndex(l => l.id === editingLinkId);
    if (idx !== -1) {
      allLinks[idx] = { ...allLinks[idx], title, url, description, category, priority, tags, notes, updated_at: now };
    }
  } else {
    allLinks.push({
      id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title, url, description, category, priority, tags, notes,
      favorite: false, is_favorite: false, broken: false, status: 'active',
      accessCount: 0, access_count: 0, createdAt: now, created_at: now, lastAccessed: null, last_accessed: null
    });
  }

  saveData('links', allLinks);
  saveToSupabase('links', allLinks[allLinks.length - 1]);
  document.getElementById('linkModal').classList.remove('active');
  editingLinkId = null;
  loadAll();
  showToast(editingLinkId ? 'Link atualizado' : 'Link adicionado');
}

function showSwipeActions(id) {
  selectedLinkId = id;
  document.getElementById('swipeActions').classList.add('active');
}

function hideSwipeActions() {
  document.getElementById('swipeActions').classList.remove('active');
  selectedLinkId = null;
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
  showToast('Links exportados');
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
        showToast('Links importados com sucesso');
      } catch { showToast('Arquivo de importação inválido'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function setPassword() {
  const pass = document.getElementById('newPassword').value.trim();
  if (pass) {
    localStorage.setItem('lv_password', pass);
    showToast('Senha definida');
  } else {
    localStorage.removeItem('lv_password');
    showToast('Senha removida');
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
    const localLinks = loadData('links') || [];
    if (localLinks.length > 0) {
      await supabaseQuery('links', 'POST', localLinks);
    }
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
  if (!stored || input.value === stored) {
    showApp();
    input.value = '';
  } else {
    showToast('Senha incorreta');
    input.value = '';
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('active');
  setTimeout(() => {
    toast.classList.remove('active');
    toast.classList.add('hidden');
  }, 3000);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function closeMenu() {
  document.getElementById('sideMenu').classList.remove('active');
}

function setFilter(filter) {
  currentFilter = filter;
  currentPage = 1;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === filter);
  });
  loadLinks();
}

function setupEventListeners() {
  // Lock screen
  document.getElementById('unlockBtn').addEventListener('click', handleUnlock);
  document.getElementById('lockPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });

  // Menu
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.remove('hidden');
    setTimeout(() => document.getElementById('sideMenu').classList.add('active'), 10);
  });
  document.getElementById('closeMenuBtn').addEventListener('click', closeMenu);
  document.getElementById('sideMenu').addEventListener('click', (e) => {
    if (e.target === document.getElementById('sideMenu')) closeMenu();
  });

  // Menu nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      closeMenu();
      const view = item.dataset.view;
      if (view === 'settings') {
        document.getElementById('settingsModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('settingsModal').classList.add('active'), 10);
      } else {
        setFilter(view);
      }
    });
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    loadLinks();
  });

  // Filter buttons
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.filter);
    });
  });

  // Add link
  document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal());

  // Modal
  document.getElementById('saveLinkBtn').addEventListener('click', saveLink);
  document.getElementById('closeLinkModal').addEventListener('click', () => {
    document.getElementById('linkModal').classList.remove('active');
    editingLinkId = null;
  });

  // Settings
  document.getElementById('closeSettingsModal').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
  });
  document.getElementById('exportBtn').addEventListener('click', exportLinks);
  document.getElementById('importBtn').addEventListener('click', importLinks);
  document.getElementById('savePassBtn').addEventListener('click', setPassword);
  document.getElementById('saveSupabaseBtn').addEventListener('click', saveSupabaseConfig);
  document.getElementById('syncNowBtn').addEventListener('click', syncNow);
  document.getElementById('checkLinksBtn').addEventListener('click', () => {
    showToast('Verificação de links não disponível no mobile');
  });

  // Load saved Supabase config
  document.getElementById('supabaseUrl').value = localStorage.getItem('lv_supabase_url') || '';
  document.getElementById('supabaseKey').value = localStorage.getItem('lv_supabase_key') || '';

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('lv_theme', e.target.checked ? 'dark' : 'light');
  });

  // Swipe actions
  document.querySelectorAll('.swipe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'favorite' && selectedLinkId) toggleFavorite(selectedLinkId);
      else if (action === 'edit' && selectedLinkId) {
        const link = links.find(l => l.id === selectedLinkId);
        if (link) openLinkModal(link);
      }
      else if (action === 'delete' && selectedLinkId) deleteLink(selectedLinkId);
      hideSwipeActions();
    });
  });

  // Link card clicks
  document.getElementById('linksContainer').addEventListener('click', (e) => {
    const card = e.target.closest('.link-card');
    if (!card) return;
    
    const favBtn = e.target.closest('.link-action-btn.favorite');
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.id);
      return;
    }
    
    openLink(card.dataset.id);
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
