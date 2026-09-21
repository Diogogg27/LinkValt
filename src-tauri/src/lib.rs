mod database;
mod models;
mod crypto;
mod link_checker;
mod supabase;

use database::Database;
use models::*;
use std::sync::OnceLock;
use tauri::Manager;

static DB: OnceLock<Database> = OnceLock::new();

fn get_db() -> &'static Database {
    DB.get().expect("Database not initialized")
}

#[tauri::command]
fn get_links(
    search: Option<String>,
    category: Option<String>,
    favorites_only: Option<bool>,
    include_archived: Option<bool>,
) -> Result<Vec<Link>, String> {
    let db = get_db();
    if let Some(query) = search {
        let cat = category.as_deref();
        let fav = favorites_only.unwrap_or(false);
        db.search_links(&query, cat, fav).map_err(|e| e.to_string())
    } else {
        let inc = include_archived.unwrap_or(false);
        db.get_all_links(inc).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn add_link(
    title: String,
    url: String,
    description: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    priority: Option<String>,
    notes: Option<String>,
) -> Result<Link, String> {
    let db = get_db();
    let mut link = Link::new(
        title,
        url,
        category.unwrap_or_else(|| "Referências".to_string()),
    );
    if let Some(desc) = description { link.description = desc; }
    if let Some(t) = tags { link.tags = t; }
    if let Some(p) = priority { link.priority = p; }
    if let Some(n) = notes { link.notes = n; }
    link.favicon = format!("https://www.google.com/s2/favicons?domain={}&sz=32", 
        link.url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or(""));
    
    db.insert_link(&link).map_err(|e| e.to_string())?;
    Ok(link)
}

#[tauri::command]
fn update_link(
    id: String,
    title: Option<String>,
    url: Option<String>,
    description: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    status: Option<String>,
    priority: Option<String>,
    notes: Option<String>,
    is_favorite: Option<bool>,
    is_archived: Option<bool>,
) -> Result<Link, String> {
    let db = get_db();
    let links = db.get_all_links(true).map_err(|e| e.to_string())?;
    let mut link = links.into_iter().find(|l| l.id == id).ok_or("Link not found")?;
    
    if let Some(t) = title { link.title = t; }
    if let Some(u) = url { link.url = u; link.favicon = format!("https://www.google.com/s2/favicons?domain={}&sz=32", link.url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or("")); }
    if let Some(d) = description { link.description = d; }
    if let Some(c) = category { link.category = c; }
    if let Some(t) = tags { link.tags = t; }
    if let Some(s) = status { link.status = s; }
    if let Some(p) = priority { link.priority = p; }
    if let Some(n) = notes { link.notes = n; }
    if let Some(f) = is_favorite { link.is_favorite = f; }
    if let Some(a) = is_archived { link.is_archived = a; }
    link.updated_at = chrono::Utc::now().to_rfc3339();
    
    db.update_link(&link).map_err(|e| e.to_string())?;
    Ok(link)
}

#[tauri::command]
fn delete_link(id: String) -> Result<(), String> {
    let db = get_db();
    db.delete_link(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_all_links() -> Result<u32, String> {
    let db = get_db();
    db.delete_all_links().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(id: String) -> Result<bool, String> {
    let db = get_db();
    db.toggle_favorite(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn archive_link(id: String, archived: bool) -> Result<(), String> {
    let db = get_db();
    db.archive_link(&id, archived).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_link(id: String) -> Result<(), String> {
    let db = get_db();
    let link = db.get_link_by_id(&id).map_err(|e| e.to_string())?;
    open::that(&link.url).map_err(|e| e.to_string())?;
    db.increment_access(&id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_categories() -> Result<Vec<Category>, String> {
    let db = get_db();
    db.get_categories().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_category(name: String, icon: Option<String>, color: Option<String>) -> Result<Category, String> {
    let db = get_db();
    let cat = Category::new(
        name,
        icon.unwrap_or_else(|| "📁".to_string()),
        color.unwrap_or_else(|| "#6366f1".to_string()),
    );
    db.insert_category(&cat).map_err(|e| e.to_string())?;
    Ok(cat)
}

#[tauri::command]
fn update_category(id: String, name: Option<String>, icon: Option<String>, color: Option<String>) -> Result<Category, String> {
    let db = get_db();
    let cats = db.get_categories().map_err(|e| e.to_string())?;
    let mut cat = cats.into_iter().find(|c| c.id == id).ok_or("Category not found")?;
    if let Some(n) = name { cat.name = n; }
    if let Some(i) = icon { cat.icon = i; }
    if let Some(c) = color { cat.color = c; }
    db.update_category(&cat).map_err(|e| e.to_string())?;
    Ok(cat)
}

#[tauri::command]
fn delete_category(id: String) -> Result<(), String> {
    let db = get_db();
    db.delete_category(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_links(links: Vec<Link>) -> Result<Vec<models::LinkCheckResult>, String> {
    Ok(link_checker::check_all_links(links).await)
}

#[tauri::command]
fn get_stats() -> Result<serde_json::Value, String> {
    let db = get_db();
    db.get_stats().map_err(|e| e.to_string())
}

#[tauri::command]
fn export_links() -> Result<String, String> {
    let db = get_db();
    let links = db.get_all_links(true).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&links).map_err(|e| e.to_string())
}

fn categorize_url(url: &str) -> String {
    let url_lower = url.to_lowercase();
    
    if url_lower.contains("github.com") || url_lower.contains("gitlab.com") || url_lower.contains("stackoverflow.com") || url_lower.contains("developer.") || url_lower.contains("docs.") || url_lower.contains("documentation") || url_lower.contains("/api/") || url_lower.contains("npmjs.com") || url_lower.contains("crates.io") {
        return "Desenvolvimento".to_string();
    }
    if url_lower.contains("figma.com") || url_lower.contains("dribbble.com") || url_lower.contains("behance.net") || url_lower.contains("adobe.com") || url_lower.contains("canva.com") || url_lower.contains("/design") || url_lower.contains("fonts.google.com") {
        return "Design".to_string();
    }
    if url_lower.contains("youtube.com") || url_lower.contains("netflix.com") || url_lower.contains("twitch.tv") || url_lower.contains("spotify.com") || url_lower.contains("music.") || url_lower.contains("/video") || url_lower.contains("/watch") {
        return "Entretenimento".to_string();
    }
    if url_lower.contains("twitter.com") || url_lower.contains("x.com") || url_lower.contains("instagram.com") || url_lower.contains("facebook.com") || url_lower.contains("linkedin.com") || url_lower.contains("reddit.com") || url_lower.contains("discord.com") || url_lower.contains("t.me") || url_lower.contains("telegram") {
        return "Social".to_string();
    }
    if url_lower.contains("news") || url_lower.contains("noticias") || url_lower.contains("blog") || url_lower.contains("medium.com") || url_lower.contains("dev.to") || url_lower.contains("hackernews") || url_lower.contains("techcrunch") || url_lower.contains("theverge") {
        return "Notícias".to_string();
    }
    if url_lower.contains("udemy.com") || url_lower.contains("coursera.org") || url_lower.contains("edx.org") || url_lower.contains("khan academy") || url_lower.contains("/learn") || url_lower.contains("/tutorial") || url_lower.contains("/course") || url_lower.contains("alura.com.br") || url_lower.contains("rocketseat") {
        return "Aprendizado".to_string();
    }
    if url_lower.contains("amazon.") || url_lower.contains("mercadolivre") || url_lower.contains("shopee") || url_lower.contains("aliexpress") || url_lower.contains("ebay") || url_lower.contains("/shop") || url_lower.contains("/store") || url_lower.contains("/product") {
        return "Compras".to_string();
    }
    if url_lower.contains("tool") || url_lower.contains("converter") || url_lower.contains("calculator") || url_lower.contains("regex101") || url_lower.contains("json") || url_lower.contains("jwt.io") || url_lower.contains("tinypng") || url_lower.contains("unscreen") {
        return "Ferramentas".to_string();
    }
    
    "Referências".to_string()
}

#[tauri::command]
fn import_links(json_data: String) -> Result<u32, String> {
    let db = get_db();
    let links: Vec<Link> = serde_json::from_str(&json_data).map_err(|e| e.to_string())?;
    let mut processed = Vec::with_capacity(links.len());
    for mut link in links {
        link.id = uuid::Uuid::new_v4().to_string();
        link.category = categorize_url(&link.url);
        link.favicon = format!("https://www.google.com/s2/favicons?domain={}&sz=32", 
            link.url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or(""));
        link.created_at = chrono::Utc::now().to_rfc3339();
        link.updated_at = link.created_at.clone();
        processed.push(link);
    }
    db.insert_links_batch(&processed).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_html(html_data: String) -> Result<u32, String> {
    let db = get_db();
    
    let re_url = regex_lite::Regex::new(r#"(?i)href=["']([^"']+)["']"#).unwrap();
    let re_name = regex_lite::Regex::new(r#"(?i)><A[^>]*>([^<]+)</A>"#).unwrap();
    
    let urls: Vec<String> = re_url.captures_iter(&html_data)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .filter(|u| u.starts_with("http"))
        .collect();
    
    let mut processed = Vec::with_capacity(urls.len());
    for url in urls {
        let title = re_name.captures_iter(&html_data)
            .find(|c| {
                if let Some(m) = c.get(0) {
                    m.as_str().contains(&url)
                } else {
                    false
                }
            })
            .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
            .unwrap_or_else(|| {
                url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or("Link").to_string()
            });
        
        let category = categorize_url(&url);
        let mut link = Link::new(title, url.clone(), category);
        link.favicon = format!("https://www.google.com/s2/favicons?domain={}&sz=32", 
            url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or(""));
        link.created_at = chrono::Utc::now().to_rfc3339();
        link.updated_at = link.created_at.clone();
        processed.push(link);
    }
    db.insert_links_batch(&processed).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_password(password: String) -> Result<(), String> {
    let db = get_db();
    let hash = crypto::hash_password(&password);
    db.set_setting("password_hash", &hash).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password_cmd(password: String) -> Result<bool, String> {
    let db = get_db();
    match db.get_setting("password_hash").map_err(|e| e.to_string())? {
        Some(hash) => Ok(crypto::verify_password(&password, &hash)),
        None => Ok(true),
    }
}

#[tauri::command]
fn get_settings() -> Result<serde_json::Value, String> {
    let db = get_db();
    let theme = db.get_setting("theme").unwrap_or(Some("dark".to_string())).unwrap_or_default();
    let view_mode = db.get_setting("view_mode").unwrap_or(Some("cards".to_string())).unwrap_or_default();
    let sort_by = db.get_setting("sort_by").unwrap_or(Some("created_at".to_string())).unwrap_or_default();
    let has_password = db.get_setting("password_hash").map_err(|e| e.to_string())?.is_some();
    
    Ok(serde_json::json!({
        "theme": theme,
        "view_mode": view_mode,
        "sort_by": sort_by,
        "has_password": has_password
    }))
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let db = get_db();
    if let Some(theme) = settings.get("theme").and_then(|v| v.as_str()) {
        db.set_setting("theme", theme).map_err(|e| e.to_string())?;
    }
    if let Some(view) = settings.get("view_mode").and_then(|v| v.as_str()) {
        db.set_setting("view_mode", view).map_err(|e| e.to_string())?;
    }
    if let Some(sort) = settings.get("sort_by").and_then(|v| v.as_str()) {
        db.set_setting("sort_by", sort).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn sync_to_cloud(url: String, key: String) -> Result<u32, String> {
    let db = get_db();
    let links = db.get_all_links(false).map_err(|e| e.to_string())?;
    let client = supabase::SupabaseClient::new(&url, &key);
    client.upsert_links(&links).await
}

#[tauri::command]
async fn sync_from_cloud(url: String, key: String) -> Result<u32, String> {
    let db = get_db();
    let client = supabase::SupabaseClient::new(&url, &key);
    let cloud_links = client.get_links().await?;
    let mut count = 0;
    for link in cloud_links {
        if db.insert_link(&link).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("linkvault.db");
            let db = Database::new(db_path.to_str().unwrap()).expect("Failed to initialize database");
            DB.set(db).ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_links,
            add_link,
            update_link,
            delete_link,
            delete_all_links,
            toggle_favorite,
            archive_link,
            open_link,
            get_categories,
            add_category,
            update_category,
            delete_category,
            check_links,
            get_stats,
            export_links,
            import_links,
            import_html,
            set_password,
            verify_password_cmd,
            get_settings,
            save_settings,
            sync_to_cloud,
            sync_from_cloud,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
