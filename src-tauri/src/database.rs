use rusqlite::{Connection, params, Result};
use std::sync::Mutex;
use crate::models::*;

#[derive(Debug)]
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS links (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                description TEXT DEFAULT '',
                favicon TEXT DEFAULT '',
                category TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                status TEXT DEFAULT 'active',
                priority TEXT DEFAULT 'medium',
                notes TEXT DEFAULT '',
                is_favorite INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                access_count INTEGER DEFAULT 0,
                last_accessed TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                icon TEXT DEFAULT '📁',
                color TEXT DEFAULT '#6366f1',
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS link_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link_id TEXT NOT NULL,
                url TEXT NOT NULL,
                status_code INTEGER,
                is_broken INTEGER DEFAULT 0,
                redirect_url TEXT,
                checked_at TEXT NOT NULL,
                FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);
            CREATE INDEX IF NOT EXISTS idx_links_favorite ON links(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_links_archived ON links(is_archived);
            CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
        ")?;

        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM categories", [], |row| row.get(0)
        )?;
        
        if count == 0 {
            let default_categories = vec![
                ("Trabalho", "💼", "#6366f1"),
                ("Estudos", "📚", "#8b5cf6"),
                ("Produtividade", "⚡", "#f59e0b"),
                ("Finanças", "💰", "#10b981"),
                ("Desenvolvimento", "🔧", "#3b82f6"),
                ("Entretenimento", "🎮", "#ef4444"),
                ("Referências", "📖", "#6b7280"),
                ("Design", "🎨", "#ec4899"),
                ("Saúde", "🏥", "#14b8a6"),
                ("Notícias", "📰", "#f97316"),
            ];

            for (i, (name, icon, color)) in default_categories.iter().enumerate() {
                conn.execute(
                    "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![uuid::Uuid::new_v4().to_string(), name, icon, color, i as i32],
                )?;
            }
        }

        Ok(())
    }

    pub fn get_all_links(&self, include_archived: bool) -> Result<Vec<Link>> {
        let conn = self.conn.lock().unwrap();
        let query = if include_archived {
            "SELECT * FROM links ORDER BY created_at DESC"
        } else {
            "SELECT * FROM links WHERE is_archived = 0 ORDER BY created_at DESC"
        };
        
        let mut stmt = conn.prepare(query)?;
        let links = stmt.query_map([], |row| {
            let tags_json: String = row.get(7)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(Link {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
                description: row.get(3)?,
                favicon: row.get(4)?,
                category: row.get(5)?,
                tags,
                status: row.get(6)?,
                priority: row.get(8)?,
                notes: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? == 1,
                is_archived: row.get::<_, i32>(11)? == 1,
                access_count: row.get(12)?,
                last_accessed: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        
        Ok(links)
    }

    pub fn search_links(&self, query: &str, category: Option<&str>, favorites_only: bool) -> Result<Vec<Link>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from("SELECT * FROM links WHERE is_archived = 0");
        let mut query_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut param_index = 1;

        if !query.is_empty() {
            sql.push_str(&format!(" AND (title LIKE ?{} OR url LIKE ?{} OR description LIKE ?{} OR tags LIKE ?{})", param_index, param_index, param_index, param_index));
            query_params.push(Box::new(format!("%{}%", query)));
            param_index += 1;
        }

        if let Some(cat) = category {
            if !cat.is_empty() {
                sql.push_str(&format!(" AND category = ?{}", param_index));
                query_params.push(Box::new(cat.to_string()));
                param_index += 1;
            }
        }

        if favorites_only {
            sql.push_str(" AND is_favorite = 1");
        }

        sql.push_str(" ORDER BY created_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
        let links = stmt.query_map(param_refs.as_slice(), |row| {
            let tags_json: String = row.get(7)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(Link {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
                description: row.get(3)?,
                favicon: row.get(4)?,
                category: row.get(5)?,
                tags,
                status: row.get(6)?,
                priority: row.get(8)?,
                notes: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? == 1,
                is_archived: row.get::<_, i32>(11)? == 1,
                access_count: row.get(12)?,
                last_accessed: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(links)
    }

    pub fn insert_link(&self, link: &Link) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_json = serde_json::to_string(&link.tags).unwrap_or_default();
        conn.execute(
            "INSERT INTO links (id, title, url, description, favicon, category, tags, status, priority, notes, is_favorite, is_archived, access_count, last_accessed, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                link.id, link.title, link.url, link.description, link.favicon,
                link.category, tags_json, link.status, link.priority, link.notes,
                link.is_favorite as i32, link.is_archived as i32, link.access_count,
                link.last_accessed, link.created_at, link.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn insert_links_batch(&self, links: &[Link]) -> Result<u32> {
        let conn = self.conn.lock().unwrap();
        let mut count = 0;
        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO links (id, title, url, description, favicon, category, tags, status, priority, notes, is_favorite, is_archived, access_count, last_accessed, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
            )?;
            for link in links {
                let tags_json = serde_json::to_string(&link.tags).unwrap_or_default();
                stmt.execute(params![
                    link.id, link.title, link.url, link.description, link.favicon,
                    link.category, tags_json, link.status, link.priority, link.notes,
                    link.is_favorite as i32, link.is_archived as i32, link.access_count,
                    link.last_accessed, link.created_at, link.updated_at
                ])?;
                count += 1;
            }
        }
        tx.commit()?;
        Ok(count)
    }

    pub fn update_link(&self, link: &Link) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_json = serde_json::to_string(&link.tags).unwrap_or_default();
        conn.execute(
            "UPDATE links SET title=?1, url=?2, description=?3, favicon=?4, category=?5,
             tags=?6, status=?7, priority=?8, notes=?9, is_favorite=?10, is_archived=?11,
             access_count=?12, last_accessed=?13, updated_at=?14 WHERE id=?15",
            params![
                link.title, link.url, link.description, link.favicon, link.category,
                tags_json, link.status, link.priority, link.notes,
                link.is_favorite as i32, link.is_archived as i32, link.access_count,
                link.last_accessed, link.updated_at, link.id
            ],
        )?;
        Ok(())
    }

    pub fn delete_link(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM links WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_all_links(&self) -> Result<u32> {
        let conn = self.conn.lock().unwrap();
        let count = conn.execute("DELETE FROM links", params![])? as u32;
        Ok(count)
    }

    pub fn get_link_by_id(&self, id: &str) -> Result<Link> {
        let conn = self.conn.lock().unwrap();
        let link = conn.query_row(
            "SELECT * FROM links WHERE id = ?1", params![id], |row| {
                let tags_json: String = row.get(7)?;
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                Ok(Link {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    url: row.get(2)?,
                    description: row.get(3)?,
                    favicon: row.get(4)?,
                    category: row.get(5)?,
                    tags,
                    status: row.get(6)?,
                    priority: row.get(8)?,
                    notes: row.get(9)?,
                    is_favorite: row.get::<_, i32>(10)? == 1,
                    is_archived: row.get::<_, i32>(11)? == 1,
                    access_count: row.get(12)?,
                    last_accessed: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            }
        )?;
        Ok(link)
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let current: i32 = conn.query_row(
            "SELECT is_favorite FROM links WHERE id = ?1", params![id], |row| row.get(0)
        )?;
        let new_val = if current == 0 { 1 } else { 0 };
        conn.execute("UPDATE links SET is_favorite = ?1 WHERE id = ?2", params![new_val, id])?;
        Ok(new_val == 1)
    }

    pub fn archive_link(&self, id: &str, archived: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE links SET is_archived = ?1 WHERE id = ?2", params![archived as i32, id])?;
        Ok(())
    }

    pub fn increment_access(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE links SET access_count = access_count + 1, last_accessed = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn get_categories(&self) -> Result<Vec<Category>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order")?;
        let categories = stmt.query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(categories)
    }

    pub fn insert_category(&self, cat: &Category) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![cat.id, cat.name, cat.icon, cat.color, cat.sort_order],
        )?;
        Ok(())
    }

    pub fn update_category(&self, cat: &Category) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE categories SET name=?1, icon=?2, color=?3, sort_order=?4 WHERE id=?5",
            params![cat.name, cat.icon, cat.color, cat.sort_order, cat.id],
        )?;
        Ok(())
    }

    pub fn delete_category(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0)
        );
        match result {
            Ok(val) => Ok(Some(val)),
            Err(_) => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<serde_json::Value> {
        let conn = self.conn.lock().unwrap();
        let total: i32 = conn.query_row("SELECT COUNT(*) FROM links WHERE is_archived = 0", [], |row| row.get(0))?;
        let favorites: i32 = conn.query_row("SELECT COUNT(*) FROM links WHERE is_favorite = 1 AND is_archived = 0", [], |row| row.get(0))?;
        let broken: i32 = conn.query_row("SELECT COUNT(*) FROM links WHERE status = 'broken' AND is_archived = 0", [], |row| row.get(0))?;
        let categories: i32 = conn.query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))?;
        
        Ok(serde_json::json!({
            "total": total,
            "favorites": favorites,
            "broken": broken,
            "categories": categories
        }))
    }
}
