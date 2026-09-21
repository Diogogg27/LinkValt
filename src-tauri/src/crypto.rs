use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;

type AesKey = aes_gcm::Key<Aes256Gcm>;

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    general_purpose::STANDARD.encode(result)
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    hash_password(password) == hash
}

pub fn encrypt_data(data: &str, key: &str) -> Result<String, String> {
    let key_hash = hash_password(key);
    let key_bytes = general_purpose::STANDARD.decode(&key_hash).map_err(|e| e.to_string())?;
    let key = AesKey::from_slice(&key_bytes[..32]);
    let cipher = Aes256Gcm::new(key);
    
    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let encrypted = cipher.encrypt(nonce, data.as_bytes()).map_err(|e| e.to_string())?;
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&encrypted);
    Ok(general_purpose::STANDARD.encode(&result))
}

pub fn decrypt_data(encrypted_data: &str, key: &str) -> Result<String, String> {
    let key_hash = hash_password(key);
    let key_bytes = general_purpose::STANDARD.decode(&key_hash).map_err(|e| e.to_string())?;
    let key = AesKey::from_slice(&key_bytes[..32]);
    let cipher = Aes256Gcm::new(key);
    
    let data = general_purpose::STANDARD.decode(encrypted_data).map_err(|e| e.to_string())?;
    if data.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let nonce = Nonce::from_slice(&data[..12]);
    let decrypted = cipher.decrypt(nonce, &data[12..]).map_err(|e| e.to_string())?;
    String::from_utf8(decrypted).map_err(|e| e.to_string())
}
