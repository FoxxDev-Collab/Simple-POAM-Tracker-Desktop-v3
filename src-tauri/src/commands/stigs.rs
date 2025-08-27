use crate::{database, models, Error};
use tauri::AppHandle;
use std::fs;

// STIG File Management Commands

#[tauri::command]
pub async fn save_stig_file(app_handle: AppHandle, file_record: models::STIGFileRecord, checklist: serde_json::Value, system_id: String) -> Result<(), Error> {
    println!("Saving STIG file: {}", file_record.filename);
    let mut db = database::get_database(&app_handle)?;
    let mut stig_ops = database::stig_files::STIGFileOperations::new(&mut db.conn);
    stig_ops.save_stig_file(&file_record, &checklist, &system_id)?;
    println!("Successfully saved STIG file");
    Ok(())
}

#[tauri::command]
pub async fn get_all_stig_files(app_handle: AppHandle, system_id: String) -> Result<Vec<models::STIGFileRecord>, Error> {
    let db = database::get_database(&app_handle)?;
    let stig_queries = database::stig_files::STIGFileQueries::new(&db.conn);
    let files = stig_queries.get_all_stig_files(&system_id)?;
    println!("Retrieved {} STIG files", files.len());
    Ok(files)
}

#[tauri::command]
pub async fn get_stig_file_by_id(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<models::STIGFileRecord>, Error> {
    let db = database::get_database(&app_handle)?;
    let stig_queries = database::stig_files::STIGFileQueries::new(&db.conn);
    let file = stig_queries.get_stig_file_by_id(&id, &system_id)?;
    Ok(file)
}

#[tauri::command]
pub async fn get_stig_file_content(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<serde_json::Value>, Error> {
    let db = database::get_database(&app_handle)?;
    let stig_queries = database::stig_files::STIGFileQueries::new(&db.conn);
    let content = stig_queries.get_stig_file_content(&id, &system_id)?;
    Ok(content)
}

#[tauri::command]
pub async fn update_stig_file(app_handle: AppHandle, file_record: models::STIGFileRecord, system_id: String) -> Result<(), Error> {
    println!("Updating STIG file: {}", file_record.filename);
    let mut db = database::get_database(&app_handle)?;
    let mut stig_ops = database::stig_files::STIGFileOperations::new(&mut db.conn);
    stig_ops.update_stig_file(&file_record, &system_id)?;
    println!("Successfully updated STIG file");
    Ok(())
}

#[tauri::command]
pub async fn delete_stig_file(app_handle: AppHandle, id: String, system_id: String) -> Result<(), Error> {
    println!("Deleting STIG file: {}", id);
    let mut db = database::get_database(&app_handle)?;
    let mut stig_ops = database::stig_files::STIGFileOperations::new(&mut db.conn);
    stig_ops.delete_stig_file(&id, &system_id)?;
    println!("Successfully deleted STIG file");
    Ok(())
}

#[tauri::command]
pub async fn download_stig_file(app_handle: AppHandle, id: String, file_path: String, system_id: String) -> Result<(), Error> {
    println!("Downloading STIG file: {}", id);
    let db = database::get_database(&app_handle)?;
    let stig_queries = database::stig_files::STIGFileQueries::new(&db.conn);
    let content = stig_queries.get_stig_file_content(&id, &system_id)?;
    
    if let Some(checklist) = content {
        let xml_content = crate::stig::generate_ckl_xml(&serde_json::from_value(checklist)?)?;
        fs::write(file_path, xml_content)?;
        println!("Successfully downloaded STIG file");
    } else {
        return Err(Error::Database(database::DatabaseError::NotFound("STIG file not found".to_string())));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn update_stig_file_compliance(app_handle: AppHandle, id: String, compliance_summary: serde_json::Value, system_id: String) -> Result<(), Error> {
    println!("Updating STIG file compliance: {}", id);
    let mut db = database::get_database(&app_handle)?;
    let mut stig_ops = database::stig_files::STIGFileOperations::new(&mut db.conn);
    stig_ops.update_compliance(&id, &compliance_summary, &system_id)?;
    println!("Successfully updated STIG file compliance");
    Ok(())
}

#[tauri::command]
pub async fn update_stig_file_progress(app_handle: AppHandle, id: String, remediation_progress: serde_json::Value, system_id: String) -> Result<(), Error> {
    println!("Updating STIG file progress: {}", id);
    let mut db = database::get_database(&app_handle)?;
    let mut stig_ops = database::stig_files::STIGFileOperations::new(&mut db.conn);
    stig_ops.update_progress(&id, &remediation_progress, &system_id)?;
    println!("Successfully updated STIG file progress");
    Ok(())
}
