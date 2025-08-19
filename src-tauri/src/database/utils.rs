use crate::date_utils;
use rusqlite;
use std::sync::Mutex;
use tauri::AppHandle;
use thiserror::Error;

use super::Database;

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),

    #[error("Failed to get app directory: {0}")]
    AppDir(String),
    
    #[error("Failed to clear database: {0}")]
    ClearDatabase(String),

    #[error("Not Found: {0}")]
    NotFound(String),
}

// Function to normalize date formats for storage
pub fn normalize_date_format(date_str: &str) -> String {
    // Use the implementation from date_utils module
    date_utils::normalize_date_format(date_str)
}

// Store database connection in app state
pub static DB: once_cell::sync::Lazy<Mutex<Option<Database>>> = once_cell::sync::Lazy::new(|| {
    Mutex::new(None)
});

pub fn get_database(app_handle: &AppHandle) -> Result<Database, DatabaseError> {
    let mut db_guard = DB.lock().unwrap();
    
    if db_guard.is_none() {
        *db_guard = Some(Database::new(app_handle)?);
    }
    
    // We need to create a new connection for each thread
    Database::new(app_handle)
}
