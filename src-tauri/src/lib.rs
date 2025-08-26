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
mod commands;
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
async fn clear_stig_data(app_handle: AppHandle, system_id: String) -> Result<String, Error> {
    println!("Clearing STIG mappings for system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.clear_stig_mappings_for_system(&system_id)?;
    Ok("STIG data cleared".to_string())
}

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

// POAM command implementations moved to `commands::poams_milestones`.

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

// Notes commands moved to `commands::notes` to avoid duplication.

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

#[tauri::command]
async fn upload_cci_list_file(_app_handle: AppHandle, file_path: String) -> Result<(), Error> {
    println!("Uploading CCI list file: {}", file_path);
    let mappings = stig::parse_cci_list(file_path)?;
    println!("Successfully parsed {} CCI mappings", mappings.len());
    Ok(())
}

#[tauri::command]
async fn upload_cci_list(app_handle: AppHandle, file_path: String, group_id: String) -> Result<String, Error> {
    println!("Uploading CCI list file for group {}: {}", group_id, file_path);
    
    // Parse the CCI list XML file
    let mappings = stig::parse_cci_list(file_path)?;
    println!("Successfully parsed {} CCI mappings", mappings.len());
    
    // Get database connection
    let mut db = database::get_database(&app_handle)?;
    
    // Clear existing CCI mappings for this group
    db.conn.execute(
        "DELETE FROM group_cci_mappings WHERE group_id = ?1",
        rusqlite::params![group_id],
    ).map_err(database::DatabaseError::Sqlite)?;
    
    // Save new CCI mappings to the database
    let mut saved_count = 0;
    for mapping in &mappings {
        for nist_control in &mapping.nist_controls {
            db.conn.execute(
                "INSERT INTO group_cci_mappings (group_id, cci_id, nist_control, definition, status) 
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    group_id,
                    mapping.id,
                    nist_control,
                    mapping.definition,
                    mapping.status
                ],
            ).map_err(database::DatabaseError::Sqlite)?;
            saved_count += 1;
        }
    }
    
    // Update implementation status for group baseline controls based on CCI mappings
    let baseline_controls = db.get_group_baseline_controls(&group_id)?;
    for control in baseline_controls {
        // Check if this control has CCI mappings
        let has_mappings = db.conn.query_row(
            "SELECT COUNT(*) FROM group_cci_mappings WHERE group_id = ?1 AND nist_control = ?2",
            rusqlite::params![group_id, control.id],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;
        
        if has_mappings {
            // Update the control's implementation status to indicate it has CCI mappings
            let mut updated_control = control;
            if updated_control.implementation_status == "Not Assessed" {
                updated_control.implementation_status = "Not Implemented".to_string();
            }
            db.update_group_baseline_control(&updated_control)?;
        }
    }
    
    let result_message = format!(
        "Successfully uploaded CCI list with {} mappings covering {} CCI-to-NIST control associations. Group baseline controls have been updated with implementation status.",
        mappings.len(),
        saved_count
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

#[derive(serde::Serialize)]
struct ControlImplementationStatus {
    control_id: String,
    implementation_status: String,
    compliance_percentage: f64,
    total_findings: usize,
    open_findings: usize,
    not_applicable_findings: usize,
    compliant_findings: usize,
    mapped_ccis: Vec<String>,
    affected_systems: Vec<String>,
    last_assessed: Option<String>,
}

#[derive(serde::Serialize)]
struct ControlComplianceAnalysis {
    group_id: String,
    total_controls: usize,
    controls_with_mappings: usize,
    fully_compliant: usize,
    partially_compliant: usize,
    non_compliant: usize,
    not_assessed: usize,
    control_statuses: Vec<ControlImplementationStatus>,
}

#[tauri::command]
async fn analyze_control_compliance(app_handle: AppHandle, group_id: String) -> Result<ControlComplianceAnalysis, Error> {
    println!("Analyzing control compliance for group: {}", group_id);
    
    let mut db = database::get_database(&app_handle)?;
    
    // Get all systems in the group
    let systems = db.get_systems_in_group(&group_id)?;
    println!("Found {} systems in group", systems.len());
    
    // Get CCI mappings for this group
    let cci_mappings: Vec<(String, String)> = db.conn.prepare(
        "SELECT cci_id, nist_control FROM group_cci_mappings WHERE group_id = ?1"
    ).map_err(database::DatabaseError::Sqlite)?
    .query_map(rusqlite::params![group_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(database::DatabaseError::Sqlite)?
    .collect::<Result<Vec<_>, _>>().map_err(database::DatabaseError::Sqlite)?;
    
    if cci_mappings.is_empty() {
        return Err(Error::Database(database::DatabaseError::NotFound("No CCI mappings found for this group".to_string())));
    }
    
    // Build a map from CCI to NIST controls
    let mut cci_to_nist: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (cci_id, nist_control) in &cci_mappings {
        cci_to_nist.entry(cci_id.clone()).or_insert_with(Vec::new).push(nist_control.clone());
    }
    
    // Build a map from NIST control to CCIs
    let mut nist_to_ccis: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (cci_id, nist_control) in &cci_mappings {
        nist_to_ccis.entry(nist_control.clone()).or_insert_with(Vec::new).push(cci_id.clone());
    }
    
    // Get all STIG mappings for systems in the group
    let mut control_findings: std::collections::HashMap<String, Vec<(String, String, Vec<String>)>> = std::collections::HashMap::new();
    
    for system in &systems {
        let stig_mappings = db.get_all_stig_mappings(&system.id)?;
        
        for mapping in stig_mappings {
            let result = &mapping.mapping_result;
            // Process mapped controls and their STIG vulnerabilities
            for mapped_control in &result.mapped_controls {
                for stig_vuln in &mapped_control.stigs {
                    for cci_ref in &stig_vuln.cci_refs {
                        if let Some(nist_controls) = cci_to_nist.get(cci_ref as &str) {
                            for nist_control in nist_controls {
                                control_findings.entry(nist_control.clone())
                                    .or_insert_with(Vec::new)
                                    .push((system.name.clone(), stig_vuln.status.clone(), vec![cci_ref.clone()]));
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Calculate implementation status for each control
    let mut control_statuses = Vec::new();
    let mut controls_with_mappings = 0;
    let mut fully_compliant = 0;
    let mut partially_compliant = 0;
    let mut non_compliant = 0;
    let mut not_assessed = 0;
    
    for (control_id, findings) in &control_findings {
        controls_with_mappings += 1;
        
        let total_findings = findings.len() as i32;
        let open_findings = findings.iter().filter(|(_, status, _)| status == "Open").count() as i32;
        let not_applicable_findings = findings.iter().filter(|(_, status, _)| status == "Not_Applicable").count() as i32;
        let compliant_findings = findings.iter().filter(|(_, status, _)| status == "NotAFinding" || status == "Not_Applicable").count() as i32;
        
        // Debug logging to identify the issue
        println!("Control {}: total={}, open={}, compliant={}, na={}", 
                control_id, total_findings, open_findings, compliant_findings, not_applicable_findings);
        for (system, status, ccis) in findings {
            println!("  System: {}, Status: {}, CCIs: {:?}", system, status, ccis);
        }
        
        let compliance_percentage = if total_findings > 0 {
            (compliant_findings as f64 / total_findings as f64) * 100.0
        } else {
            0.0
        };
        
        let implementation_status = if total_findings == 0 {
            not_assessed += 1;
            "Not Assessed".to_string()
        } else if compliance_percentage >= 100.0 {
            fully_compliant += 1;
            "Compliant".to_string()
        } else if compliance_percentage > 0.0 {
            partially_compliant += 1;
            "Partially Compliant".to_string()
        } else {
            non_compliant += 1;
            "Non-Compliant".to_string()
        };
        
        let affected_systems: Vec<String> = findings.iter()
            .map(|(system, _, _)| system.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        
        let mapped_ccis = nist_to_ccis.get(control_id).cloned().unwrap_or_default();
        
        control_statuses.push(ControlImplementationStatus {
            control_id: control_id.clone(),
            implementation_status,
            compliance_percentage,
            total_findings: total_findings.try_into().unwrap(),
            open_findings: open_findings.try_into().unwrap(),
            not_applicable_findings: not_applicable_findings.try_into().unwrap(),
            compliant_findings: compliant_findings.try_into().unwrap(),
            mapped_ccis,
            affected_systems,
            last_assessed: Some(chrono::Utc::now().to_rfc3339()),
        });
    }
    
    // Sort by control ID
    control_statuses.sort_by(|a, b| a.control_id.cmp(&b.control_id));
    
    let analysis = ControlComplianceAnalysis {
        group_id,
        total_controls: control_statuses.len(),
        controls_with_mappings,
        fully_compliant,
        partially_compliant,
        non_compliant,
        not_assessed,
        control_statuses,
    };
    
    println!("Analysis complete: {} controls analyzed", analysis.total_controls);
    Ok(analysis)
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
    let db = database::get_database(&app_handle)?;
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

// Evidence commands moved to commands::evidence

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

#[tauri::command]
async fn get_all_stp_prep_lists(app_handle: AppHandle, system_id: String) -> Result<Vec<models::StpPrepList>, Error> {
    let db = database::get_database(&app_handle)?;
    let prep_lists = db.get_all_stp_prep_lists(&system_id)?;
    println!("Retrieved {} STP prep lists", prep_lists.len());
    Ok(prep_lists)
}

// Milestone and POAM command implementations moved to `commands::poams_milestones`.

#[tauri::command]
async fn export_complete_group_backup(app_handle: AppHandle, export_path: String, group_id: String) -> Result<String, Error> {
    use std::io::Write;
    use zip::write::FileOptions;
    
    println!("Creating complete group backup for group: {}", group_id);
    
    let mut db = database::get_database(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Get group information
    let group = db.get_group_by_id(&group_id)?
        .ok_or_else(|| Error::Database(database::DatabaseError::ClearDatabase("Group not found".to_string())))?;
    
    // Get all systems in the group
    let group_systems = db.get_systems_in_group(&group_id)?;
    println!("Found {} systems in group", group_systems.len());
    
    // Export each system's complete data
    let mut system_exports = Vec::new();
    let mut total_evidence_files = 0;
    let mut evidence_file_count_by_system: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    
    for system in &group_systems {
        println!("Exporting system: {}", system.name);
        
        // Get all data for this system
        let poams = db.get_all_poams(&system.id)?;
        let notes = db.get_all_notes(&system.id)?;
        let stig_mappings = db.get_all_stig_mappings(&system.id)?;
        let test_plans = db.get_all_security_test_plans(&system.id)?;
        let prep_lists = db.get_all_stp_prep_lists(&system.id)?;
        let baseline_controls = db.get_baseline_controls(&system.id)?;
        
        // Get Nessus data for this system
        let nessus_scans = db.get_nessus_scans(&system.id)?;
        let mut all_nessus_findings = Vec::new();
        for scan in &nessus_scans {
            let mut findings = db.get_nessus_findings_by_scan(&scan.id, &system.id)?;
            all_nessus_findings.append(&mut findings);
        }
        let nessus_prep_lists = db.get_all_nessus_prep_lists(&system.id)?;
        
        let mut poam_control_associations = Vec::new();
        for poam in &poams {
            let mut associations = db.get_control_poam_associations_by_poam(poam.id, &system.id)?;
            poam_control_associations.append(&mut associations);
        }
        
        // Count evidence files for this system
        let mut system_evidence_count = 0;
        for test_plan in &test_plans {
            for test_case in &test_plan.test_cases {
                if let Some(evidence_files) = &test_case.evidence_files {
                    system_evidence_count += evidence_files.len();
                }
            }
        }
        evidence_file_count_by_system.insert(system.id.clone(), system_evidence_count);
        total_evidence_files += system_evidence_count;
        
        // Convert SystemSummary to System for export
        let system_for_export = models::System {
            id: system.id.clone(),
            name: system.name.clone(),
            description: system.description.clone(),
            created_date: system.created_date.clone(),
            updated_date: chrono::Utc::now().to_rfc3339(),
            last_accessed: system.last_accessed.clone(),
            owner: system.owner.clone(),
            classification: system.classification.clone(),
            tags: system.tags.clone(),
            group_id: Some(group_id.clone()),
            is_active: true,
            poam_count: Some(system.poam_count),
        };
        
        // Create system export data
        let system_export = models::SystemExportData {
            system: system_for_export,
            poams,
            notes,
            stig_mappings: if stig_mappings.is_empty() { None } else { Some(stig_mappings) },
            test_plans: if test_plans.is_empty() { None } else { Some(test_plans) },
            prep_lists: if prep_lists.is_empty() { None } else { Some(prep_lists) },
            baseline_controls: if baseline_controls.is_empty() { None } else { Some(baseline_controls) },
            poam_control_associations: if poam_control_associations.is_empty() { None } else { Some(poam_control_associations) },
            nessus_scans: if nessus_scans.is_empty() { None } else { Some(nessus_scans) },
            nessus_findings: if all_nessus_findings.is_empty() { None } else { Some(all_nessus_findings) },
            nessus_prep_lists: if nessus_prep_lists.is_empty() { None } else { Some(nessus_prep_lists) },
            export_date: Some(chrono::Utc::now().to_rfc3339()),
            export_version: Some("2.2".to_string()),
        };
        
        system_exports.push(system_export);
    }
    
    // Get group-level data (group POAMs, etc.)
    // Note: Group POAMs functionality may need to be implemented in the database layer
    
    // Create group export data structure
    let group_export_data = models::GroupExportData {
        group: group.clone(),
        systems: system_exports,
        export_date: Some(chrono::Utc::now().to_rfc3339()),
        export_version: Some("3.0".to_string()), // New version for group exports
    };
    
    // Create ZIP file
    let file = fs::File::create(&export_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    // Add group backup JSON to ZIP
    let json = serde_json::to_string_pretty(&group_export_data)?;
    zip.start_file("group_backup.json", FileOptions::default())?;
    zip.write_all(json.as_bytes())?;
    
    // Copy evidence files from all systems
    let mut manifest = vec!["# Group Backup Evidence Files Manifest".to_string()];
    
    for (system_idx, system_export) in group_export_data.systems.iter().enumerate() {
        let system_name = &system_export.system.name;
        manifest.push(format!("\n## System: {}", system_name));
        
        if let Some(test_plans) = &system_export.test_plans {
            for (plan_idx, test_plan) in test_plans.iter().enumerate() {
                manifest.push(format!("### Test Plan: {}", test_plan.name));
                
                for (case_idx, test_case) in test_plan.test_cases.iter().enumerate() {
                    if let Some(evidence_files) = &test_case.evidence_files {
                        for (file_idx, evidence_file) in evidence_files.iter().enumerate() {
                            let source_path = app_data_dir.join(&evidence_file);
                            
                            if source_path.exists() {
                                let zip_path = format!("evidence/system_{}/plan_{}/case_{}/file_{}/{}", 
                                                     system_idx, plan_idx, case_idx, file_idx,
                                                     source_path.file_name().unwrap_or_default().to_string_lossy());
                                
                                manifest.push(format!("- {}: {}", zip_path, evidence_file));
                                
                                match fs::read(&source_path) {
                                    Ok(file_data) => {
                                        zip.start_file(&zip_path, FileOptions::default())?;
                                        zip.write_all(&file_data)?;
                                    }
                                    Err(e) => {
                                        manifest.push(format!("  ERROR: Failed to read file: {}", e));
                                    }
                                }
                            } else {
                                manifest.push(format!("- MISSING: {}", evidence_file));
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Add evidence manifest
    zip.start_file("EVIDENCE_MANIFEST.txt", FileOptions::default())?;
    zip.write_all(manifest.join("\n").as_bytes())?;
    
    // Create group summary
    let total_poams: usize = group_export_data.systems.iter().map(|s| s.poams.len()).sum();
    let total_notes: usize = group_export_data.systems.iter().map(|s| s.notes.len()).sum();
    let total_stig_mappings: usize = group_export_data.systems.iter()
        .map(|s| s.stig_mappings.as_ref().map_or(0, |v| v.len())).sum();
    let total_test_plans: usize = group_export_data.systems.iter()
        .map(|s| s.test_plans.as_ref().map_or(0, |v| v.len())).sum();
    let total_prep_lists: usize = group_export_data.systems.iter()
        .map(|s| s.prep_lists.as_ref().map_or(0, |v| v.len())).sum();
    let total_baseline_controls: usize = group_export_data.systems.iter()
        .map(|s| s.baseline_controls.as_ref().map_or(0, |v| v.len())).sum();
    let total_associations: usize = group_export_data.systems.iter()
        .map(|s| s.poam_control_associations.as_ref().map_or(0, |v| v.len())).sum();
    
    let summary = format!(
        "# {} - Complete Group Backup\n\n\
        **Backup Date:** {}\n\
        **Group Description:** {}\n\
        **Export Version:** 3.0 (Group ZIP format with evidence files)\n\n\
        ## Group Contents\n\
        - {} Systems\n\
        - {} Total POAMs\n\
        - {} Total Notes\n\
        - {} Total STIG Mappings\n\
        - {} Total Security Test Plans\n\
        - {} Total STP Prep Lists\n\
        - {} Total Baseline Controls\n\
        - {} Total POAM/Control Associations\n\
        - {} Total Evidence Files\n\n\
        ## Systems in Group\n{}\n\n\
        This is a complete group backup that includes all systems, metadata, configurations, \
        and evidence files. Import this ZIP file to restore the entire group with \
        full data integrity and evidence preservation.",
        group.name,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
        group.description.as_deref().unwrap_or("No description"),
        group_export_data.systems.len(),
        total_poams,
        total_notes,
        total_stig_mappings,
        total_test_plans,
        total_prep_lists,
        total_baseline_controls,
        total_associations,
        total_evidence_files,
        group_export_data.systems.iter()
            .map(|s| format!("- {} ({})", s.system.name, 
                           s.system.description.as_deref().unwrap_or("No description")))
            .collect::<Vec<_>>().join("\n")
    );
    
    zip.start_file("GROUP_SUMMARY.md", FileOptions::default())?;
    zip.write_all(summary.as_bytes())?;
    
    zip.finish()?;
    
    let file_size = fs::metadata(&export_path)?.len();
    let size_mb = file_size as f64 / 1024.0 / 1024.0;
    
    let result_message = format!(
        "Group backup export completed successfully!\n\n\
        Group: {}\n\
        Systems: {}\n\
        POAMs: {}\n\
        Notes: {}\n\
        STIG Mappings: {}\n\
        Test Plans: {}\n\
        Evidence Files: {}\n\
        File Size: {:.2} MB\n\n\
        Export saved to: {}",
        group.name,
        group_export_data.systems.len(),
        total_poams,
        total_notes,
        total_stig_mappings,
        total_test_plans,
        total_evidence_files,
        size_mb,
        export_path
    );
    println!("{}", result_message);
    Ok(result_message)
}

// Application entry point exposed for the bin crate (src/main.rs)
// This sets up the Tauri runtime, registers commands declared in this lib,
// and starts the app.
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Main lib.rs commands
            clear_stig_data,
            import_json_file,
            export_data,
            select_file_path,
            select_save_path,
            clear_database,
            delete_database_file,
            write_file,
            open_file,
            setup_app_lock,
            verify_app_lock,
            remove_app_lock,
            is_app_lock_configured,
            upload_cci_list_file,
            upload_cci_list,
            analyze_control_compliance,
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
            get_control_associations_by_poam,
            get_baseline_controls,
            add_baseline_control,
            update_baseline_control,
            remove_baseline_control,
            export_data_with_stig,
            import_json_file_with_stig,
            export_security_test_plans,
            export_json_data,
            export_updated_checklist,
            associate_poam_with_control,
            remove_poam_control_association,
            get_poam_associations_by_control,
            import_security_test_plans,
            import_evidence_package,
            save_stp_prep_list,
            get_all_stp_prep_lists,
            export_complete_group_backup,
            // Systems module commands
            commands::systems::create_system,
            commands::systems::get_all_systems,
            commands::systems::get_system_by_id,
            commands::systems::update_system,
            commands::systems::delete_system,
            commands::systems::set_active_system,
            // Groups module commands
            commands::groups::create_group,
            commands::groups::get_all_groups,
            commands::groups::get_group_by_id,
            commands::groups::update_group,
            commands::groups::delete_group,
            commands::groups::add_system_to_group,
            commands::groups::remove_system_from_group,
            commands::groups::get_systems_in_group,
            commands::groups::get_ungrouped_systems,
            commands::groups::reorder_systems_in_group,
            commands::groups::get_group_poams,
            commands::groups::get_group_poam_by_id,
            commands::groups::create_group_poam,
            commands::groups::update_group_poam,
            commands::groups::delete_group_poam,
            // POAMs and Milestones module commands
            commands::poams_milestones::get_all_poams,
            commands::poams_milestones::get_poams,
            commands::poams_milestones::get_poam_by_id,
            commands::poams_milestones::update_poam,
            commands::poams_milestones::create_poam,
            commands::poams_milestones::delete_poam,
            commands::poams_milestones::create_milestone,
            commands::poams_milestones::update_milestone_status,
            // Notes module commands
            commands::notes::get_all_notes,
            commands::notes::get_notes,
            commands::notes::get_notes_by_poam,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            // Nessus module commands
            commands::nessus::import_nessus_files,
            commands::nessus::get_nessus_scans,
            commands::nessus::get_nessus_findings_by_scan,
            commands::nessus::clear_nessus_data,
            commands::nessus::save_nessus_prep_list,
            commands::nessus::get_all_nessus_prep_lists,
            commands::nessus::get_nessus_prep_list_by_id,
            commands::nessus::update_nessus_prep_list,
            commands::nessus::delete_nessus_prep_list,
            // Evidence module commands
            commands::evidence::copy_evidence_files,
            commands::evidence::delete_evidence_file,
            commands::evidence::export_evidence_package,
            commands::evidence::open_file_with_default_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
