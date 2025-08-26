use tauri::AppHandle;
use crate::{database, models, Error};

// Group Management Commands

#[tauri::command]
pub async fn create_group(app_handle: AppHandle, group: models::SystemGroup) -> Result<(), Error> {
    println!("Creating group: {}", group.name);
    let mut db = database::get_database(&app_handle)?;
    db.create_group(&group)?;
    println!("Successfully created group: {}", group.name);
    Ok(())
}

#[tauri::command]
pub async fn get_all_groups(app_handle: AppHandle) -> Result<Vec<models::GroupSummary>, Error> {
    let db = database::get_database(&app_handle)?;
    let groups = db.get_all_groups()?;
    println!("Retrieved {} groups", groups.len());
    Ok(groups)
}

#[tauri::command]
pub async fn get_group_by_id(app_handle: AppHandle, id: String) -> Result<Option<models::SystemGroup>, Error> {
    let db = database::get_database(&app_handle)?;
    let group = db.get_group_by_id(&id)?;
    Ok(group)
}

#[tauri::command]
pub async fn update_group(app_handle: AppHandle, group: models::SystemGroup) -> Result<(), Error> {
    println!("Updating group: {}", group.name);
    let mut db = database::get_database(&app_handle)?;
    db.update_group(&group)?;
    println!("Successfully updated group: {}", group.name);
    Ok(())
}

#[tauri::command]
pub async fn delete_group(app_handle: AppHandle, id: String) -> Result<(), Error> {
    println!("Deleting group: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_group(&id)?;
    println!("Successfully deleted group: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn add_system_to_group(app_handle: AppHandle, group_id: String, system_id: String, added_by: Option<String>) -> Result<(), Error> {
    println!("Adding system {} to group {}", system_id, group_id);
    let mut db = database::get_database(&app_handle)?;
    db.add_system_to_group(&group_id, &system_id, added_by.as_deref())?;
    println!("Successfully added system to group");
    Ok(())
}

#[tauri::command]
pub async fn remove_system_from_group(app_handle: AppHandle, system_id: String) -> Result<(), Error> {
    println!("Removing system {} from group", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.remove_system_from_group(&system_id)?;
    println!("Successfully removed system from group");
    Ok(())
}

#[tauri::command]
pub async fn get_systems_in_group(app_handle: AppHandle, group_id: String) -> Result<Vec<models::SystemSummary>, Error> {
    let mut db = database::get_database(&app_handle)?;
    let systems = db.get_systems_in_group(&group_id)?;
    println!("Retrieved {} systems in group {}", systems.len(), group_id);
    Ok(systems)
}

#[tauri::command]
pub async fn get_ungrouped_systems(app_handle: AppHandle) -> Result<Vec<models::SystemSummary>, Error> {
    let mut db = database::get_database(&app_handle)?;
    let systems = db.get_ungrouped_systems()?;
    println!("Retrieved {} ungrouped systems", systems.len());
    Ok(systems)
}

#[tauri::command]
pub async fn reorder_systems_in_group(app_handle: AppHandle, group_id: String, system_orders: Vec<(String, i32)>) -> Result<(), Error> {
    println!("Reordering systems in group {}", group_id);
    let mut db = database::get_database(&app_handle)?;
    db.reorder_systems_in_group(&group_id, &system_orders)?;
    println!("Successfully reordered systems in group");
    Ok(())
}

// Group POAM API Commands

#[tauri::command]
pub async fn get_group_poams(app_handle: AppHandle, group_id: String) -> Result<Vec<models::GroupPOAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_group_poams(&group_id)?;
    println!("Retrieved {} group POAMs for group {}", poams.len(), group_id);
    Ok(poams)
}

#[tauri::command]
pub async fn get_group_poam_by_id(app_handle: AppHandle, id: i64) -> Result<Option<models::GroupPOAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poam = db.get_group_poam_by_id(id)?;
    Ok(poam)
}

#[tauri::command]
pub async fn create_group_poam(app_handle: AppHandle, poam: models::GroupPOAM) -> Result<(), Error> {
    println!("Creating group POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.create_group_poam(&poam)?;
    println!("Successfully created group POAM: {}", poam.title);
    Ok(())
}

#[tauri::command]
pub async fn update_group_poam(app_handle: AppHandle, poam: models::GroupPOAM) -> Result<(), Error> {
    println!("Updating group POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.update_group_poam(&poam)?;
    println!("Successfully updated group POAM: {}", poam.title);
    Ok(())
}

#[tauri::command]
pub async fn delete_group_poam(app_handle: AppHandle, id: i64) -> Result<(), Error> {
    println!("Deleting group POAM with id: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_group_poam(id)?;
    println!("Successfully deleted group POAM");
    Ok(())
}
