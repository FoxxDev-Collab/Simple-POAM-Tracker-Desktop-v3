use tauri::AppHandle;
use crate::{database, models, Error};

// System Management Commands

#[tauri::command]
pub async fn create_system(app_handle: AppHandle, system: models::System) -> Result<(), Error> {
    println!("Creating system: {}", system.name);
    let mut db = database::get_database(&app_handle)?;
    db.create_system(&system)?;
    println!("Successfully created system");
    Ok(())
}

#[tauri::command]
pub async fn get_all_systems(app_handle: AppHandle) -> Result<Vec<models::SystemSummary>, Error> {
    let db = database::get_database(&app_handle)?;
    let systems = db.get_all_systems()?;
    println!("Retrieved {} systems", systems.len());
    Ok(systems)
}

#[tauri::command]
pub async fn get_system_by_id(app_handle: AppHandle, id: String) -> Result<Option<models::System>, Error> {
    let db = database::get_database(&app_handle)?;
    let system = db.get_system_by_id(&id)?;
    Ok(system)
}

#[tauri::command]
pub async fn update_system(app_handle: AppHandle, system: models::System) -> Result<(), Error> {
    println!("Updating system: {}", system.name);
    let mut db = database::get_database(&app_handle)?;
    db.update_system(&system)?;
    println!("Successfully updated system");
    Ok(())
}

#[tauri::command]
pub async fn delete_system(app_handle: AppHandle, id: String) -> Result<(), Error> {
    println!("Deleting system: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_system(&id)?;
    println!("Successfully deleted system");
    Ok(())
}

#[tauri::command]
pub async fn set_active_system(app_handle: AppHandle, system_id: String) -> Result<(), Error> {
    println!("Setting active system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.update_system_last_accessed(&system_id)?;
    println!("Successfully set active system");
    Ok(())
}
