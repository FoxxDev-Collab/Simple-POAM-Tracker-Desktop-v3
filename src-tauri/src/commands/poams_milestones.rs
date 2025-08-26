use tauri::AppHandle;
use crate::{database, models, Error};

// POAM commands

#[tauri::command]
pub async fn get_all_poams(app_handle: AppHandle, system_id: String) -> Result<Vec<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    Ok(poams)
}

#[tauri::command]
pub async fn get_poams(app_handle: AppHandle, system_id: String) -> Result<Vec<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    Ok(poams)
}

#[tauri::command]
pub async fn get_poam_by_id(app_handle: AppHandle, id: i64, system_id: String) -> Result<Option<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poam = db.get_poam_by_id(id, &system_id)?;
    Ok(poam)
}

#[tauri::command]
pub async fn update_poam(app_handle: AppHandle, poam: models::POAM, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.update_poam(&poam, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn create_poam(app_handle: AppHandle, poam: models::POAM, system_id: String) -> Result<(), Error> {
    println!("Received request to create POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.create_poam(&poam, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<(), Error> {
    println!("Deleting POAM: {}", poam_id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_poam(poam_id, &system_id)?;
    println!("Successfully deleted POAM");
    Ok(())
}

// Milestone commands

#[tauri::command]
pub async fn create_milestone(app_handle: AppHandle, milestone: models::Milestone, poam_id: i64, system_id: String) -> Result<(), Error> {
    println!("Creating milestone for POAM {}: {}", poam_id, milestone.title);
    let mut db = database::get_database(&app_handle)?;
    
    // Get the POAM to add the milestone to
    let mut poam = db.get_poam_by_id(poam_id, &system_id)?
        .ok_or_else(|| Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("POAM with id {} not found", poam_id)
        )))?;
    
    // Add the milestone to the POAM
    poam.milestones.push(milestone);
    
    // Update the POAM with the new milestone
    db.update_poam(&poam, &system_id)?;
    
    println!("Successfully created milestone");
    Ok(())
}

#[tauri::command]
pub async fn update_milestone_status(
    app_handle: AppHandle, 
    milestone_id: String, 
    poam_id: i64, 
    status: String, 
    system_id: String
) -> Result<(), Error> {
    println!("Updating milestone status: {} to {}", milestone_id, status);
    let mut db = database::get_database(&app_handle)?;
    db.update_milestone_status(&milestone_id, poam_id, &status, &system_id)?;
    println!("Successfully updated milestone status");
    Ok(())
}
