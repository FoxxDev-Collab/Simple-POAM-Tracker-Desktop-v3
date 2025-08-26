// Simple Import/Export - System Level Only
// No more group bullshit, just clean system import/export

use crate::{database, models, Error};
use std::fs;
use tauri::AppHandle;
use uuid::Uuid;
use chrono;

#[tauri::command]
pub async fn export_system_backup(
    app_handle: AppHandle,
    systemId: String,
    exportPath: String
) -> Result<String, Error> {
    println!("Exporting system backup for: {}", systemId);
    
    let db = database::get_database(&app_handle)?;
    
    // Get system data
    let system = db.get_system_by_id(&systemId)?
        .ok_or_else(|| Error::Database(database::DatabaseError::NotFound("System not found".to_string())))?;
    
    let poams = db.get_all_poams(&systemId)?;
    let notes = db.get_all_notes(&systemId)?;
    let stig_mappings = db.get_all_stig_mappings(&systemId)?;
    let test_plans = db.get_all_security_test_plans(&systemId)?;
    let baseline_controls = db.get_baseline_controls(&systemId)?;
    
    // Get Nessus data
    let nessus_scans = db.get_nessus_scans(&systemId)?;
    let mut all_nessus_findings = Vec::new();
    for scan in &nessus_scans {
        let mut findings = db.get_nessus_findings_by_scan(&scan.id, &systemId)?;
        all_nessus_findings.append(&mut findings);
    }
    
    let export_data = models::SystemExportData {
        system: system.clone(),
        poams,
        notes,
        stig_mappings: Some(stig_mappings),
        test_plans: Some(test_plans),
        prep_lists: None,
        baseline_controls: Some(baseline_controls),
        poam_control_associations: None,
        nessus_scans: Some(nessus_scans),
        nessus_findings: Some(all_nessus_findings),
        nessus_prep_lists: None,
        export_date: Some(chrono::Utc::now().to_rfc3339()),
        export_version: Some("1.0".to_string()),
    };
    
    // Export to JSON
    let json_content = serde_json::to_string_pretty(&export_data)?;
    fs::write(&exportPath, json_content)?;
    
    let success_message = format!(
        "System backup exported successfully!\n\n\
        System: {} (ID: {})\n\
        POAMs: {}\n\
        Notes: {}\n\
        STIG Mappings: {}\n\
        Test Plans: {}\n\
        Baseline Controls: {}\n\
        Nessus Scans: {}\n\
        Export Path: {}",
        system.name,
        system.id,
        export_data.poams.len(),
        export_data.notes.len(),
        export_data.stig_mappings.as_ref().map(|s| s.len()).unwrap_or(0),
        export_data.test_plans.as_ref().map(|t| t.len()).unwrap_or(0),
        export_data.baseline_controls.as_ref().map(|b| b.len()).unwrap_or(0),
        export_data.nessus_scans.as_ref().map(|n| n.len()).unwrap_or(0),
        exportPath
    );
    
    println!("{}", success_message);
    Ok(success_message)
}

#[tauri::command]
pub async fn import_system_backup(
    app_handle: AppHandle,
    filePath: String,
    targetSystemId: Option<String>
) -> Result<String, Error> {
    println!("Importing system backup from: {}", filePath);
    
    // Read and parse the backup file
    let file_content = fs::read_to_string(&filePath)?;
    let system_data: models::SystemExportData = serde_json::from_str(&file_content)?;
    
    let mut db = database::get_database(&app_handle)?;
    
    // Determine target system
    let target_system = match targetSystemId {
        Some(id) => {
            // Import into existing system
            db.get_system_by_id(&id)?
                .ok_or_else(|| Error::Database(database::DatabaseError::NotFound("Target system not found".to_string())))?
        }
        None => {
            // Create new system
            let mut new_system = system_data.system.clone();
            new_system.id = Uuid::new_v4().to_string();
            new_system.name = format!("{} (Imported)", new_system.name);
            db.create_system(&new_system)?;
            new_system
        }
    };
    
    let mut imported_counts = (0, 0, 0, 0, 0, 0); // poams, notes, stig_mappings, test_plans, baseline_controls, nessus_scans
    
    // Import POAMs
    for poam in &system_data.poams {
        let mut import_poam = poam.clone();
        // Generate new POAM ID
        let existing_poams = db.get_all_poams(&target_system.id)?;
        let max_id = existing_poams.iter().map(|p| p.id).max().unwrap_or(0);
        import_poam.id = max_id + 1;
        
        db.create_poam(&import_poam, &target_system.id)?;
        imported_counts.0 += 1;
    }
    
    // Import Notes
    for note in &system_data.notes {
        let mut import_note = note.clone();
        import_note.id = Uuid::new_v4().to_string();
        
        db.create_note(&import_note, &target_system.id)?;
        imported_counts.1 += 1;
    }
    
    // Import STIG Mappings
    if let Some(stig_mappings) = &system_data.stig_mappings {
        for mapping in stig_mappings {
            let mut import_mapping = mapping.clone();
            import_mapping.id = Uuid::new_v4().to_string();
            
            db.save_stig_mapping(&import_mapping, &target_system.id)?;
            imported_counts.2 += 1;
        }
    }
    
    // Import Test Plans
    if let Some(test_plans) = &system_data.test_plans {
        for test_plan in test_plans {
            let mut import_test_plan = test_plan.clone();
            import_test_plan.id = Uuid::new_v4().to_string();
            for test_case in &mut import_test_plan.test_cases {
                test_case.id = Uuid::new_v4().to_string();
            }
            
            db.save_security_test_plan(&import_test_plan, &target_system.id)?;
            imported_counts.3 += 1;
        }
    }
    
    // Import Baseline Controls
    if let Some(baseline_controls) = &system_data.baseline_controls {
        for control in baseline_controls {
            let mut import_control = control.clone();
            import_control.system_id = target_system.id.clone();
            import_control.id = format!("{}-{}", import_control.id, Uuid::new_v4());
            
            db.add_baseline_control(&import_control)?;
            imported_counts.4 += 1;
        }
    }
    
    // Import Nessus data
    if let Some(nessus_scans) = &system_data.nessus_scans {
        if let Some(nessus_findings) = &system_data.nessus_findings {
            for scan in nessus_scans {
                let scan_findings: Vec<_> = nessus_findings.iter()
                    .filter(|f| f.scan_id == scan.id)
                    .cloned()
                    .collect();
                
                db.save_nessus_scan_and_findings(scan, &scan_findings, &target_system.id)?;
                imported_counts.5 += 1;
            }
        }
    }
    
    let result_message = format!(
        "System import completed successfully!\n\n\
        Target System: {} (ID: {})\n\
        Imported Data:\n\
        • POAMs: {}\n\
        • Notes: {}\n\
        • STIG Mappings: {}\n\
        • Test Plans: {}\n\
        • Baseline Controls: {}\n\
        • Nessus Scans: {}",
        target_system.name,
        target_system.id,
        imported_counts.0,
        imported_counts.1,
        imported_counts.2,
        imported_counts.3,
        imported_counts.4,
        imported_counts.5
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

#[tauri::command]
pub async fn reset_database(app_handle: AppHandle) -> Result<String, Error> {
    println!("Resetting database - clearing all data and starting fresh");
    
    let mut db = database::get_database(&app_handle)?;
    
    match db.reset_database() {
        Ok(_) => {
            let message = "Database reset completed successfully! All data has been cleared and tables recreated.";
            println!("{}", message);
            Ok(message.to_string())
        }
        Err(e) => {
            let error_message = format!("Failed to reset database: {}", e);
            println!("{}", error_message);
            Err(Error::Database(e))
        }
    }
}