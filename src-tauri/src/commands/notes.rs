use tauri::AppHandle;
use crate::{database, models, Error};

#[tauri::command]
pub async fn get_all_notes(app_handle: AppHandle, system_id: String) -> Result<Vec<models::Note>, Error> {
    println!("Getting all notes from database");
    let db = database::get_database(&app_handle)?;
    let notes = db.get_all_notes(&system_id)?;
    println!("Retrieved {} notes with associations", notes.len());
    for note in &notes {
        if let Some(poam_ids) = &note.poam_ids {
            println!("Note {} has {} POAMs: {:?}", note.id, poam_ids.len(), poam_ids);
        }
    }
    Ok(notes)
}

#[tauri::command]
pub async fn get_notes(app_handle: AppHandle, system_id: String) -> Result<Vec<models::Note>, Error> {
    let db = database::get_database(&app_handle)?;
    let notes = db.get_all_notes(&system_id)?;
    Ok(notes)
}

#[tauri::command]
pub async fn get_notes_by_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<Vec<models::Note>, Error> {
    let db = database::get_database(&app_handle)?;
    let notes = db.get_notes_by_poam(poam_id, &system_id)?;
    Ok(notes)
}

#[tauri::command]
pub async fn create_note(app_handle: AppHandle, note: models::Note, system_id: String) -> Result<(), Error> {
    println!("Creating note with data: {:?}", note);
    println!("POAM IDs: {:?}", note.poam_ids);
    println!("POAM Titles: {:?}", note.poam_titles);
    
    let mut db = database::get_database(&app_handle)?;
    db.create_note(&note, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn update_note(app_handle: AppHandle, note: models::Note, system_id: String) -> Result<(), Error> {
    println!("Updating note with data: {:?}", note);
    println!("POAM IDs: {:?}", note.poam_ids);
    println!("POAM Titles: {:?}", note.poam_titles);
    
    let mut db = database::get_database(&app_handle)?;
    db.update_note(&note, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_note(app_handle: AppHandle, note_id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_note(&note_id, &system_id)?;
    Ok(())
}
