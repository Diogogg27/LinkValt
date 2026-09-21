// LinkVault - Main Application
const { invoke } = window.__TAURI__.core;

// Icon helper - renders SVG from sprite
function icon(name, size = 16) {
    return `<svg width="${size}" height="${size}"><use href="#i-${name}"/></svg>`;
}

const categoryIcons = {
    'Referências': 'globe',
    'Desenvolvimento': 'terminal',
    'Design': 'palette',
    'Ferramentas': 'settings',
    'Notícias': 'file-text',
    'Social': 'users',
    'Aprendizado': 'book-open',
    'Entretenimento': 'play',
    'Compras': 'shopping-bag',
    'Saúde': 'heart',
    'Viagem': 'compass',
    'Música': 'music',
    'Vídeo': 'video',
    'Imagens': 'image',
    'Favoritos': 'star',
    'Importados': 'upload'
};

// State
let links = [];
let currentPage = 1;
const linksPerPage = 100;
let totalLinks = 0;
let categories = [];
let currentView = 'all';
let currentCategory = null;
let viewMode = 'cards';
let searchQuery = '';
let editingLinkId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    setupEventListeners();
    setupKeyboardShortcuts();
});

async function initApp() {
    try {
        // Check password
        const settings = await invoke('get_settings');
        if (settings.has_password) {
            document.getElementById('lockScreen').classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');
        } else {
            await loadApp();
        }
    } catch (e) {
        console.error('Init error:', e);
        await loadApp();
    }
}

async function loadApp() {
    document.getElementById('lockScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    await loadCategories();
    await loadLinks();
    await loadStats();
    applyTheme();
}

// Event Listeners
function setupEventListeners() {
    // Lock screen
    document.getElementById('unlockBtn').addEventListener('click', handleUnlock);
    document.getElementById('lockPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUnlock();
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));

    // View mode
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => setViewMode(btn.dataset.view));
    });

    // Sort
    document.getElementById('sortSelect').addEventListener('change', handleSort);

    // Add link
    document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal());

    // Link form
    document.getElementById('linkForm').addEventListener('submit', handleSaveLink);
    document.getElementById('closeModal').addEventListener('click', () => closeModal('linkModal'));
    document.getElementById('cancelModal').addEventListener('click', () => closeModal('linkModal'));

    // Category form
    document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
    document.getElementById('categoryForm').addEventListener('submit', handleSaveCategory);
    document.getElementById('closeCatModal').addEventListener('click', () => closeModal('categoryModal'));
    document.getElementById('cancelCatModal').addEventListener('click', () => closeModal('categoryModal'));

    // Settings
    document.querySelector('[data-view="settings"]').addEventListener('click', () => openModal('settingsModal'));
    document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('settingTheme').addEventListener('change', handleThemeChange);
    document.getElementById('savePasswordBtn').addEventListener('click', handleSavePassword);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('importBtn').addEventListener('click', () => { closeModal('settingsModal'); openModal('importModal'); });
    document.getElementById('closeImportModal').addEventListener('click', () => closeModal('importModal'));
    document.getElementById('checkLinksBtn').addEventListener('click', handleCheckLinks);
    document.getElementById('deleteAllBtn').addEventListener('click', handleDeleteAll);

    // Import
    document.getElementById('importJsonBtn').addEventListener('click', () => triggerImport('json'));
    document.getElementById('importHtmlBtn').addEventListener('click', () => triggerImport('html'));

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Modal backdrop close
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K: Focus search
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
        // Escape: Close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
        }
        // Ctrl+N: New link
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            openLinkModal();
        }
    });
}

// Auth
async function handleUnlock() {
    const password = document.getElementById('lockPassword').value;
    try {
        const valid = await invoke('verify_password_cmd', { password });
        if (valid) {
            await loadApp();
        } else {
            document.getElementById('lockError').classList.remove('hidden');
            document.getElementById('lockPassword').value = '';
        }
    } catch (e) {
        console.error('Unlock error:', e);
        await loadApp();
    }
}

function goToPage(page) {
    currentPage = page;
    renderLinks();
    document.getElementById('linksContainer').scrollTop = 0;
}

// Data Loading
async function loadLinks() {
    currentPage = 1;
    try {
        let linksData = [];
        
        if (searchQuery) {
            linksData = await invoke('get_links', { 
                search: searchQuery,
                category: currentCategory,
                favoritesOnly: currentView === 'favorites'
            });
        } else {
            linksData = await invoke('get_links', {
                search: null,
                category: currentCategory,
                favoritesOnly: currentView === 'favorites',
                includeArchived: currentView === 'archived'
            });
        }

        // Filter by view
        switch (currentView) {
            case 'broken':
                linksData = linksData.filter(l => l.status === 'broken');
                break;
            case 'recent':
                linksData = linksData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
                break;
            case 'frequent':
                linksData = linksData.sort((a, b) => b.access_count - a.access_count).slice(0, 20);
                break;
        }

        // Sort
        const sortBy = document.getElementById('sortSelect').value;
        linksData = sortLinks(linksData, sortBy);

        links = linksData;
        renderLinks();
    } catch (e) {
        console.error('Load links error:', e);
    }
}

async function loadCategories() {
    try {
        categories = await invoke('get_categories');
        renderCategories();
        updateCategorySelect();
    } catch (e) {
        console.error('Load categories error:', e);
    }
}

async function loadStats() {
    try {
        const stats = await invoke('get_stats');
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statFavorites').textContent = stats.favorites;
        document.getElementById('statCategories').textContent = stats.categories;
        document.getElementById('statBroken').textContent = stats.broken;
        document.getElementById('totalCount').textContent = stats.total;
        document.getElementById('favCount').textContent = stats.favorites;
        document.getElementById('brokenCount').textContent = stats.broken;
    } catch (e) {
        console.error('Load stats error:', e);
    }
}

// Rendering
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
    totalLinks = links.length;
    const totalPages = Math.ceil(totalLinks / linksPerPage);
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
        paginationHtml += `<span class="page-info">${totalLinks} links</span>`;
        pagination.innerHTML = paginationHtml;
        pagination.classList.remove('hidden');
    } else if (pagination) {
        pagination.innerHTML = `<span class="page-info">${totalLinks} links</span>`;
    }

    // Add event listeners
    container.querySelectorAll('.link-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.link-action-btn')) {
                openLink(link);
            }
        });
    });

    container.querySelectorAll('.link-action-btn.favorite').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.id);
        });
    });

    container.querySelectorAll('.link-action-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editLink(btn.dataset.id);
        });
    });

    container.querySelectorAll('.link-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLink(btn.dataset.id);
        });
    });
}

function createLinkCard(link) {
    const category = categories.find(c => c.name === link.category);
    const catIconName = category ? (categoryIcons[category.name] || 'folder') : 'folder';
    const catColor = category ? category.color : '#6366f1';
    const domain = new URL(link.url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    const priorityColors = { low: 'low', medium: 'medium', high: 'high' };
    const tags = link.tags.slice(0, 3).map(t => `<span class="link-tag">${t}</span>`).join('');
    
    return `
        <div class="link-card" data-id="${link.id}">
            <div class="link-card-header">
                <div class="link-favicon">
                    <img src="${faviconUrl}" alt="" onerror="this.parentElement.innerHTML='${icon(catIconName, 20)}'">
                </div>
                <div class="link-info">
                    <div class="link-title">${escapeHtml(link.title)}</div>
                    <div class="link-url">${escapeHtml(domain)}</div>
                </div>
                <div class="link-actions">
                    <button class="link-action-btn favorite ${link.is_favorite ? 'active' : ''}" data-id="${link.id}" title="Favoritar">${icon('star', 14)}</button>
                    <button class="link-action-btn edit" data-id="${link.id}" title="Editar">${icon('edit', 14)}</button>
                    <button class="link-action-btn delete" data-id="${link.id}" title="Excluir">${icon('trash', 14)}</button>
                </div>
            </div>
            ${link.description ? `<div class="link-description">${escapeHtml(link.description)}</div>` : ''}
            <div class="link-meta">
                <span class="link-category">${icon(catIconName, 12)} ${escapeHtml(link.category)}</span>
                ${tags}
                <span class="link-priority ${priorityColors[link.priority]}"></span>
                <span class="link-date">${formatDate(link.created_at)}</span>
            </div>
        </div>
    `;
}

function renderCategories() {
    const container = document.getElementById('categoryList');
    const linksPerCategory = {};
    
    links.forEach(link => {
        linksPerCategory[link.category] = (linksPerCategory[link.category] || 0) + 1;
    });

    container.innerHTML = categories.map(cat => {
        const iconName = categoryIcons[cat.name] || 'folder';
        return `
        <div class="category-item ${currentCategory === cat.name ? 'active' : ''}" data-category="${cat.name}">
            <span class="category-dot" style="background: ${cat.color}"></span>
            <span>${icon(iconName, 14)} ${escapeHtml(cat.name)}</span>
            <span class="category-count">${linksPerCategory[cat.name] || 0}</span>
        </div>
    `}).join('');

    container.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            currentCategory = currentCategory === item.dataset.category ? null : item.dataset.category;
            renderCategories();
            loadLinks();
        });
    });
}

function updateCategorySelect() {
    const select = document.getElementById('linkCategory');
    select.innerHTML = categories.map(cat => {
        const iconName = categoryIcons[cat.name] || 'folder';
        return `<option value="${cat.name}">${cat.name}</option>`;
    }).join('');
}

// View Management
function switchView(view) {
    currentView = view;
    currentCategory = null;
    
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'settings') {
        openModal('settingsModal');
        return;
    }

    loadLinks();
}

function setViewMode(mode) {
    viewMode = mode;
    const container = document.getElementById('linksContainer');
    container.className = `links-container view-${mode}`;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
}

// Search & Sort
function handleSearch(e) {
    searchQuery = e.target.value;
    loadLinks();
}

function handleSort() {
    loadLinks();
}

function sortLinks(links, sortBy) {
    return [...links].sort((a, b) => {
        switch (sortBy) {
            case 'title': return a.title.localeCompare(b.title);
            case 'category': return a.category.localeCompare(b.category);
            case 'priority': {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.priority] - order[b.priority];
            }
            case 'access_count': return b.access_count - a.access_count;
            default: return new Date(b.created_at) - new Date(a.created_at);
        }
    });
}

// Link Actions
async function openLink(link) {
    try {
        await invoke('open_link', { id: link.id });
        await window.__TAURI__.shell.open(link.url);
    } catch (e) {
        console.error('Open link error:', e);
    }
}

function openLinkModal(link = null) {
    editingLinkId = link ? link.id : null;
    document.getElementById('modalTitle').textContent = link ? 'Editar Link' : 'Adicionar Link';
    document.getElementById('linkId').value = link ? link.id : '';
    document.getElementById('linkTitle').value = link ? link.title : '';
    document.getElementById('linkUrl').value = link ? link.url : '';
    document.getElementById('linkDescription').value = link ? link.description : '';
    document.getElementById('linkCategory').value = link ? link.category : (categories[0]?.name || '');
    document.getElementById('linkPriority').value = link ? link.priority : 'medium';
    document.getElementById('linkTags').value = link ? link.tags.join(', ') : '';
    document.getElementById('linkNotes').value = link ? link.notes : '';
    openModal('linkModal');
}

async function handleSaveLink(e) {
    e.preventDefault();
    
    const data = {
        title: document.getElementById('linkTitle').value,
        url: document.getElementById('linkUrl').value,
        description: document.getElementById('linkDescription').value,
        category: document.getElementById('linkCategory').value,
        priority: document.getElementById('linkPriority').value,
        tags: document.getElementById('linkTags').value.split(',').map(t => t.trim()).filter(Boolean),
        notes: document.getElementById('linkNotes').value,
    };

    try {
        if (editingLinkId) {
            await invoke('update_link', { id: editingLinkId, ...data });
            showToast('Link atualizado com sucesso');
        } else {
            await invoke('add_link', data);
            showToast('Link adicionado com sucesso');
        }
        closeModal('linkModal');
        await loadLinks();
        await loadStats();
    } catch (e) {
        console.error('Save link error:', e);
        showToast('Erro ao salvar link');
    }
}

function editLink(id) {
    const link = links.find(l => l.id === id);
    if (link) openLinkModal(link);
}

async function deleteLink(id) {
    if (!confirm('Tem certeza que deseja excluir este link?')) return;
    try {
        await invoke('delete_link', { id });
        showToast('Link excluído');
        await loadLinks();
        await loadStats();
    } catch (e) {
        console.error('Delete link error:', e);
    }
}

async function toggleFavorite(id) {
    try {
        await invoke('toggle_favorite', { id });
        await loadLinks();
        await loadStats();
    } catch (e) {
        console.error('Toggle favorite error:', e);
    }
}

// Category Actions
function openCategoryModal(cat = null) {
    document.getElementById('catModalTitle').textContent = cat ? 'Editar Categoria' : 'Nova Categoria';
    document.getElementById('catId').value = cat ? cat.id : '';
    document.getElementById('catName').value = cat ? cat.name : '';
    document.getElementById('catColor').value = cat ? cat.color : '#6366f1';
    openModal('categoryModal');
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    const data = {
        name: document.getElementById('catName').value,
        icon: document.getElementById('catName').value,
        color: document.getElementById('catColor').value,
    };

    try {
        if (id) {
            await invoke('update_category', { id, ...data });
        } else {
            await invoke('add_category', data);
        }
        closeModal('categoryModal');
        await loadCategories();
        await loadStats();
        showToast('Categoria salva');
    } catch (e) {
        console.error('Save category error:', e);
    }
}

// Settings
async function handleThemeChange(e) {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('linkvault-theme', theme);
    try {
        await invoke('save_settings', { settings: { theme } });
    } catch (err) {
        console.error('Save theme error:', err);
    }
}

function applyTheme() {
    const saved = localStorage.getItem('linkvault-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('settingTheme').value = saved;
}

async function handleSavePassword() {
    const password = document.getElementById('settingPassword').value;
    if (!password || password.length < 4) {
        showToast('Senha deve ter pelo menos 4 caracteres');
        return;
    }
    try {
        await invoke('set_password', { password });
        showToast('Senha definida com sucesso');
        document.getElementById('settingPassword').value = '';
    } catch (e) {
        console.error('Save password error:', e);
    }
}

async function handleExport() {
    try {
        const data = await invoke('export_links');
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkvault-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Links exportados com sucesso');
    } catch (e) {
        console.error('Export error:', e);
        showToast('Erro ao exportar');
    }
}

function triggerImport(type) {
    const input = document.getElementById('importFile');
    input.accept = type === 'json' ? '.json' : '.html';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        try {
            let count;
            if (type === 'json') {
                count = await invoke('import_links', { jsonData: text });
            } else {
                count = await invoke('import_html', { htmlData: text });
            }
            showToast(`${count} links importados`);
            closeModal('importModal');
            await loadLinks();
            await loadStats();
        } catch (e) {
            console.error('Import error:', e);
            showToast('Erro ao importar');
        }
    };
    input.click();
}

async function handleCheckLinks() {
    showToast('Verificando links...');
    try {
        const results = await invoke('check_links', { links });
        let brokenCount = 0;
        for (const result of results) {
            if (result.is_broken) {
                brokenCount++;
                await invoke('update_link', { 
                    id: result.link_id, 
                    status: 'broken' 
                });
            }
        }
        showToast(`${brokenCount} links com problema encontrados`);
        await loadLinks();
        await loadStats();
    } catch (e) {
        console.error('Check links error:', e);
        showToast('Erro ao verificar links');
    }
}

async function handleDeleteAll() {
    if (!confirm('Tem certeza que deseja excluir TODOS os links? Esta ação não pode ser desfeita.')) return;
    try {
        const count = await invoke('delete_all_links');
        showToast(`${count} links excluídos`);
        await loadLinks();
        await loadStats();
    } catch (e) {
        console.error('Delete all error:', e);
        showToast('Erro ao excluir links');
    }
}

// Modal Management
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Utilities
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString('pt-BR');
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
