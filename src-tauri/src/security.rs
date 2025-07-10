use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, thiserror::Error)]
pub enum SecurityError {
    #[error("Failed to hash password: {0}")]
    HashError(String),
    
    #[error("Failed to verify password: {0}")]
    VerifyError(String),
    
    #[error("Failed to read password file: {0}")]
    ReadError(String),
    
    #[error("Failed to write password file: {0}")]
    WriteError(String),
    
    #[error("Invalid password")]
    InvalidPassword,
    
    #[error("App lock not configured")]
    NotConfigured,
}

impl serde::Serialize for SecurityError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub struct AppSecurity {
    app_handle: AppHandle,
}

impl AppSecurity {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    fn get_password_file_path(&self) -> Result<PathBuf, SecurityError> {
        let app_data_dir = self.app_handle
            .path()
            .app_data_dir()
            .map_err(|e| SecurityError::ReadError(e.to_string()))?;
        
        // Create directory if it doesn't exist
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| SecurityError::WriteError(e.to_string()))?;
        
        Ok(app_data_dir.join("app_lock.secure"))
    }

    pub fn hash_password(&self, password: &str) -> Result<String, SecurityError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| SecurityError::HashError(e.to_string()))?;
        
        Ok(password_hash.to_string())
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, SecurityError> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| SecurityError::VerifyError(e.to_string()))?;
        
        match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    pub fn store_password_hash(&self, hash: &str) -> Result<(), SecurityError> {
        let file_path = self.get_password_file_path()?;
        
        // Encode the hash in base64 for additional obfuscation
        let encoded_hash = general_purpose::STANDARD.encode(hash);
        
        fs::write(file_path, encoded_hash)
            .map_err(|e| SecurityError::WriteError(e.to_string()))?;
        
        Ok(())
    }

    pub fn get_stored_password_hash(&self) -> Result<String, SecurityError> {
        let file_path = self.get_password_file_path()?;
        
        if !file_path.exists() {
            return Err(SecurityError::NotConfigured);
        }
        
        let encoded_hash = fs::read_to_string(file_path)
            .map_err(|e| SecurityError::ReadError(e.to_string()))?;
        
        let hash = general_purpose::STANDARD
            .decode(&encoded_hash)
            .map_err(|e| SecurityError::ReadError(e.to_string()))?;
        
        String::from_utf8(hash)
            .map_err(|e| SecurityError::ReadError(e.to_string()))
    }

    pub fn is_app_lock_configured(&self) -> bool {
        self.get_password_file_path()
            .map(|path| path.exists())
            .unwrap_or(false)
    }

    pub fn remove_app_lock(&self) -> Result<(), SecurityError> {
        let file_path = self.get_password_file_path()?;
        
        if file_path.exists() {
            fs::remove_file(file_path)
                .map_err(|e| SecurityError::WriteError(e.to_string()))?;
        }
        
        Ok(())
    }

    pub fn setup_app_lock(&self, password: &str) -> Result<(), SecurityError> {
        let hash = self.hash_password(password)?;
        self.store_password_hash(&hash)?;
        Ok(())
    }

    pub fn verify_app_lock(&self, password: &str) -> Result<bool, SecurityError> {
        let stored_hash = self.get_stored_password_hash()?;
        self.verify_password(password, &stored_hash)
    }
} 