// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use uuid;
use chrono;

mod database;
mod models;
mod security;
mod stig;
mod date_utils;
// Nessus DB helpers live under database::nessus; no top-level mod needed here

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    
    #[error(transparent)]
    Serde(#[from] serde_json::Error),
    
    #[error(transparent)]
    Database(#[from] database::DatabaseError),

    #[error(transparent)]
    Security(#[from] security::SecurityError),

    #[error(transparent)]
    Stig(#[from] stig::StigError),

    #[error(transparent)]
    Zip(#[from] zip::result::ZipError),
    #[error("Nessus parsing error: {0}")]
    Nessus(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
async fn import_nessus_files(app_handle: AppHandle, file_paths: Vec<String>, system_id: String) -> Result<String, Error> {
    use quick_xml::Reader;
    use quick_xml::events::Event;
    use serde_json::json;
    use uuid::Uuid;
    use chrono::Utc;
    println!("Importing {} Nessus files for system {}", file_paths.len(), system_id);

    let mut db = database::get_database(&app_handle)?;

    for file_path in file_paths {
        let content = fs::read_to_string(&file_path)?;
        let mut reader = Reader::from_str(&content);
        reader.config_mut().trim_text(true);

        // Basic counters and metadata
        let mut hosts = 0usize;
        let mut findings_count = 0usize;
        let mut current_host: Option<String> = None;
        let mut findings: Vec<database::nessus::NessusFinding> = Vec::new();

        // Simple, robust extraction of key fields
        let mut buf: Vec<u8> = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    match name.as_str() {
                        "ReportHost" => {
                            hosts += 1;
                            current_host = e
                                .attributes()
                                .filter_map(|a| a.ok())
                                .find(|a| a.key.as_ref() == b"name")
                                .and_then(|a| String::from_utf8(a.value.to_vec()).ok());
                        }
                        "ReportItem" => {
                            findings_count += 1;
                            // Capture a few attributes
                            let mut plugin_id: Option<i64> = None;
                            let mut port: Option<i64> = None;
                            let mut protocol: Option<String> = None;
                            let mut severity: Option<String> = None;
                            let mut plugin_name: Option<String> = None;
                            for attr in e.attributes().flatten() {
                                let key = attr.key.as_ref();
                                let val = String::from_utf8_lossy(&attr.value).to_string();
                                match key {
                                    b"pluginID" => plugin_id = val.parse::<i64>().ok(),
                                    b"port" => port = val.parse::<i64>().ok(),
                                    b"protocol" => protocol = Some(val),
                                    b"severity" => severity = Some(val),
                                    b"pluginName" => plugin_name = Some(val),
                                    _ => {}
                                }
                            }

                            // We will not parse inner text deeply now; store raw for future enrichment
                            let finding = database::nessus::NessusFinding {
                                id: Uuid::new_v4().to_string(),
                                scan_id: String::new(), // set after scan id is known
                                plugin_id,
                                plugin_name,
                                severity,
                                risk_factor: None,
                                cve: None,
                                cvss_base_score: None,
                                host: current_host.clone(),
                                port,
                                protocol,
                                synopsis: None,
                                description: None,
                                solution: None,
                                raw_json: json!({}),
                            };
                            findings.push(finding);
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(Error::Nessus(format!("Error parsing Nessus XML: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        // Build scan meta and save
        let scan_id = Uuid::new_v4().to_string();
        for f in &mut findings { f.scan_id = scan_id.clone(); }

        // Determine version: increment by name within system
        let existing_scans = {
            let queries = database::nessus::NessusQueries::new(&db.conn);
            queries.get_scans(&system_id)?
        };
        let scan_file_name = std::path::Path::new(&file_path).file_name().unwrap_or_default().to_string_lossy().to_string();
        let next_version = existing_scans.iter().filter(|s| s.name == scan_file_name).map(|s| s.version).max().unwrap_or(0) + 1;

        let scan_meta = database::nessus::NessusScanMeta {
            id: scan_id.clone(),
            name: scan_file_name,
            description: Some("Imported Nessus scan".to_string()),
            imported_date: Utc::now().to_rfc3339(),
            version: next_version as i32,
            source_file: Some(file_path.clone()),
            scan_info: json!({ "hosts": hosts, "findings": findings_count }),
        };

        db.save_nessus_scan_and_findings(&scan_meta, &findings, &system_id)?;
    }

    Ok("Nessus files imported".to_string())
}

#[tauri::command]
async fn get_nessus_scans(app_handle: AppHandle, system_id: String) -> Result<Vec<database::nessus::NessusScanMeta>, Error> {
    let mut db = database::get_database(&app_handle)?;
    let scans = db.get_nessus_scans(&system_id)?;
    Ok(scans)
}

#[tauri::command]
async fn get_nessus_findings_by_scan(app_handle: AppHandle, scan_id: String, system_id: String) -> Result<Vec<database::nessus::NessusFinding>, Error> {
    let db = database::get_database(&app_handle)?;
    let findings = db.get_nessus_findings_by_scan(&scan_id, &system_id)?;
    Ok(findings)
}

#[tauri::command]
async fn clear_nessus_data(app_handle: AppHandle, system_id: String) -> Result<String, Error> {
    println!("Clearing Nessus scans and findings for system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.clear_all_nessus_data_for_system(&system_id)?;
    Ok("Nessus data cleared".to_string())
}

#[tauri::command]
async fn clear_stig_data(app_handle: AppHandle, system_id: String) -> Result<String, Error> {
    println!("Clearing STIG mappings for system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.clear_stig_mappings_for_system(&system_id)?;
    Ok("STIG data cleared".to_string())
}

#[tauri::command]
async fn save_nessus_prep_list(app_handle: AppHandle, prep: database::nessus::NessusPrepList, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.save_nessus_prep_list(&prep, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn get_all_nessus_prep_lists(app_handle: AppHandle, system_id: String) -> Result<Vec<database::nessus::NessusPrepList>, Error> {
    let db = database::get_database(&app_handle)?;
    let lists = db.get_all_nessus_prep_lists(&system_id)?;
    Ok(lists)
}

#[tauri::command]
async fn delete_nessus_prep_list(app_handle: AppHandle, id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_nessus_prep_list(&id, &system_id)?;
    Ok(())
}
// removed deprecated greet

#[tauri::command]
async fn import_json_file(app_handle: AppHandle, file_path: String, system_id: String) -> Result<String, Error> {
    let file_content = fs::read_to_string(file_path)?;
    let data: models::POAMData = serde_json::from_str(&file_content)?;
    
    // Get database connection
    let mut db = database::get_database(&app_handle)?;
    
    // Import the data
    db.import_poam_data(&data, &system_id)?;
    
    Ok("Data imported successfully".to_string())
}

#[tauri::command]
async fn get_all_poams(app_handle: AppHandle, system_id: String) -> Result<Vec<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    Ok(poams)
}

#[tauri::command]
async fn get_poams(app_handle: AppHandle, system_id: String) -> Result<Vec<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    Ok(poams)
}

#[tauri::command]
async fn get_poam_by_id(app_handle: AppHandle, id: i64, system_id: String) -> Result<Option<models::POAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poam = db.get_poam_by_id(id, &system_id)?;
    Ok(poam)
}

#[tauri::command]
async fn update_poam(app_handle: AppHandle, poam: models::POAM, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.update_poam(&poam, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn create_poam(app_handle: AppHandle, poam: models::POAM, system_id: String) -> Result<(), Error> {
    println!("Received request to create POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.create_poam(&poam, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn export_data(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    let notes = db.get_all_notes(&system_id)?;
    
    let data = models::POAMData { 
        poams, 
        notes, 
        stig_mappings: None 
    };
    let json = serde_json::to_string_pretty(&data)?;
    
    fs::write(export_path, json)?;
    
    Ok("Data exported successfully".to_string())
}

#[tauri::command]
async fn select_file_path() -> Result<String, Error> {
    // Use a simple default path for now
    // In a real app, this would use platform-specific file dialogs
    Ok("C:\\temp\\poam_data.json".to_string())
}

#[tauri::command]
async fn select_save_path() -> Result<String, Error> {
    // Use a simple default path for now
    // In a real app, this would use platform-specific file dialogs
    Ok("C:\\temp\\poam_export.json".to_string())
}

#[tauri::command]
async fn clear_database(app_handle: AppHandle) -> Result<String, Error> {
    println!("Received request to clear database");
    
    match database::get_database(&app_handle) {
        Ok(mut db) => {
            match db.clear_database() {
                Ok(_) => {
                    println!("Database cleared successfully");
                    Ok("Database cleared successfully".to_string())
                },
                Err(e) => {
                    let error_msg = format!("Failed to clear database: {}", e);
                    println!("Error: {}", error_msg);
                    Err(Error::Database(e))
                }
            }
        },
        Err(e) => {
            let error_msg = format!("Failed to get database connection: {}", e);
            println!("Error: {}", error_msg);
            Err(Error::Database(e))
        }
    }
}

#[tauri::command]
async fn delete_database_file(app_handle: AppHandle) -> Result<String, Error> {
    println!("Received request to delete database file");
    
    // Make sure all database operations are completed
    tokio::task::spawn_blocking(move || {
        match database::Database::delete_database_file(&app_handle) {
            Ok(_) => {
                println!("Database file deleted successfully");
                Ok("Database file deleted successfully".to_string())
            },
            Err(e) => {
                let error_msg = format!("Failed to delete database file: {}", e);
                println!("Error: {}", error_msg);
                Err(Error::Database(e))
            }
        }
    }).await.unwrap_or_else(|e| {
        let error_msg = format!("Task error: {}", e);
        println!("{}", error_msg);
        Err(Error::Database(database::DatabaseError::ClearDatabase(error_msg)))
    })
}

#[tauri::command]
async fn get_all_notes(app_handle: AppHandle, system_id: String) -> Result<Vec<models::Note>, Error> {
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
async fn get_notes(app_handle: AppHandle, system_id: String) -> Result<Vec<models::Note>, Error> {
    let db = database::get_database(&app_handle)?;
    let notes = db.get_all_notes(&system_id)?;
    Ok(notes)
}

#[tauri::command]
async fn get_notes_by_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<Vec<models::Note>, Error> {
    let db = database::get_database(&app_handle)?;
    let notes = db.get_notes_by_poam(poam_id, &system_id)?;
    Ok(notes)
}

#[tauri::command]
async fn create_note(app_handle: AppHandle, note: models::Note, system_id: String) -> Result<(), Error> {
    println!("Creating note with data: {:?}", note);
    println!("POAM IDs: {:?}", note.poam_ids);
    println!("POAM Titles: {:?}", note.poam_titles);
    
    let mut db = database::get_database(&app_handle)?;
    db.create_note(&note, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn update_note(app_handle: AppHandle, note: models::Note, system_id: String) -> Result<(), Error> {
    println!("Updating note with data: {:?}", note);
    println!("POAM IDs: {:?}", note.poam_ids);
    println!("POAM Titles: {:?}", note.poam_titles);
    
    let mut db = database::get_database(&app_handle)?;
    db.update_note(&note, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn delete_note(app_handle: AppHandle, note_id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_note(&note_id, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), Error> {
    fs::write(path, content)?;
    Ok(())
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), Error> {
    let status = std::process::Command::new(if cfg!(target_os = "windows") { "cmd" } else { "open" })
        .args(if cfg!(target_os = "windows") { 
            vec!["/c", "start", "", path.as_str()] 
        } else { 
            vec![path.as_str()] 
        })
        .status()?;
    
    if !status.success() {
        return Err(Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to open file: {}", path)
        )));
    }
    
    Ok(())
}

// App Lock Security Commands

#[tauri::command]
async fn setup_app_lock(app_handle: AppHandle, password: String) -> Result<(), Error> {
    println!("Setting up app lock");
    let security = security::AppSecurity::new(app_handle);
    security.setup_app_lock(&password)?;
    Ok(())
}

#[tauri::command]
async fn verify_app_lock(app_handle: AppHandle, password: String) -> Result<bool, Error> {
    println!("Verifying app lock password");
    let security = security::AppSecurity::new(app_handle);
    let is_valid = security.verify_app_lock(&password)?;
    Ok(is_valid)
}

#[tauri::command]
async fn remove_app_lock(app_handle: AppHandle, password: String) -> Result<(), Error> {
    println!("Removing app lock");
    let security = security::AppSecurity::new(app_handle);
    
    // Verify the password before removing
    if !security.verify_app_lock(&password)? {
        return Err(Error::Security(security::SecurityError::InvalidPassword));
    }
    
    security.remove_app_lock()?;
    Ok(())
}

#[tauri::command]
async fn is_app_lock_configured(app_handle: AppHandle) -> Result<bool, Error> {
    let security = security::AppSecurity::new(app_handle);
    Ok(security.is_app_lock_configured())
}

// STIG Processing Commands

#[tauri::command]
async fn parse_cci_list_file(file_path: String) -> Result<Vec<stig::CCIMapping>, Error> {
    println!("Parsing CCI list file: {}", file_path);
    let mappings = stig::parse_cci_list(file_path)?;
    println!("Successfully parsed {} CCI mappings", mappings.len());
    Ok(mappings)
}

#[tauri::command]
async fn parse_stig_checklist_file(file_path: String) -> Result<stig::STIGChecklist, Error> {
    println!("Parsing STIG checklist file: {}", file_path);
    let checklist = stig::parse_stig_checklist(file_path)?;
    println!("Successfully parsed STIG checklist with {} vulnerabilities", checklist.vulnerabilities.len());
    Ok(checklist)
}

#[tauri::command]
async fn create_stig_mapping(
    checklist: stig::STIGChecklist,
    cci_mappings: Vec<stig::CCIMapping>
) -> Result<stig::STIGMappingResult, Error> {
    println!("Creating STIG to NIST mapping...");
    let result = stig::create_mapping_result(checklist, cci_mappings);
    println!("Successfully mapped {} NIST controls", result.summary.total_controls);
    Ok(result)
}

#[tauri::command]
async fn parse_multiple_stig_checklists(file_paths: Vec<String>) -> Result<stig::STIGChecklist, Error> {
    println!("Parsing {} STIG checklist files...", file_paths.len());
    let merged_checklist = stig::parse_and_merge_stig_checklists(file_paths)?;
    println!("Successfully parsed and merged {} vulnerabilities.", merged_checklist.vulnerabilities.len());
    Ok(merged_checklist)
}

#[tauri::command]
async fn save_stig_mapping(app_handle: AppHandle, mapping_data: models::STIGMappingData, system_id: String) -> Result<(), Error> {
    println!("Saving STIG mapping: {}", mapping_data.name);
    let mut db = database::get_database(&app_handle)?;
    db.save_stig_mapping(&mapping_data, &system_id)?;
    println!("Successfully saved STIG mapping");
    Ok(())
}

#[tauri::command]
async fn get_all_stig_mappings(app_handle: AppHandle, system_id: String) -> Result<Vec<models::STIGMappingData>, Error> {
    let db = database::get_database(&app_handle)?;
    let mappings = db.get_all_stig_mappings(&system_id)?;
    println!("Retrieved {} STIG mappings", mappings.len());
    Ok(mappings)
}

#[tauri::command]
async fn get_stig_mapping_by_id(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<models::STIGMappingData>, Error> {
    let db = database::get_database(&app_handle)?;
    let mapping = db.get_stig_mapping_by_id(&id, &system_id)?;
    Ok(mapping)
}

#[tauri::command]
async fn delete_stig_mapping(app_handle: AppHandle, id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_stig_mapping(&id, &system_id)?;
    println!("Deleted STIG mapping: {}", id);
    Ok(())
}

#[tauri::command]
async fn save_security_test_plan(app_handle: AppHandle, plan: models::SecurityTestPlan, system_id: String) -> Result<(), Error> {
    println!("Saving security test plan: {}", plan.name);
    let mut db = database::get_database(&app_handle)?;
    db.save_security_test_plan(&plan, &system_id)?;
    println!("Successfully saved security test plan");
    Ok(())
}

#[tauri::command]
async fn get_all_security_test_plans(app_handle: AppHandle, system_id: String) -> Result<Vec<models::SecurityTestPlan>, Error> {
    let db = database::get_database(&app_handle)?;
    let plans = db.get_all_security_test_plans(&system_id)?;
    println!("Retrieved {} security test plans", plans.len());
    Ok(plans)
}

#[tauri::command]
async fn get_security_test_plan_by_id(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<models::SecurityTestPlan>, Error> {
    let db = database::get_database(&app_handle)?;
    let plan = db.get_security_test_plan_by_id(&id, &system_id)?;
    Ok(plan)
}

#[tauri::command]
async fn delete_security_test_plan(app_handle: AppHandle, id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_security_test_plan(&id, &system_id)?;
    println!("Deleted security test plan: {}", id);
    Ok(())
}

#[tauri::command]
async fn get_test_plans_by_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<Vec<models::SecurityTestPlan>, Error> {
    let db = database::get_database(&app_handle)?;
    let plans = db.get_test_plans_by_poam(poam_id, &system_id)?;
    Ok(plans)
}

#[tauri::command]
async fn get_control_associations_by_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<Vec<models::ControlPOAMAssociation>, Error> {
    let db = database::get_database(&app_handle)?;
    let associations = db.get_control_poam_associations_by_poam(poam_id, &system_id)?;
    Ok(associations)
}

// Baseline Control Management Commands

#[tauri::command]
async fn get_baseline_controls(app_handle: AppHandle, system_id: String) -> Result<Vec<models::BaselineControl>, Error> {
    println!("Fetching baseline controls for system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    let controls = db.get_baseline_controls(&system_id)?;
    Ok(controls)
}

#[tauri::command]
async fn add_baseline_control(app_handle: AppHandle, control: models::BaselineControl, system_id: String) -> Result<(), Error> {
    println!("Adding baseline control: {} to system: {}", control.id, system_id);
    let mut db = database::get_database(&app_handle)?;
    
    // Make sure system_id is set correctly
    let mut control_to_add = control;
    control_to_add.system_id = system_id.clone();
    
    db.add_baseline_control(&control_to_add)?;
    Ok(())
}

#[tauri::command]
async fn update_baseline_control(app_handle: AppHandle, control: models::BaselineControl, system_id: String) -> Result<(), Error> {
    println!("Updating baseline control: {} for system: {}", control.id, system_id);
    let mut db = database::get_database(&app_handle)?;
    
    // Make sure system_id is set correctly
    let mut control_to_update = control;
    control_to_update.system_id = system_id.clone();
    
    db.update_baseline_control(&control_to_update)?;
    Ok(())
}

#[tauri::command]
async fn remove_baseline_control(app_handle: AppHandle, control_id: String, system_id: String) -> Result<(), Error> {
    println!("Removing baseline control: {} from system: {}", control_id, system_id);
    let mut db = database::get_database(&app_handle)?;
    db.remove_baseline_control(&control_id, &system_id)?;
    Ok(())
}

#[tauri::command]
async fn export_data_with_stig(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_all_poams(&system_id)?;
    let notes = db.get_all_notes(&system_id)?;
    let stig_mappings = db.get_all_stig_mappings(&system_id)?;
    
    let data = models::POAMData { 
        poams, 
        notes, 
        stig_mappings: Some(stig_mappings) 
    };
    let json = serde_json::to_string_pretty(&data)?;
    
    fs::write(export_path, json)?;
    
    Ok("Data exported successfully with STIG mappings".to_string())
}

#[tauri::command]
async fn import_json_file_with_stig(app_handle: AppHandle, file_path: String, system_id: String) -> Result<String, Error> {
    let file_content = fs::read_to_string(file_path)?;
    let data: models::POAMData = serde_json::from_str(&file_content)?;
    
    // Get database connection
    let mut db = database::get_database(&app_handle)?;
    
    // Import POAMs and notes (existing functionality)
    db.import_poam_data(&data, &system_id)?;
    
    // Import STIG mappings if present
    if let Some(stig_mappings) = &data.stig_mappings {
        for mapping in stig_mappings {
            db.save_stig_mapping(mapping, &system_id)?;
        }
        println!("Imported {} STIG mappings", stig_mappings.len());
    }
    
    Ok("Data imported successfully including STIG mappings".to_string())
}

#[tauri::command]
async fn export_security_test_plans(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
    let db = database::get_database(&app_handle)?;
    let test_plans = db.get_all_security_test_plans(&system_id)?;
    
    let export_data = serde_json::json!({
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "export_type": "security_test_plans",
        "version": "1.0",
        "test_plans": test_plans
    });
    
    let json = serde_json::to_string_pretty(&export_data)?;
    fs::write(export_path, json)?;
    
    Ok("Security test plans exported successfully".to_string())
}

#[tauri::command]
async fn export_json_data(file_path: String, data: String) -> Result<(), Error> {
    println!("Exporting JSON data to: {}", file_path);
    fs::write(file_path, data)?;
    println!("JSON export completed successfully");
    Ok(())
}

#[tauri::command]
async fn export_updated_checklist(file_path: String, checklist: stig::STIGChecklist) -> Result<(), Error> {
    println!("Exporting updated checklist to: {}", file_path);
    
    // Generate the updated .ckl XML content
    let xml_content = stig::generate_ckl_xml(&checklist)?;
    
    // Write the XML to file
    fs::write(file_path, xml_content)?;
    println!("Checklist export completed successfully");
    Ok(())
}

// Evidence file handling commands
#[tauri::command]
async fn copy_evidence_files(
    app_handle: AppHandle, 
    plan_id: String, 
    test_case_id: String, 
    file_paths: Vec<String>
) -> Result<Vec<String>, Error> {
    println!("Copying {} evidence files for test case {} in plan {}", file_paths.len(), test_case_id, plan_id);
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Create evidence directory structure
    let evidence_dir = app_data_dir.join("evidence").join(&plan_id).join(&test_case_id);
    fs::create_dir_all(&evidence_dir)?;
    
    let mut copied_files = Vec::new();
    
    for file_path in file_paths {
        if let Some(file_name) = std::path::Path::new(&file_path).file_name() {
            let dest_path = evidence_dir.join(file_name);
            
            // Copy the file
            fs::copy(&file_path, &dest_path)?;
            
            // Store relative path for database
            let relative_path = format!("evidence/{}/{}/{}", plan_id, test_case_id, file_name.to_string_lossy());
            copied_files.push(relative_path);
            
            println!("Copied {} to {}", file_path, dest_path.display());
        }
    }
    
    Ok(copied_files)
}

#[tauri::command]
async fn delete_evidence_file(
    app_handle: AppHandle, 
    plan_id: String, 
    test_case_id: String, 
    file_name: String
) -> Result<(), Error> {
    println!("Deleting evidence file {} for test case {} in plan {}", file_name, test_case_id, plan_id);
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    let file_path = app_data_dir.join("evidence").join(&plan_id).join(&test_case_id).join(&file_name);
    
    if file_path.exists() {
        fs::remove_file(&file_path)?;
        println!("Deleted evidence file: {}", file_path.display());
    }
    
    Ok(())
}

#[tauri::command]
async fn export_evidence_package(
    app_handle: AppHandle, 
    export_path: String, 
    test_plan: models::SecurityTestPlan
) -> Result<(), Error> {
    println!("Exporting evidence package for test plan: {}", test_plan.name);
    
    use std::io::Write;
    use zip::write::FileOptions;
    
    let file = fs::File::create(&export_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Add test plan JSON
    let test_plan_json = serde_json::to_string_pretty(&test_plan)?;
    zip.start_file("test_plan.json", FileOptions::default())?;
    zip.write_all(test_plan_json.as_bytes())?;
    
    // Create evidence manifest
    let mut manifest = Vec::new();
    manifest.push("# Evidence Package Manifest".to_string());
    manifest.push(format!("Test Plan: {}", test_plan.name));
    manifest.push(format!("Description: {}", test_plan.description.unwrap_or_default()));
    manifest.push(format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
    manifest.push("".to_string());
    manifest.push("## Test Cases and Evidence:".to_string());
    
    // Add evidence files for each test case
    for test_case in &test_plan.test_cases {
        manifest.push(format!("\n### {} - {}", test_case.nist_control, test_case.test_description));
        manifest.push(format!("Status: {}", test_case.status));
        
        if let Some(evidence_files) = &test_case.evidence_files {
            if evidence_files.is_empty() {
                manifest.push("Evidence: None".to_string());
            } else {
                manifest.push(format!("Evidence: {} file(s)", evidence_files.len()));
                
                for evidence_file in evidence_files {
                    let source_path = app_data_dir.join(evidence_file);
                    
                    if source_path.exists() {
                        // Add file to zip
                        let zip_path = format!("evidence/{}/{}", test_case.nist_control, 
                            source_path.file_name().unwrap().to_string_lossy());
                        
                        zip.start_file(&zip_path, FileOptions::default())?;
                        let file_content = fs::read(&source_path)?;
                        zip.write_all(&file_content)?;
                        
                        manifest.push(format!("  - {}", zip_path));
                    }
                }
            }
        } else {
            manifest.push("Evidence: None".to_string());
        }
        
        if let Some(actual_result) = &test_case.actual_result {
            if !actual_result.is_empty() {
                manifest.push(format!("Results: {}", actual_result));
            }
        }
        
        if let Some(notes) = &test_case.notes {
            if !notes.is_empty() {
                manifest.push(format!("Notes: {}", notes));
            }
        }
    }
    
    // Add manifest to zip
    zip.start_file("EVIDENCE_MANIFEST.md", FileOptions::default())?;
    zip.write_all(manifest.join("\n").as_bytes())?;
    
    // Create summary report
    let completed_tests = test_plan.test_cases.iter()
        .filter(|tc| matches!(tc.status.as_str(), "Passed" | "Failed" | "Not Applicable"))
        .count();
    let tests_with_evidence = test_plan.test_cases.iter()
        .filter(|tc| tc.evidence_files.as_ref().map_or(false, |files| !files.is_empty()))
        .count();
    
    let summary = format!(
        "# Security Test Plan Summary\n\n\
        Test Plan: {}\n\
        Total Test Cases: {}\n\
        Completed Tests: {} ({:.1}%)\n\
        Tests with Evidence: {} ({:.1}%)\n\
        Generated: {}\n\n\
        This package contains all test results and supporting evidence files \
        for compliance assessment and audit purposes.",
        test_plan.name,
        test_plan.test_cases.len(),
        completed_tests,
        if test_plan.test_cases.is_empty() { 0.0 } else { 
            (completed_tests as f64 / test_plan.test_cases.len() as f64) * 100.0 
        },
        tests_with_evidence,
        if test_plan.test_cases.is_empty() { 0.0 } else { 
            (tests_with_evidence as f64 / test_plan.test_cases.len() as f64) * 100.0 
        },
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );
    
    zip.start_file("SUMMARY.md", FileOptions::default())?;
    zip.write_all(summary.as_bytes())?;
    
    zip.finish()?;
    
    println!("Evidence package exported to: {}", export_path);
    Ok(())
}

#[tauri::command]
async fn open_file_with_default_app(file_path: String) -> Result<(), Error> {
    println!("Opening file with default app: {}", file_path);
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()?;
    }
    
    Ok(())
}

#[tauri::command]
async fn associate_poam_with_control(
    app_handle: AppHandle, 
    control_id: String, 
    poam_id: i64, 
    system_id: String,
    created_by: Option<String>,
    notes: Option<String>
) -> Result<String, Error> {
    println!("Associating POAM {} with control {}", poam_id, control_id);
    
    let mut db = database::get_database(&app_handle)?;
    let association_id = db.create_control_poam_association(
        &control_id, 
        poam_id, 
        &system_id,
        created_by.as_deref(),
        notes.as_deref()
    )?;
    
    Ok(association_id)
}

#[tauri::command]
async fn remove_poam_control_association(
    app_handle: AppHandle, 
    association_id: String, 
    system_id: String
) -> Result<String, Error> {
    println!("Removing POAM-control association: {}", association_id);
    
    let mut db = database::get_database(&app_handle)?;
    db.delete_control_poam_association(&association_id, &system_id)?;
    
    Ok("Association removed successfully".to_string())
}

#[tauri::command]
async fn get_poam_associations_by_control(
    app_handle: AppHandle, 
    control_id: String, 
    system_id: String
) -> Result<Vec<models::ControlPOAMAssociation>, Error> {
    println!("Getting POAM associations for control: {}", control_id);
    
    let db = database::get_database(&app_handle)?;
    let associations = db.get_control_poam_associations_by_control(&control_id, &system_id)?;
    
    Ok(associations)
}


#[tauri::command]
async fn import_security_test_plans(app_handle: AppHandle, file_path: String, system_id: String) -> Result<String, Error> {
    let file_content = fs::read_to_string(file_path)?;
    let import_data: serde_json::Value = serde_json::from_str(&file_content)?;
    
    // Validate the import data structure
    let test_plans = import_data["test_plans"].as_array()
        .ok_or_else(|| Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Invalid file format. Expected test_plans array."
        )))?;
    
    let mut db = database::get_database(&app_handle)?;
    let mut imported_count = 0;
    
    for plan_value in test_plans {
        // Parse the test plan and generate new IDs to avoid conflicts
        let mut plan: models::SecurityTestPlan = serde_json::from_value(plan_value.clone())?;
        
        // Generate new IDs
        plan.id = uuid::Uuid::new_v4().to_string();
        plan.created_date = chrono::Utc::now().to_rfc3339();
        plan.updated_date = chrono::Utc::now().to_rfc3339();
        
        // Generate new IDs for test cases
        for test_case in &mut plan.test_cases {
            test_case.id = uuid::Uuid::new_v4().to_string();
        }
        
        db.save_security_test_plan(&plan, &system_id)?;
        imported_count += 1;
    }
    
    Ok(format!("Successfully imported {} security test plans", imported_count))
}

#[tauri::command]
async fn import_evidence_package(app_handle: AppHandle, zip_file_path: String, system_id: String) -> Result<String, Error> {
    use std::io::Read;
    use zip::read::ZipArchive;
    
    println!("Importing evidence package from: {}", zip_file_path);
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Create temp directory for extraction
    let temp_dir = app_data_dir.join("temp_import");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    fs::create_dir_all(&temp_dir)?;
    
    // Open and read the ZIP file
    let zip_file = fs::File::open(&zip_file_path)?;
    let mut archive = ZipArchive::new(zip_file)?;
    
    let mut test_plan_json: Option<String> = None;
    let mut evidence_files: Vec<(String, String)> = Vec::new(); // (zip_path, file_name)
    
    // Extract all files and identify test_plan.json and evidence files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_path = file.name().to_string();
        
        println!("Processing ZIP entry: {}", file_path);
        
        if file_path == "test_plan.json" {
            // Read test plan JSON
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            test_plan_json = Some(content);
            println!("Found test_plan.json");
        } else if file_path.starts_with("evidence/") && !file_path.ends_with('/') {
            // Extract evidence file to temp directory
            let local_path = temp_dir.join(&file_path);
            if let Some(parent) = local_path.parent() {
                fs::create_dir_all(parent)?;
            }
            
            let mut output_file = fs::File::create(&local_path)?;
            std::io::copy(&mut file, &mut output_file)?;
            
            evidence_files.push((file_path.clone(), local_path.to_string_lossy().to_string()));
            println!("Extracted evidence file: {}", file_path);
        }
    }
    
    // Validate that we have a test plan
    let test_plan_content = test_plan_json.ok_or_else(|| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "No test_plan.json found in ZIP package"
        ))
    })?;
    
    // Parse the test plan
    let mut test_plan: models::SecurityTestPlan = serde_json::from_str(&test_plan_content)?;
    
    // Generate new IDs to avoid conflicts
    let old_plan_id = test_plan.id.clone();
    test_plan.id = uuid::Uuid::new_v4().to_string();
    test_plan.created_date = chrono::Utc::now().to_rfc3339();
    test_plan.updated_date = chrono::Utc::now().to_rfc3339();
    
    println!("Processing test plan: {} (old ID: {}, new ID: {})", test_plan.name, old_plan_id, test_plan.id);
    
    // Create evidence directory for the new plan
    let evidence_base_dir = app_data_dir.join("evidence").join(&test_plan.id);
    fs::create_dir_all(&evidence_base_dir)?;
    
    // Map old test case IDs to new ones and copy evidence files
    let mut test_case_id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    
    for test_case in &mut test_plan.test_cases {
        let old_test_case_id = test_case.id.clone();
        let new_test_case_id = uuid::Uuid::new_v4().to_string();
        test_case.id = new_test_case_id.clone();
        test_case_id_map.insert(old_test_case_id, new_test_case_id);
    }
    
    // Copy evidence files to proper locations and update file paths
    for test_case in &mut test_plan.test_cases {
        if let Some(ref mut evidence_file_paths) = test_case.evidence_files {
            let mut new_evidence_paths = Vec::new();
            
            for evidence_path in evidence_file_paths.iter() {
                // Find the corresponding extracted file
                let evidence_filename = evidence_path.split('/').last().unwrap_or("");
                let mut found_file = false;
                
                for (zip_path, temp_file_path) in &evidence_files {
                    if zip_path.contains(evidence_filename) {
                        // Create test case evidence directory
                        let test_case_evidence_dir = evidence_base_dir.join(&test_case.id);
                        fs::create_dir_all(&test_case_evidence_dir)?;
                        
                        // Copy file to proper location
                        let final_path = test_case_evidence_dir.join(evidence_filename);
                        fs::copy(temp_file_path, &final_path)?;
                        
                        // Update path to be relative from app data dir
                        let relative_path = format!("evidence/{}/{}/{}", 
                            test_plan.id, test_case.id, evidence_filename);
                        new_evidence_paths.push(relative_path);
                        
                        println!("Copied evidence file: {} -> {}", zip_path, final_path.display());
                        found_file = true;
                        break;
                    }
                }
                
                if !found_file {
                    println!("Warning: Evidence file not found in ZIP: {}", evidence_path);
                }
            }
            
            *evidence_file_paths = new_evidence_paths;
        }
    }
    
    // Save the test plan to database
    let mut db = database::get_database(&app_handle)?;
    db.save_security_test_plan(&test_plan, &system_id)?;
    
    // Clean up temp directory
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    
    println!("Successfully imported evidence package: {}", test_plan.name);
    println!("Total evidence files imported: {}", evidence_files.len());
    
    Ok(format!("Successfully imported test plan '{}' with {} evidence files", 
        test_plan.name, evidence_files.len()))
}

// STP Prep List Commands
#[tauri::command]
async fn save_stp_prep_list(app_handle: AppHandle, prep_list: models::StpPrepList, system_id: String) -> Result<(), Error> {
    println!("Saving STP prep list: {}", prep_list.name);
    let mut db = database::get_database(&app_handle)?;
    db.save_stp_prep_list(&prep_list, &system_id)?;
    println!("Successfully saved STP prep list");
    Ok(())
}

// System Management Commands
#[tauri::command]
async fn create_system(app_handle: AppHandle, system: models::System) -> Result<(), Error> {
    println!("Creating system: {}", system.name);
    let mut db = database::get_database(&app_handle)?;
    db.create_system(&system)?;
    println!("Successfully created system");
    Ok(())
}

#[tauri::command]
async fn get_all_systems(app_handle: AppHandle) -> Result<Vec<models::SystemSummary>, Error> {
    let db = database::get_database(&app_handle)?;
    let systems = db.get_all_systems()?;
    println!("Retrieved {} systems", systems.len());
    Ok(systems)
}

#[tauri::command]
async fn get_system_by_id(app_handle: AppHandle, id: String) -> Result<Option<models::System>, Error> {
    let db = database::get_database(&app_handle)?;
    let system = db.get_system_by_id(&id)?;
    Ok(system)
}

#[tauri::command]
async fn update_system(app_handle: AppHandle, system: models::System) -> Result<(), Error> {
    println!("Updating system: {}", system.name);
    let mut db = database::get_database(&app_handle)?;
    db.update_system(&system)?;
    println!("Successfully updated system");
    Ok(())
}

#[tauri::command]
async fn delete_system(app_handle: AppHandle, id: String) -> Result<(), Error> {
    println!("Deleting system: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_system(&id)?;
    println!("Successfully deleted system");
    Ok(())
}

#[tauri::command]
async fn set_active_system(app_handle: AppHandle, system_id: String) -> Result<(), Error> {
    println!("Setting active system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.update_system_last_accessed(&system_id)?;
    
    // Store the active system in app state or local storage (we'll use frontend for this)
    println!("Successfully set active system");
    Ok(())
}

#[tauri::command]
async fn get_all_stp_prep_lists(app_handle: AppHandle, system_id: String) -> Result<Vec<models::StpPrepList>, Error> {
    let db = database::get_database(&app_handle)?;
    let prep_lists = db.get_all_stp_prep_lists(&system_id)?;
    println!("Retrieved {} STP prep lists", prep_lists.len());
    Ok(prep_lists)
}

#[tauri::command]
async fn get_stp_prep_list_by_id(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<models::StpPrepList>, Error> {
    let db = database::get_database(&app_handle)?;
    let prep_list = db.get_stp_prep_list_by_id(&id, &system_id)?;
    Ok(prep_list)
}

#[tauri::command]
async fn delete_stp_prep_list(app_handle: AppHandle, id: String, system_id: String) -> Result<(), Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_stp_prep_list(&id, &system_id)?;
    println!("Deleted STP prep list: {}", id);
    Ok(())
}

#[tauri::command]
async fn update_stp_prep_list(app_handle: AppHandle, prep_data: models::StpPrepList, system_id: String) -> Result<(), Error> {
    println!("Updating STP prep list: {}", prep_data.name);
    let mut db = database::get_database(&app_handle)?;
    // Update the updated_date to current time
    let mut updated_prep_data = prep_data;
    updated_prep_data.updated_date = chrono::Utc::now().to_rfc3339();
    db.save_stp_prep_list(&updated_prep_data, &system_id)?;
    println!("Successfully updated STP prep list");
    Ok(())
}

#[tauri::command]
async fn get_stp_prep_lists_by_source_mapping(app_handle: AppHandle, source_mapping_id: String, system_id: String) -> Result<Vec<models::StpPrepList>, Error> {
    let db = database::get_database(&app_handle)?;
    let prep_lists = db.get_stp_prep_lists_by_source_mapping(&source_mapping_id, &system_id)?;
    println!("Retrieved {} STP prep lists for mapping {}", prep_lists.len(), source_mapping_id);
    Ok(prep_lists)
}

#[tauri::command]
async fn export_complete_system_backup(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
    use std::io::Write;
    use zip::write::FileOptions;
    
    println!("Creating complete system backup for system: {}", system_id);
    
    let mut db = database::get_database(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Get system information
    let system = db.get_system_by_id(&system_id)?
        .ok_or_else(|| Error::Database(database::DatabaseError::ClearDatabase("System not found".to_string())))?;
    
    // Get all data for the system
    let poams = db.get_all_poams(&system_id)?;
    let notes = db.get_all_notes(&system_id)?;
    let stig_mappings = db.get_all_stig_mappings(&system_id)?;
    let test_plans = db.get_all_security_test_plans(&system_id)?;
    let prep_lists = db.get_all_stp_prep_lists(&system_id)?;
    let baseline_controls = db.get_baseline_controls(&system_id)?;
    let mut poam_control_associations = Vec::new();
    for poam in &poams {
        let mut associations = db.get_control_poam_associations_by_poam(poam.id, &system_id)?;
        poam_control_associations.append(&mut associations);
    }
    
    // Create export data structure
    let export_data = models::SystemExportData {
        system: system.clone(),
        poams,
        notes,
        stig_mappings: if stig_mappings.is_empty() { None } else { Some(stig_mappings) },
        test_plans: if test_plans.is_empty() { None } else { Some(test_plans.clone()) },
        prep_lists: if prep_lists.is_empty() { None } else { Some(prep_lists) },
        baseline_controls: if baseline_controls.is_empty() { None } else { Some(baseline_controls) },
        poam_control_associations: if poam_control_associations.is_empty() { None } else { Some(poam_control_associations) },
        export_date: chrono::Utc::now().to_rfc3339(),
        export_version: "2.1".to_string(), // Updated version to indicate ZIP format with files
    };
    
    // Create ZIP file
    let file = fs::File::create(&export_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    // Add system backup JSON to ZIP
    let json = serde_json::to_string_pretty(&export_data)?;
    zip.start_file("system_backup.json", FileOptions::default())?;
    zip.write_all(json.as_bytes())?;
    
    // Collect evidence files from all test plans
    let mut total_evidence_files = 0;
    let mut evidence_file_count_by_plan: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    
    for test_plan in &test_plans {
        let mut plan_file_count = 0;
        
        for test_case in &test_plan.test_cases {
            if let Some(evidence_files) = &test_case.evidence_files {
                for evidence_file in evidence_files {
                    let source_path = app_data_dir.join(evidence_file);
                    
                    if source_path.exists() {
                        // Create organized directory structure in ZIP
                        let zip_path = format!("evidence/{}/{}/{}", 
                            test_plan.name.replace("/", "_").replace("\\", "_"), // Sanitize plan name for file path
                            test_case.nist_control.replace("/", "_").replace("\\", "_"), // Sanitize control name
                            source_path.file_name().unwrap().to_string_lossy()
                        );
                        
                        zip.start_file(&zip_path, FileOptions::default())?;
                        let file_content = fs::read(&source_path)?;
                        zip.write_all(&file_content)?;
                        
                        total_evidence_files += 1;
                        plan_file_count += 1;
                        
                        println!("Added evidence file to backup: {}", zip_path);
                    } else {
                        println!("Warning: Evidence file not found: {}", evidence_file);
                    }
                }
            }
        }
        
        if plan_file_count > 0 {
            evidence_file_count_by_plan.insert(test_plan.name.clone(), plan_file_count);
        }
    }
    
    // Create comprehensive backup manifest
    let mut manifest = Vec::new();
    manifest.push("# Complete System Backup Manifest".to_string());
    manifest.push(format!("System: {}", system.name));
    manifest.push(format!("Description: {}", system.description.as_deref().unwrap_or("No description")));
    manifest.push(format!("Backup Date: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
    manifest.push(format!("Export Version: 2.1 (ZIP format with evidence files)"));
    manifest.push("".to_string());
    
    // Data summary
    manifest.push("## Data Summary:".to_string());
    manifest.push(format!("- POAMs: {}", export_data.poams.len()));
    manifest.push(format!("- Notes: {}", export_data.notes.len()));
    manifest.push(format!("- STIG Mappings: {}", export_data.stig_mappings.as_ref().map_or(0, |v| v.len())));
    manifest.push(format!("- Security Test Plans: {}", test_plans.len()));
    manifest.push(format!("- STP Prep Lists: {}", export_data.prep_lists.as_ref().map_or(0, |v| v.len())));
    manifest.push(format!("- Baseline Controls: {}", export_data.baseline_controls.as_ref().map_or(0, |v| v.len())));
    manifest.push(format!("- POAM/Control Associations: {}", export_data.poam_control_associations.as_ref().map_or(0, |v| v.len())));
    manifest.push(format!("- Evidence Files: {}", total_evidence_files));
    manifest.push("".to_string());
    
    // Evidence files by test plan
    if !evidence_file_count_by_plan.is_empty() {
        manifest.push("## Evidence Files by Test Plan:".to_string());
        for (plan_name, file_count) in &evidence_file_count_by_plan {
            manifest.push(format!("- {}: {} files", plan_name, file_count));
        }
        manifest.push("".to_string());
    }
    
    // File structure
    manifest.push("## Backup Structure:".to_string());
    manifest.push("```".to_string());
    manifest.push("system_backup.json          # Complete system metadata and configuration".to_string());
    manifest.push("evidence/                   # Evidence files organized by test plan and control".to_string());
    for plan_name in evidence_file_count_by_plan.keys() {
        let sanitized_name = plan_name.replace("/", "_").replace("\\", "_");
        manifest.push(format!("  {}/                 # Evidence for {}", sanitized_name, plan_name));
    }
    manifest.push("BACKUP_MANIFEST.md          # This file".to_string());
    manifest.push("```".to_string());
    manifest.push("".to_string());
    
    manifest.push("## Import Instructions:".to_string());
    manifest.push("1. Use the 'Import System Backup' feature in the System Selector".to_string());
    manifest.push("2. Select this ZIP file to restore the complete system with all evidence files".to_string());
    manifest.push("3. The system will be imported with a new unique ID to avoid conflicts".to_string());
    manifest.push("4. All evidence files will be properly restored and linked to their test cases".to_string());
    
    // Add manifest to ZIP
    zip.start_file("BACKUP_MANIFEST.md", FileOptions::default())?;
    zip.write_all(manifest.join("\n").as_bytes())?;
    
    // Create system summary
    let summary = format!(
        "# {} - Complete System Backup\n\n\
        **Backup Date:** {}\n\
        **System Description:** {}\n\
        **Export Version:** 2.1 (ZIP format with evidence files)\n\n\
        ## Contents\n\
        - {} POAMs\n\
        - {} Notes\n\
        - {} STIG Mappings\n\
        - {} Security Test Plans\n\
        - {} STP Prep Lists\n\
        - {} Baseline Controls\n\
        - {} POAM/Control Associations\n\
        - {} Evidence Files\n\n\
        This is a complete system backup that includes all metadata, configurations, \
        and evidence files. Import this ZIP file to restore the entire system with \
        full data integrity and evidence preservation.",
        system.name,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
        system.description.as_deref().unwrap_or("No description"),
        export_data.poams.len(),
        export_data.notes.len(),
        export_data.stig_mappings.as_ref().map_or(0, |v| v.len()),
        test_plans.len(),
        export_data.prep_lists.as_ref().map_or(0, |v| v.len()),
        export_data.baseline_controls.as_ref().map_or(0, |v| v.len()),
        export_data.poam_control_associations.as_ref().map_or(0, |v| v.len()),
        total_evidence_files
    );
    
    zip.start_file("SYSTEM_SUMMARY.md", FileOptions::default())?;
    zip.write_all(summary.as_bytes())?;
    
    zip.finish()?;
    
    let result_message = format!(
        "Complete system backup exported successfully!\n\
        System: {}\n\
        Data exported: {} POAMs, {} notes, {} STIG mappings, {} test plans, {} prep lists, {} baseline controls, {} POAM/Control Associations\n\
        Evidence files: {} files included\n\
        Format: ZIP archive with JSON metadata and all evidence files",
        system.name,
        export_data.poams.len(),
        export_data.notes.len(),
        export_data.stig_mappings.as_ref().map_or(0, |v| v.len()),
        test_plans.len(),
        export_data.prep_lists.as_ref().map_or(0, |v| v.len()),
        export_data.baseline_controls.as_ref().map_or(0, |v| v.len()),
        export_data.poam_control_associations.as_ref().map_or(0, |v| v.len()),
        total_evidence_files
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

#[tauri::command]
async fn import_system_backup(app_handle: AppHandle, file_path: String) -> Result<serde_json::Value, Error> {
    use std::io::Read;
    use zip::read::ZipArchive;
    
    println!("Importing system backup from: {}", file_path);
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Try to determine if this is a ZIP file or JSON file
    let backup_data: models::SystemExportData;
    let mut evidence_files: Vec<(String, String)> = Vec::new(); // (zip_path, temp_file_path)
    let mut total_evidence_files = 0;
    
    if file_path.to_lowercase().ends_with(".zip") {
        println!("Detected ZIP format system backup");
        
        // Create temp directory for extraction
        let temp_dir = app_data_dir.join("temp_system_import");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)?;
        }
        fs::create_dir_all(&temp_dir)?;
        
        // Open and read the ZIP file
        let zip_file = fs::File::open(&file_path)?;
        let mut archive = ZipArchive::new(zip_file)?;
        
        let mut system_json: Option<String> = None;
        
        // Extract all files and identify system_backup.json and evidence files
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_path_in_zip = file.name().to_string();
            
            println!("Processing ZIP entry: {}", file_path_in_zip);
            
            if file_path_in_zip == "system_backup.json" {
                // Read system backup JSON
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                system_json = Some(content);
                println!("Found system_backup.json");
            } else if file_path_in_zip.starts_with("evidence/") && !file_path_in_zip.ends_with('/') {
                // Extract evidence file to temp directory
                let local_path = temp_dir.join(&file_path_in_zip);
                if let Some(parent) = local_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                
                let mut output_file = fs::File::create(&local_path)?;
                std::io::copy(&mut file, &mut output_file)?;
                
                evidence_files.push((file_path_in_zip.clone(), local_path.to_string_lossy().to_string()));
                total_evidence_files += 1;
                println!("Extracted evidence file: {}", file_path_in_zip);
            }
        }
        
        // Validate that we have system backup JSON
        let system_content = system_json.ok_or_else(|| {
            Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "No system_backup.json found in ZIP package"
            ))
        })?;
        
        backup_data = serde_json::from_str(&system_content)?;
        println!("Successfully parsed system backup data with {} evidence files", total_evidence_files);
        
    } else {
        println!("Detected JSON format system backup (legacy)");
        // Legacy JSON format
        let file_content = fs::read_to_string(&file_path)?;
        backup_data = serde_json::from_str(&file_content)?;
    }
    
    let mut db = database::get_database(&app_handle)?;
    
    // Store lengths before moving values
    let poam_count = backup_data.poams.len();
    let note_count = backup_data.notes.len();
    let stig_count = backup_data.stig_mappings.as_ref().map_or(0, |v| v.len());
    let test_plan_count = backup_data.test_plans.as_ref().map_or(0, |v| v.len());
    let prep_list_count = backup_data.prep_lists.as_ref().map_or(0, |v| v.len());
    let baseline_control_count = backup_data.baseline_controls.as_ref().map_or(0, |v| v.len());
    let poam_control_associations_count = backup_data.poam_control_associations.as_ref().map_or(0, |v| v.len());
    
    // Generate a new unique system ID to avoid conflicts
    let new_system_id = uuid::Uuid::new_v4().to_string();
    let mut imported_system = backup_data.system.clone();
    imported_system.id = new_system_id.clone();
    
    // Make sure the system name is unique by appending a timestamp if needed
    let original_name = imported_system.name.clone();
    let mut attempt = 0;
    while let Ok(systems) = db.get_all_systems() {
        if systems.iter().any(|s| s.name == imported_system.name) {
            attempt += 1;
            imported_system.name = format!("{} (Imported {})", original_name, attempt);
        } else {
            break;
        }
    }
    
    // Update timestamps
    let now = chrono::Utc::now().to_rfc3339();
    imported_system.created_date = now.clone();
    imported_system.updated_date = now.clone();
    imported_system.last_accessed = Some(now);
    
    // Create the new system
    db.create_system(&imported_system)?;
    
    // Import POAMs with new IDs to avoid conflicts
    let mut poam_id_mapping = std::collections::HashMap::new();
    for mut poam in backup_data.poams {
        let old_id = poam.id;
        // Generate new ID by finding the next available ID
        let existing_poams = db.get_all_poams(&new_system_id)?;
        let new_id = existing_poams
            .iter()
            .map(|p| p.id)
            .max()
            .unwrap_or(0) + 1;
        
        poam.id = new_id;
        poam_id_mapping.insert(old_id, new_id);
        
        db.create_poam(&poam, &new_system_id)?;
    }
    
    // Import notes and update POAM associations
    for mut note in backup_data.notes {
        // Update POAM IDs in notes to match new POAM IDs
        if let Some(ref mut poam_ids) = note.poam_ids {
            *poam_ids = poam_ids.iter()
                .filter_map(|old_id| poam_id_mapping.get(old_id))
                .copied()
                .collect();
        }
        
        db.create_note(&note, &new_system_id)?;
    }
    
    // Import STIG mappings if they exist and track ID mapping
    let mut stig_mapping_id_mapping = std::collections::HashMap::new();
    if let Some(stig_mappings) = backup_data.stig_mappings {
        for mut mapping in stig_mappings {
            let old_mapping_id = mapping.id.clone();
            // Generate new ID to avoid conflicts
            let new_mapping_id = uuid::Uuid::new_v4().to_string();
            mapping.id = new_mapping_id.clone();
            mapping.updated_date = chrono::Utc::now().to_rfc3339();
            
            stig_mapping_id_mapping.insert(old_mapping_id.clone(), new_mapping_id.clone());
            
            db.save_stig_mapping(&mapping, &new_system_id)?;
            println!("Imported STIG mapping: {} -> {}", old_mapping_id, new_mapping_id);
        }
    }
    
    // Import security test plans if they exist and handle evidence files
    let mut evidence_files_imported = 0;
    if let Some(test_plans) = backup_data.test_plans {
        // Create evidence directory for the new system
        let evidence_base_dir = app_data_dir.join("evidence");
        fs::create_dir_all(&evidence_base_dir)?;
        
        for mut plan in test_plans {
            let old_plan_id = plan.id.clone();
            let old_plan_name = plan.name.clone();
            
            // Generate new ID and update references
            plan.id = uuid::Uuid::new_v4().to_string();
            if let Some(old_poam_id) = plan.poam_id {
                plan.poam_id = poam_id_mapping.get(&old_poam_id).copied();
            }
            if let Some(old_stig_mapping_id) = plan.stig_mapping_id {
                plan.stig_mapping_id = stig_mapping_id_mapping.get(&old_stig_mapping_id).cloned();
            }
            plan.updated_date = chrono::Utc::now().to_rfc3339();
            
            // Create evidence directory for this test plan
            let plan_evidence_dir = evidence_base_dir.join(&plan.id);
            fs::create_dir_all(&plan_evidence_dir)?;
            
            // Map old test case IDs to new ones and copy evidence files
            let mut test_case_id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
            
            for test_case in &mut plan.test_cases {
                let old_test_case_id = test_case.id.clone();
                let new_test_case_id = uuid::Uuid::new_v4().to_string();
                test_case.id = new_test_case_id.clone();
                test_case_id_map.insert(old_test_case_id, new_test_case_id);
            }
            
            // Copy evidence files to proper locations and update file paths
            if total_evidence_files > 0 {
                for test_case in &mut plan.test_cases {
                    if let Some(ref mut evidence_file_paths) = test_case.evidence_files {
                        let mut new_evidence_paths = Vec::new();
                        
                        for evidence_path in evidence_file_paths.iter() {
                            // Find the corresponding extracted file using the old plan name and control
                            let sanitized_old_plan_name = old_plan_name.replace("/", "_").replace("\\", "_");
                            let sanitized_control = test_case.nist_control.replace("/", "_").replace("\\", "_");
                            let evidence_filename = evidence_path.split('/').last().unwrap_or("");
                            
                            let expected_zip_path = format!("evidence/{}/{}/{}", 
                                sanitized_old_plan_name, sanitized_control, evidence_filename);
                            
                            let mut found_file = false;
                            
                            for (zip_path, temp_file_path) in &evidence_files {
                                if zip_path == &expected_zip_path || zip_path.ends_with(evidence_filename) {
                                    // Create test case evidence directory
                                    let test_case_evidence_dir = plan_evidence_dir.join(&test_case.id);
                                    fs::create_dir_all(&test_case_evidence_dir)?;
                                    
                                    // Copy file to proper location
                                    let final_path = test_case_evidence_dir.join(evidence_filename);
                                    fs::copy(temp_file_path, &final_path)?;
                                    
                                    // Update path to be relative from app data dir
                                    let relative_path = format!("evidence/{}/{}/{}", 
                                        plan.id, test_case.id, evidence_filename);
                                    new_evidence_paths.push(relative_path);
                                    
                                    evidence_files_imported += 1;
                                    println!("Copied evidence file: {} -> {}", zip_path, final_path.display());
                                    found_file = true;
                                    break;
                                }
                            }
                            
                            if !found_file {
                                println!("Warning: Evidence file not found in backup: {}", evidence_path);
                                // Keep the original path but it won't work until files are manually restored
                                new_evidence_paths.push(evidence_path.clone());
                            }
                        }
                        
                        *evidence_file_paths = new_evidence_paths;
                    }
                }
            }
            
            db.save_security_test_plan(&plan, &new_system_id)?;
            println!("Imported security test plan: {} (ID: {} -> {})", plan.name, old_plan_id, plan.id);
        }
    }
    
    // Import STP prep lists if they exist
    if let Some(prep_lists) = backup_data.prep_lists {
        for mut prep_list in prep_lists {
            // Generate new ID and update source mapping reference
            prep_list.id = uuid::Uuid::new_v4().to_string();
            if let Some(old_source_mapping_id) = prep_list.source_mapping_id {
                prep_list.source_mapping_id = stig_mapping_id_mapping.get(&old_source_mapping_id).cloned();
            }
            prep_list.updated_date = chrono::Utc::now().to_rfc3339();
            
            db.save_stp_prep_list(&prep_list, &new_system_id)?;
            println!("Imported STP prep list: {} (source mapping: {:?})", prep_list.name, prep_list.source_mapping_id);
        }
    }
    
    // Import baseline controls if they exist
    if let Some(baseline_controls) = backup_data.baseline_controls {
        for mut control in baseline_controls {
            // Update system_id to the new system
            control.system_id = new_system_id.clone();
            
            db.add_baseline_control(&control)?;
            println!("Imported baseline control: {} ({})", control.id, control.title);
        }
    }
    
    // Import POAM-control associations if they exist
    if let Some(associations) = backup_data.poam_control_associations {
        for mut association in associations {
            // Find new POAM ID from mapping
            if let Some(new_poam_id) = poam_id_mapping.get(&association.poam_id) {
                association.poam_id = *new_poam_id;
                
                // Create new association with a new unique ID
                db.create_control_poam_association(
                    &association.control_id,
                    association.poam_id,
                    &new_system_id,
                    association.created_by.as_deref(),
                    association.notes.as_deref(),
                )?;
            }
        }
    }
    
    // Clean up temp directory if it was created
    if total_evidence_files > 0 {
        let temp_dir = app_data_dir.join("temp_system_import");
        if temp_dir.exists() {
            if let Err(e) = fs::remove_dir_all(&temp_dir) {
                println!("Warning: Failed to clean up temp directory: {}", e);
            } else {
                println!("Cleaned up temporary import directory");
            }
        }
    }
    
    println!("System import completed successfully:");
    println!("  - System: {} (ID: {})", imported_system.name, new_system_id);
    println!("  - POAMs: {}", poam_count);
    println!("  - Notes: {}", note_count);
    println!("  - STIG Mappings: {}", stig_count);
    println!("  - Test Plans: {}", test_plan_count);
    println!("  - Prep Lists: {}", prep_list_count);
    println!("  - Baseline Controls: {}", baseline_control_count);
    println!("  - POAM/Control Associations: {}", poam_control_associations_count);
    println!("  - Evidence Files: {} imported", evidence_files_imported);
    
    // Return success response with system information
    Ok(serde_json::json!({
        "message": "System imported successfully",
        "systemName": imported_system.name,
        "systemId": new_system_id,
        "counts": {
            "poams": poam_count,
            "notes": note_count,
            "stigMappings": stig_count,
            "testPlans": test_plan_count,
            "prepLists": prep_list_count,
            "baselineControls": baseline_control_count,
            "poamControlAssociations": poam_control_associations_count,
            "evidenceFiles": evidence_files_imported
        }
    }))
}

#[tauri::command]
async fn import_comprehensive_backup(app_handle: AppHandle, file_path: String, system_id: String) -> Result<String, Error> {
    // Read and parse the backup file
    let file_content = fs::read_to_string(&file_path)?;
    
    // Try to parse as SystemExportData first (complete system backup)
    if let Ok(backup_data) = serde_json::from_str::<models::SystemExportData>(&file_content) {
        // Store lengths before moving values
        let poam_count = backup_data.poams.len();
        let note_count = backup_data.notes.len();
        let stig_count = backup_data.stig_mappings.as_ref().map_or(0, |v| v.len());
        let test_plan_count = backup_data.test_plans.as_ref().map_or(0, |v| v.len());
        let prep_list_count = backup_data.prep_lists.as_ref().map_or(0, |v| v.len());
        let baseline_control_count = backup_data.baseline_controls.as_ref().map_or(0, |v| v.len());
        let _poam_control_associations_count = backup_data.poam_control_associations.as_ref().map_or(0, |v| v.len());
        
        // This is a complete system backup - import to existing system
        let mut db = database::get_database(&app_handle)?;
        
        // Import POAMs with new IDs to avoid conflicts
        let mut poam_id_mapping = std::collections::HashMap::new();
        for mut poam in backup_data.poams {
            let old_id = poam.id;
            // Generate new ID by finding the next available ID
            let existing_poams = db.get_all_poams(&system_id)?;
            let new_id = existing_poams
                .iter()
                .map(|p| p.id)
                .max()
                .unwrap_or(0) + 1;
            
            poam.id = new_id;
            poam_id_mapping.insert(old_id, new_id);
            
            db.create_poam(&poam, &system_id)?;
        }
        
        // Import notes and update POAM associations
        for mut note in backup_data.notes {
            // Update POAM IDs in notes to match new POAM IDs
            if let Some(ref mut poam_ids) = note.poam_ids {
                *poam_ids = poam_ids.iter()
                    .filter_map(|old_id| poam_id_mapping.get(old_id))
                    .copied()
                    .collect();
            }
            
            db.create_note(&note, &system_id)?;
        }
        
        // Import STIG mappings if they exist and track ID mapping
        let mut stig_mapping_id_mapping = std::collections::HashMap::new();
        if let Some(stig_mappings) = backup_data.stig_mappings {
            for mut mapping in stig_mappings {
                let old_mapping_id = mapping.id.clone();
                // Generate new ID to avoid conflicts
                let new_mapping_id = uuid::Uuid::new_v4().to_string();
                mapping.id = new_mapping_id.clone();
                mapping.updated_date = chrono::Utc::now().to_rfc3339();
                
                stig_mapping_id_mapping.insert(old_mapping_id.clone(), new_mapping_id.clone());
                
                db.save_stig_mapping(&mapping, &system_id)?;
            }
        }
        
        // Import security test plans if they exist
        if let Some(test_plans) = backup_data.test_plans {
            for mut plan in test_plans {
                // Generate new ID and update references
                plan.id = uuid::Uuid::new_v4().to_string();
                if let Some(old_poam_id) = plan.poam_id {
                    plan.poam_id = poam_id_mapping.get(&old_poam_id).copied();
                }
                if let Some(old_stig_mapping_id) = plan.stig_mapping_id {
                    plan.stig_mapping_id = stig_mapping_id_mapping.get(&old_stig_mapping_id).cloned();
                }
                plan.updated_date = chrono::Utc::now().to_rfc3339();
                
                db.save_security_test_plan(&plan, &system_id)?;
            }
        }
        
        // Import STP prep lists if they exist
        if let Some(prep_lists) = backup_data.prep_lists {
            for mut prep_list in prep_lists {
                // Generate new ID and update source mapping reference
                prep_list.id = uuid::Uuid::new_v4().to_string();
                if let Some(old_source_mapping_id) = prep_list.source_mapping_id {
                    prep_list.source_mapping_id = stig_mapping_id_mapping.get(&old_source_mapping_id).cloned();
                }
                prep_list.updated_date = chrono::Utc::now().to_rfc3339();
                
                db.save_stp_prep_list(&prep_list, &system_id)?;
            }
        }
        
        // Import baseline controls if they exist
        if let Some(baseline_controls) = backup_data.baseline_controls {
            for mut control in baseline_controls {
                // Update system_id to the target system
                control.system_id = system_id.clone();
                
                db.add_baseline_control(&control)?;
            }
        }
        
        // Import POAM-control associations if they exist
        if let Some(associations) = backup_data.poam_control_associations {
            for mut association in associations {
                // Find new POAM ID from mapping
                if let Some(new_poam_id) = poam_id_mapping.get(&association.poam_id) {
                    association.poam_id = *new_poam_id;
                    
                    // Create new association with a new unique ID
                    db.create_control_poam_association(
                        &association.control_id,
                        association.poam_id,
                        &system_id,
                        association.created_by.as_deref(),
                        association.notes.as_deref(),
                    )?;
                }
            }
        }
        
        let total_items = poam_count + note_count + stig_count + test_plan_count + prep_list_count + baseline_control_count;
        
        Ok(format!("Successfully imported {} items from complete system backup", total_items))
    
    } else {
        // Fall back to basic POAMData format
        let data: models::POAMData = serde_json::from_str(&file_content)?;
        let mut db = database::get_database(&app_handle)?;
        db.import_poam_data(&data, &system_id)?;
        
        let total_items = data.poams.len() + data.notes.len() + data.stig_mappings.as_ref().map_or(0, |v| v.len());
        Ok(format!("Successfully imported {} items from basic backup", total_items))
    }
}

#[tauri::command]
async fn export_stig_mappings(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
    let db = database::get_database(&app_handle)?;
    let mappings = db.get_all_stig_mappings(&system_id)?;
    
    let export_data = serde_json::json!({
        "stig_mappings": mappings,
        "export_date": chrono::Utc::now().to_rfc3339(),
        "export_type": "stig_mappings",
        "system_id": system_id
    });
    
    let json = serde_json::to_string_pretty(&export_data)?;
    fs::write(export_path, json)?;
    
    Ok("STIG mappings exported successfully".to_string())
}

// Group Management Commands

#[tauri::command]
async fn create_group(app_handle: AppHandle, group: models::SystemGroup) -> Result<(), Error> {
    println!("Creating group: {}", group.name);
    let mut db = database::get_database(&app_handle)?;
    db.create_group(&group)?;
    println!("Successfully created group: {}", group.name);
    Ok(())
}

#[tauri::command]
async fn get_all_groups(app_handle: AppHandle) -> Result<Vec<models::GroupSummary>, Error> {
    let db = database::get_database(&app_handle)?;
    let groups = db.get_all_groups()?;
    println!("Retrieved {} groups", groups.len());
    Ok(groups)
}

#[tauri::command]
async fn get_group_by_id(app_handle: AppHandle, id: String) -> Result<Option<models::SystemGroup>, Error> {
    let db = database::get_database(&app_handle)?;
    let group = db.get_group_by_id(&id)?;
    Ok(group)
}

#[tauri::command]
async fn update_group(app_handle: AppHandle, group: models::SystemGroup) -> Result<(), Error> {
    println!("Updating group: {}", group.name);
    let mut db = database::get_database(&app_handle)?;
    db.update_group(&group)?;
    println!("Successfully updated group: {}", group.name);
    Ok(())
}

#[tauri::command]
async fn delete_group(app_handle: AppHandle, id: String) -> Result<(), Error> {
    println!("Deleting group: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_group(&id)?;
    println!("Successfully deleted group: {}", id);
    Ok(())
}

#[tauri::command]
async fn add_system_to_group(app_handle: AppHandle, group_id: String, system_id: String, added_by: Option<String>) -> Result<(), Error> {
    println!("Adding system {} to group {}", system_id, group_id);
    let mut db = database::get_database(&app_handle)?;
    db.add_system_to_group(&group_id, &system_id, added_by.as_deref())?;
    println!("Successfully added system to group");
    Ok(())
}

#[tauri::command]
async fn remove_system_from_group(app_handle: AppHandle, system_id: String) -> Result<(), Error> {
    println!("Removing system {} from group", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.remove_system_from_group(&system_id)?;
    println!("Successfully removed system from group");
    Ok(())
}

#[tauri::command]
async fn get_systems_in_group(app_handle: AppHandle, group_id: String) -> Result<Vec<models::SystemSummary>, Error> {
    let mut db = database::get_database(&app_handle)?;
    let systems = db.get_systems_in_group(&group_id)?;
    println!("Retrieved {} systems in group {}", systems.len(), group_id);
    Ok(systems)
}

#[tauri::command]
async fn get_ungrouped_systems(app_handle: AppHandle) -> Result<Vec<models::SystemSummary>, Error> {
    let mut db = database::get_database(&app_handle)?;
    let systems = db.get_ungrouped_systems()?;
    println!("Retrieved {} ungrouped systems", systems.len());
    Ok(systems)
}

#[tauri::command]
async fn reorder_systems_in_group(app_handle: AppHandle, group_id: String, system_orders: Vec<(String, i32)>) -> Result<(), Error> {
    println!("Reordering systems in group {}", group_id);
    let mut db = database::get_database(&app_handle)?;
    db.reorder_systems_in_group(&group_id, &system_orders)?;
    println!("Successfully reordered systems in group");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            import_json_file,
            get_all_poams,
            get_poams,
            get_poam_by_id,
            update_poam,
            create_poam,
            export_data,
            select_file_path,
            select_save_path,
            clear_database,
            delete_database_file,
            get_all_notes,
            get_notes,
            get_notes_by_poam,
            create_note,
            update_note,
            delete_note,
            write_file,
            open_file,
            setup_app_lock,
            verify_app_lock,
            remove_app_lock,
            is_app_lock_configured,
            parse_cci_list_file,
            parse_stig_checklist_file,
            create_stig_mapping,
            parse_multiple_stig_checklists,
            save_stig_mapping,
            get_all_stig_mappings,
            get_stig_mapping_by_id,
            delete_stig_mapping,
            save_security_test_plan,
            get_all_security_test_plans,
            get_security_test_plan_by_id,
            delete_security_test_plan,
            get_test_plans_by_poam,
            export_data_with_stig,
            import_json_file_with_stig,
            export_security_test_plans,
            import_security_test_plans,
            import_evidence_package,
            export_json_data,
            export_updated_checklist,
            copy_evidence_files,
            delete_evidence_file,
            export_evidence_package,
            open_file_with_default_app,
            save_stp_prep_list,
            update_stp_prep_list,
            get_all_stp_prep_lists,
            get_stp_prep_list_by_id,
            delete_stp_prep_list,
            get_stp_prep_lists_by_source_mapping,
            create_system,
            get_all_systems,
            get_system_by_id,
            update_system,
            delete_system,
            set_active_system,
            export_complete_system_backup,
            export_stig_mappings,
            import_system_backup,
            import_comprehensive_backup,
            associate_poam_with_control,
            remove_poam_control_association,
            get_poam_associations_by_control,
            get_control_associations_by_poam,
            import_nessus_files,
            get_nessus_scans,
            get_nessus_findings_by_scan,
            clear_nessus_data,
            clear_stig_data,
            save_nessus_prep_list,
            get_all_nessus_prep_lists,
            delete_nessus_prep_list,
            get_baseline_controls,
            add_baseline_control,
            update_baseline_control,
            remove_baseline_control,
            create_milestone,
            update_milestone_status,
            delete_poam,
            create_group,
            get_all_groups,
            get_group_by_id,
            update_group,
            delete_group,
            add_system_to_group,
            remove_system_from_group,
            get_systems_in_group,
            get_ungrouped_systems,
            reorder_systems_in_group,
            // Group POAM commands
            get_group_poams,
            get_group_poam_by_id,
            create_group_poam,
            update_group_poam,
            delete_group_poam,
            analyze_group_vulnerabilities,
            // Group NIST Controls commands
            get_group_baseline_controls,
            add_group_baseline_control,
            update_group_baseline_control,
            remove_group_baseline_control,
            associate_group_poam_with_control,
            remove_group_poam_control_association,
            get_group_poam_associations_by_control,
            get_group_control_associations_by_poam
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Group POAM API Commands

#[tauri::command]
async fn get_group_poams(app_handle: AppHandle, group_id: String) -> Result<Vec<models::GroupPOAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poams = db.get_group_poams(&group_id)?;
    println!("Retrieved {} group POAMs for group {}", poams.len(), group_id);
    Ok(poams)
}

#[tauri::command]
async fn get_group_poam_by_id(app_handle: AppHandle, id: i64) -> Result<Option<models::GroupPOAM>, Error> {
    let db = database::get_database(&app_handle)?;
    let poam = db.get_group_poam_by_id(id)?;
    Ok(poam)
}

#[tauri::command]
async fn create_group_poam(app_handle: AppHandle, poam: models::GroupPOAM) -> Result<(), Error> {
    println!("Creating group POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.create_group_poam(&poam)?;
    println!("Successfully created group POAM: {}", poam.title);
    Ok(())
}

#[tauri::command]
async fn update_group_poam(app_handle: AppHandle, poam: models::GroupPOAM) -> Result<(), Error> {
    println!("Updating group POAM: {}", poam.title);
    let mut db = database::get_database(&app_handle)?;
    db.update_group_poam(&poam)?;
    println!("Successfully updated group POAM: {}", poam.title);
    Ok(())
}

#[tauri::command]
async fn delete_group_poam(app_handle: AppHandle, id: i64) -> Result<(), Error> {
    println!("Deleting group POAM with id: {}", id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_group_poam(id)?;
    println!("Successfully deleted group POAM");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupVulnerabilityAnalysis {
    pub group_id: String,
    pub total_systems: i32,
    pub total_vulnerabilities: i32,
    pub critical_vulnerabilities: i32,
    pub high_vulnerabilities: i32,
    pub medium_vulnerabilities: i32,
    pub low_vulnerabilities: i32,
    pub cross_system_vulnerabilities: Vec<CrossSystemVulnerability>,
    pub system_summaries: Vec<SystemVulnerabilitySummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CrossSystemVulnerability {
    pub vulnerability_id: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub affected_systems: Vec<String>,
    pub cve_ids: Vec<String>,
    pub suggested_poam_title: String,
    pub risk_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemVulnerabilitySummary {
    pub system_id: String,
    pub system_name: String,
    pub total_vulnerabilities: i32,
    pub critical_count: i32,
    pub high_count: i32,
    pub medium_count: i32,
    pub low_count: i32,
    pub unique_vulnerabilities: Vec<String>,
}

#[tauri::command]
async fn analyze_group_vulnerabilities(app_handle: AppHandle, group_id: String) -> Result<GroupVulnerabilityAnalysis, Error> {
    println!("Analyzing vulnerabilities for group: {}", group_id);
    
    let mut db = database::get_database(&app_handle)?;
    let systems = db.get_systems_in_group(&group_id)?;
    
    let mut all_vulnerabilities: Vec<CrossSystemVulnerability> = Vec::new();
    let mut system_summaries: Vec<SystemVulnerabilitySummary> = Vec::new();
    
    let mut total_vulnerabilities = 0;
    let mut critical_count = 0;
    let mut high_count = 0;
    let mut medium_count = 0;
    let mut low_count = 0;
    
    // Analyze each system for vulnerabilities
    for system in &systems {
        println!("Analyzing system: {}", system.name);
        
        // Get STIG mappings for vulnerability data
        let stig_mappings = db.get_all_stig_mappings(&system.id).unwrap_or_default();
        
        let mut system_vulnerabilities = 0;
        let mut system_critical = 0;
        let mut system_high = 0;
        let mut system_medium = 0;
        let mut system_low = 0;
        let mut unique_vulns: Vec<String> = Vec::new();
        
        for mapping in &stig_mappings {
            let result = &mapping.mapping_result;
            for control in &result.mapped_controls {
                    for stig in &control.stigs {
                        // Count vulnerability by severity
                        match stig.severity.as_str() {
                            "critical" | "Critical" => {
                                system_critical += 1;
                                critical_count += 1;
                            },
                            "high" | "High" => {
                                system_high += 1;
                                high_count += 1;
                            },
                            "medium" | "Medium" => {
                                system_medium += 1;
                                medium_count += 1;
                            },
                            "low" | "Low" => {
                                system_low += 1;
                                low_count += 1;
                            },
                            _ => {}
                        }
                        
                        system_vulnerabilities += 1;
                        total_vulnerabilities += 1;
                        unique_vulns.push(stig.vuln_num.clone());
                        
                        // Check if this is a cross-system vulnerability
                        if let Some(existing_vuln) = all_vulnerabilities.iter_mut()
                            .find(|v| v.vulnerability_id == stig.vuln_num) {
                            // Add this system to affected systems if not already there
                            if !existing_vuln.affected_systems.contains(&system.id) {
                                existing_vuln.affected_systems.push(system.id.clone());
                            }
                        } else {
                            // Create new cross-system vulnerability entry
                            let cross_vuln = CrossSystemVulnerability {
                                vulnerability_id: stig.vuln_num.clone(),
                                severity: stig.severity.clone(),
                                title: stig.rule_title.clone(),
                                description: stig.vuln_discuss.clone(),
                                affected_systems: vec![system.id.clone()],
                                cve_ids: vec![], // Could be populated from additional data
                                suggested_poam_title: format!("Remediate {} - {}", stig.vuln_num, stig.rule_title),
                                risk_score: match stig.severity.as_str() {
                                    "critical" | "Critical" => 9.0,
                                    "high" | "High" => 7.0,
                                    "medium" | "Medium" => 5.0,
                                    "low" | "Low" => 3.0,
                                    _ => 1.0,
                                },
                            };
                            all_vulnerabilities.push(cross_vuln);
                        }
                    }
                }
        }
        
        system_summaries.push(SystemVulnerabilitySummary {
            system_id: system.id.clone(),
            system_name: system.name.clone(),
            total_vulnerabilities: system_vulnerabilities,
            critical_count: system_critical,
            high_count: system_high,
            medium_count: system_medium,
            low_count: system_low,
            unique_vulnerabilities: unique_vulns,
        });
    }
    
    // Filter for true cross-system vulnerabilities (affecting multiple systems)
    let cross_system_vulnerabilities: Vec<CrossSystemVulnerability> = all_vulnerabilities
        .into_iter()
        .filter(|v| v.affected_systems.len() > 1)
        .collect();
    
    let analysis = GroupVulnerabilityAnalysis {
        group_id: group_id.clone(),
        total_systems: systems.len() as i32,
        total_vulnerabilities,
        critical_vulnerabilities: critical_count,
        high_vulnerabilities: high_count,
        medium_vulnerabilities: medium_count,
        low_vulnerabilities: low_count,
        cross_system_vulnerabilities,
        system_summaries,
    };
    
    println!("Completed vulnerability analysis for group {}: {} total vulnerabilities, {} cross-system", 
             group_id, total_vulnerabilities, analysis.cross_system_vulnerabilities.len());
    
    Ok(analysis)
}

// Group NIST Controls API Commands

#[tauri::command]
async fn get_group_baseline_controls(app_handle: AppHandle, group_id: String) -> Result<Vec<database::GroupBaselineControl>, Error> {
    let db = database::get_database(&app_handle)?;
    let controls = db.get_group_baseline_controls(&group_id)?;
    println!("Retrieved {} group baseline controls for group {}", controls.len(), group_id);
    Ok(controls)
}

#[tauri::command]
async fn add_group_baseline_control(app_handle: AppHandle, control: database::GroupBaselineControl) -> Result<(), Error> {
    println!("Adding group baseline control: {} to group {}", control.id, control.group_id);
    let mut db = database::get_database(&app_handle)?;
    db.add_group_baseline_control(&control)?;
    println!("Successfully added group baseline control: {}", control.id);
    Ok(())
}

#[tauri::command]
async fn update_group_baseline_control(app_handle: AppHandle, control: database::GroupBaselineControl) -> Result<(), Error> {
    println!("Updating group baseline control: {} in group {}", control.id, control.group_id);
    let mut db = database::get_database(&app_handle)?;
    db.update_group_baseline_control(&control)?;
    println!("Successfully updated group baseline control: {}", control.id);
    Ok(())
}

#[tauri::command]
async fn remove_group_baseline_control(app_handle: AppHandle, control_id: String, group_id: String) -> Result<(), Error> {
    println!("Removing group baseline control: {} from group {}", control_id, group_id);
    let mut db = database::get_database(&app_handle)?;
    db.remove_group_baseline_control(&control_id, &group_id)?;
    println!("Successfully removed group baseline control: {}", control_id);
    Ok(())
}

#[tauri::command]
async fn associate_group_poam_with_control(
    app_handle: AppHandle, 
    control_id: String, 
    group_poam_id: i64, 
    group_id: String,
    created_by: Option<String>,
    notes: Option<String>
) -> Result<String, Error> {
    println!("Associating group POAM {} with control {} in group {}", group_poam_id, control_id, group_id);
    let mut db = database::get_database(&app_handle)?;
    let association_id = db.create_group_control_poam_association(
        &control_id, 
        group_poam_id, 
        &group_id,
        created_by.as_deref(),
        notes.as_deref()
    )?;
    println!("Successfully created group control-POAM association: {}", association_id);
    Ok(association_id)
}

#[tauri::command]
async fn remove_group_poam_control_association(
    app_handle: AppHandle, 
    association_id: String, 
    group_id: String
) -> Result<(), Error> {
    println!("Removing group control-POAM association: {} from group {}", association_id, group_id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_group_control_poam_association(&association_id, &group_id)?;
    println!("Successfully removed group control-POAM association: {}", association_id);
    Ok(())
}

#[tauri::command]
async fn get_group_poam_associations_by_control(
    app_handle: AppHandle, 
    control_id: String, 
    group_id: String
) -> Result<Vec<database::GroupControlPOAMAssociation>, Error> {
    let db = database::get_database(&app_handle)?;
    let associations = db.get_group_control_poam_associations_by_control(&control_id, &group_id)?;
    println!("Retrieved {} group control-POAM associations for control {} in group {}", 
             associations.len(), control_id, group_id);
    Ok(associations)
}

#[tauri::command]
async fn get_group_control_associations_by_poam(
    app_handle: AppHandle, 
    group_poam_id: i64, 
    group_id: String
) -> Result<Vec<database::GroupControlPOAMAssociation>, Error> {
    let db = database::get_database(&app_handle)?;
    let associations = db.get_group_control_poam_associations_by_poam(group_poam_id, &group_id)?;
    println!("Retrieved {} group control associations for group POAM {} in group {}", 
             associations.len(), group_poam_id, group_id);
    Ok(associations)
}

#[tauri::command]
async fn create_milestone(app_handle: AppHandle, milestone: models::Milestone, poam_id: i64, system_id: String) -> Result<(), Error> {
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
async fn update_milestone_status(
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

#[tauri::command]
async fn delete_poam(app_handle: AppHandle, poam_id: i64, system_id: String) -> Result<(), Error> {
    println!("Deleting POAM: {}", poam_id);
    let mut db = database::get_database(&app_handle)?;
    db.delete_poam(poam_id, &system_id)?;
    println!("Successfully deleted POAM");
    Ok(())
}
