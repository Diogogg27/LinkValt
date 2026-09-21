use reqwest::Client;
use crate::models::LinkCheckResult;

pub async fn check_link(url: &str) -> LinkCheckResult {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_default();

    let result = client.get(url).send().await;
    let now = chrono::Utc::now().to_rfc3339();

    match result {
        Ok(response) => {
            let status = response.status().as_u16();
            let redirect = response.url().to_string();
            let is_broken = status >= 400;
            let had_redirect = redirect != url;
            
            LinkCheckResult {
                link_id: String::new(),
                url: url.to_string(),
                status_code: status,
                is_broken,
                redirect_url: if had_redirect { Some(redirect) } else { None },
                checked_at: now,
            }
        }
        Err(e) => {
            LinkCheckResult {
                link_id: String::new(),
                url: url.to_string(),
                status_code: 0,
                is_broken: true,
                redirect_url: None,
                checked_at: now,
            }
        }
    }
}

pub async fn check_all_links(links: Vec<crate::models::Link>) -> Vec<LinkCheckResult> {
    let mut results = Vec::new();
    for link in links {
        if link.status != "archived" {
            let mut result = check_link(&link.url).await;
            result.link_id = link.id.clone();
            results.push(result);
        }
    }
    results
}
