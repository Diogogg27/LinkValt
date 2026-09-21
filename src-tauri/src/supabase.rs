use serde::{Deserialize, Serialize};
use crate::models::Link;

#[derive(Debug, Clone)]
pub struct SupabaseClient {
    url: String,
    key: String,
    client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupabaseResponse<T> {
    pub value: T,
}

impl SupabaseClient {
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            key: key.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn get_links(&self) -> Result<Vec<Link>, String> {
        let resp = self.client
            .get(format!("{}/rest/v1/links", self.url))
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .header("Prefer", "return=representation")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        
        resp.json::<Vec<Link>>().await.map_err(|e| e.to_string())
    }

    pub async fn upsert_links(&self, links: &[Link]) -> Result<u32, String> {
        let resp = self.client
            .post(format!("{}/rest/v1/links", self.url))
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .header("Prefer", "resolution=merge-duplicates")
            .json(links)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        
        let result: Vec<Link> = resp.json().await.map_err(|e| e.to_string())?;
        Ok(result.len() as u32)
    }

    pub async fn delete_link(&self, id: &str) -> Result<(), String> {
        self.client
            .delete(format!("{}/rest/v1/links?id=eq.{}", self.url, id))
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
