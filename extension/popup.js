// LinkVault Browser Extension
const API_BASE = 'http://localhost:1420';

document.addEventListener('DOMContentLoaded', async () => {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    document.getElementById('title').value = tab.title || '';
    document.getElementById('url').value = tab.url || '';

    // Load categories
    await loadCategories();

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => saveLink(tab));
});

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/api/categories`);
        if (response.ok) {
            const categories = await response.json();
            const select = document.getElementById('category');
            select.innerHTML = categories.map(cat => 
                `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
            ).join('');
        }
    } catch (e) {
        // Use default categories if API not available
        const select = document.getElementById('category');
        select.innerHTML = `
            <option value="Trabalho">💼 Trabalho</option>
            <option value="Estudos">📚 Estudos</option>
            <option value="Produtividade">⚡ Produtividade</option>
            <option value="Finanças">💰 Finanças</option>
            <option value="Desenvolvimento">🔧 Desenvolvimento</option>
            <option value="Entretenimento">🎮 Entretenimento</option>
            <option value="Referências">📖 Referências</option>
        `;
    }
}

async function saveLink(tab) {
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const data = {
        title: document.getElementById('title').value,
        url: document.getElementById('url').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        priority: document.getElementById('priority').value,
        tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
        const response = await fetch(`${API_BASE}/api/links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            document.getElementById('form').classList.add('hidden');
            document.getElementById('success').classList.remove('hidden');
            setTimeout(() => window.close(), 1500);
        } else {
            throw new Error('Failed to save');
        }
    } catch (e) {
        document.getElementById('message').innerHTML = '<div class="error">Erro ao salvar. Verifique se o LinkVault está aberto.</div>';
        btn.disabled = false;
        btn.textContent = 'Salvar no LinkVault';
    }
}
