use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    pub id: String,
    pub title: String,
    pub url: String,
    pub description: String,
    pub favicon: String,
    pub category: String,
    pub tags: Vec<String>,
    pub status: String,
    pub priority: String,
    pub notes: String,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub access_count: u32,
    pub last_accessed: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkCheckResult {
    pub link_id: String,
    pub url: String,
    pub status_code: u16,
    pub is_broken: bool,
    pub redirect_url: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub view_mode: String,
    pub sort_by: String,
    pub sort_order: String,
    pub lock_timeout: u32,
    pub password_hash: Option<String>,
    pub sync_enabled: bool,
    pub sync_provider: String,
    pub auto_check_links: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "pt-BR".to_string(),
            view_mode: "cards".to_string(),
            sort_by: "created_at".to_string(),
            sort_order: "desc".to_string(),
            lock_timeout: 5,
            password_hash: None,
            sync_enabled: false,
            sync_provider: "none".to_string(),
            auto_check_links: true,
        }
    }
}

impl Link {
    pub fn new(title: String, url: String, category: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            url,
            description: String::new(),
            favicon: String::new(),
            category,
            tags: Vec::new(),
            status: "active".to_string(),
            priority: "medium".to_string(),
            notes: String::new(),
            is_favorite: false,
            is_archived: false,
            access_count: 0,
            last_accessed: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

impl Category {
    pub fn new(name: String, icon: String, color: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            icon,
            color,
            sort_order: 0,
        }
    }
}
