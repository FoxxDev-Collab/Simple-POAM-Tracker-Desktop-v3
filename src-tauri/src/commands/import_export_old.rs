use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};
use zip::write::FileOptions;
use crate::{database, models, Error};
use uuid::Uuid;

// Import helper structures
#[derive(Debug, Default)]
struct ImportCounts {
    poams: usize,
    notes: usize,
    stig_mappings: usize,
    test_plans: usize,
    baseline_controls: usize,
    nessus_scans: usize,
    nessus_findings: usize,
}

// Validation Functions
fn validate_system_export_data(data: &models::SystemExportData) -> Result<(), Error> {
    // Basic validation to ensure data integrity
    if data.system.name.trim().is_empty() {
        return Err(Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "System name cannot be empty"
        )));
    }
    
    // Validate POAM IDs are unique
    let mut poam_ids = std::collections::HashSet::new();
    for poam in &data.poams {
        if !poam_ids.insert(poam.id) {
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Duplicate POAM ID found: {}", poam.id)
            )));
        }
    }
    
    // Validate note IDs are unique
    let mut note_ids = std::collections::HashSet::new();
    for note in &data.notes {
        if !note_ids.insert(&note.id) {
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Duplicate Note ID found: {}", note.id)
            )));
        }
    }
    
    println!("System export data validation passed");
    Ok(())
}

fn validate_group_export_data(data: &models::GroupExportData) -> Result<(), Error> {
    // Basic validation to ensure data integrity
    if data.group.name.trim().is_empty() {
        return Err(Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Group name cannot be empty"
        )));
    }
    
    // Validate each system in the group
    for system_data in &data.systems {
        validate_system_export_data(system_data)?;
    }
    
    // Validate system IDs are unique within the group
    let mut system_ids = std::collections::HashSet::new();
    for system_data in &data.systems {
        if !system_ids.insert(&system_data.system.id) {
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Duplicate System ID found in group: {}", system_data.system.id)
            )));
        }
    }
    
    println!("Group export data validation passed");
    Ok(())
}

// Evidence Import Helper
async fn import_evidence_from_zip(
    app_handle: &AppHandle,
    zip_path: &str,
    _original_system_id: &str,
    new_system_id: &str
) -> Result<(), Error> {
    use zip::read::ZipArchive;
    
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    let zip_file = fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(zip_file)?;
    
    let evidence_base_dir = app_data_dir.join("evidence").join(new_system_id);
    fs::create_dir_all(&evidence_base_dir)?;
    
    let mut imported_count = 0;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let file_path = file.name();
        
        // Only process evidence files
        if file_path.starts_with("evidence/") && !file_path.ends_with('/') {
            // Create the directory structure
            let target_path = evidence_base_dir.join(
                file_path.strip_prefix("evidence/").unwrap_or(file_path)
            );
            
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            
            // Copy the file
            let mut output_file = fs::File::create(&target_path)?;
            std::io::copy(&mut file, &mut output_file)?;
            imported_count += 1;
            
            println!("Imported evidence file: {}", target_path.display());
        }
    }
    
    println!("Imported {} evidence files for system {}", imported_count, new_system_id);
    Ok(())
}

// System Export/Import Commands

#[tauri::command]
pub async fn export_complete_system_backup(
    app_handle: AppHandle, 
    export_path: String, 
    system_id: String
) -> Result<String, Error> {
    println!("Creating complete system backup for system: {}", system_id);
    
    let mut db = database::get_database(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Get system information
    let system = db.get_system_by_id(&system_id)?
        .ok_or_else(|| Error::Database(database::DatabaseError::NotFound("System not found".to_string())))?;
    
    // Get all data for this system
    let poams = db.get_all_poams(&system_id)?;
    let notes = db.get_all_notes(&system_id)?;
    let stig_mappings = db.get_all_stig_mappings(&system_id)?;
    let test_plans = db.get_all_security_test_plans(&system_id)?;
    let prep_lists = db.get_all_stp_prep_lists(&system_id)?;
    let baseline_controls = db.get_baseline_controls(&system_id)?;
    
    // Get Nessus data for this system
    let nessus_scans = db.get_nessus_scans(&system_id)?;
    let mut all_nessus_findings = Vec::new();
    for scan in &nessus_scans {
        let mut findings = db.get_nessus_findings_by_scan(&scan.id, &system_id)?;
        all_nessus_findings.append(&mut findings);
    }
    let nessus_prep_lists = db.get_all_nessus_prep_lists(&system_id)?;
    
    // Get POAM control associations
    let mut poam_control_associations = Vec::new();
    for poam in &poams {
        let mut associations = db.get_control_poam_associations_by_poam(poam.id, &system_id)?;
        poam_control_associations.append(&mut associations);
    }
    
    // Create system export data
    let system_export = models::SystemExportData {
        system: system.clone(),
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
    
    // Create ZIP file
    let file = fs::File::create(&export_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    // Add system backup JSON to ZIP
    let json = serde_json::to_string_pretty(&system_export)?;
    zip.start_file("system_backup.json", FileOptions::default())?;
    zip.write_all(json.as_bytes())?;
    
    // Copy evidence files
    let mut evidence_count = 0;
    let mut manifest = vec!["# System Backup Evidence Files Manifest".to_string()];
    manifest.push(format!("System: {}", system.name));
    manifest.push(String::new());
    
    if let Some(test_plans) = &system_export.test_plans {
        for (plan_idx, test_plan) in test_plans.iter().enumerate() {
            manifest.push(format!("## Test Plan: {}", test_plan.name));
            
            for (case_idx, test_case) in test_plan.test_cases.iter().enumerate() {
                if let Some(evidence_files) = &test_case.evidence_files {
                    manifest.push(format!("### Test Case: {}", test_case.test_description));
                    
                    for (file_idx, evidence_file) in evidence_files.iter().enumerate() {
                        let source_path = app_data_dir.join(&evidence_file);
                        
                        if source_path.exists() {
                            let zip_path = format!("evidence/plan_{}/case_{}/file_{}/{}", 
                                                 plan_idx, case_idx, file_idx,
                                                 source_path.file_name().unwrap_or_default().to_string_lossy());
                            
                            manifest.push(format!("- {}: {}", zip_path, evidence_file));
                            
                            match fs::read(&source_path) {
                                Ok(file_data) => {
                                    zip.start_file(&zip_path, FileOptions::default())?;
                                    zip.write_all(&file_data)?;
                                    evidence_count += 1;
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
    
    // Add evidence manifest
    zip.start_file("EVIDENCE_MANIFEST.txt", FileOptions::default())?;
    zip.write_all(manifest.join("\n").as_bytes())?;
    
    // Create system summary
    let summary = format!(
        "# {} - Complete System Backup\n\n\
        **Backup Date:** {}\n\
        **System Description:** {}\n\
        **Export Version:** 2.2 (System ZIP format with evidence files)\n\n\
        ## System Contents\n\
        - {} POAMs\n\
        - {} Notes\n\
        - {} STIG Mappings\n\
        - {} Security Test Plans\n\
        - {} STP Prep Lists\n\
        - {} Baseline Controls\n\
        - {} POAM/Control Associations\n\
        - {} Nessus Scans\n\
        - {} Nessus Findings\n\
        - {} Nessus Prep Lists\n\
        - {} Evidence Files\n\n\
        This is a complete system backup that includes all metadata, configurations, \
        and evidence files. Import this ZIP file to restore the system with \
        full data integrity and evidence preservation.",
        system.name,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
        system.description.as_deref().unwrap_or("No description"),
        system_export.poams.len(),
        system_export.notes.len(),
        system_export.stig_mappings.as_ref().map_or(0, |v| v.len()),
        system_export.test_plans.as_ref().map_or(0, |v| v.len()),
        system_export.prep_lists.as_ref().map_or(0, |v| v.len()),
        system_export.baseline_controls.as_ref().map_or(0, |v| v.len()),
        system_export.poam_control_associations.as_ref().map_or(0, |v| v.len()),
        system_export.nessus_scans.as_ref().map_or(0, |v| v.len()),
        system_export.nessus_findings.as_ref().map_or(0, |v| v.len()),
        system_export.nessus_prep_lists.as_ref().map_or(0, |v| v.len()),
        evidence_count
    );
    
    zip.start_file("SYSTEM_SUMMARY.md", FileOptions::default())?;
    zip.write_all(summary.as_bytes())?;
    
    zip.finish()?;
    
    let file_size = fs::metadata(&export_path)?.len();
    let size_mb = file_size as f64 / 1024.0 / 1024.0;
    
    let result_message = format!(
        "System backup export completed successfully!\n\n\
        System: {}\n\
        POAMs: {}\n\
        Notes: {}\n\
        STIG Mappings: {}\n\
        Test Plans: {}\n\
        Evidence Files: {}\n\
        File Size: {:.2} MB\n\n\
        Export saved to: {}",
        system.name,
        system_export.poams.len(),
        system_export.notes.len(),
        system_export.stig_mappings.as_ref().map_or(0, |v| v.len()),
        system_export.test_plans.as_ref().map_or(0, |v| v.len()),
        evidence_count,
        size_mb,
        export_path
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

#[tauri::command]
pub async fn export_complete_group_backup(
    app_handle: AppHandle, 
    export_path: String, 
    group_id: String
) -> Result<String, Error> {
    println!("Creating complete group backup for group: {}", group_id);
    
    let mut db = database::get_database(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Get group information
    let group = db.get_group_by_id(&group_id)?
        .ok_or_else(|| Error::Database(database::DatabaseError::NotFound("Group not found".to_string())))?;
    
    // Get all systems in the group
    let group_systems = db.get_systems_in_group(&group_id)?;
    println!("Found {} systems in group", group_systems.len());
    
    // Export each system's complete data
    let mut system_exports = Vec::new();
    let mut total_evidence_files = 0;
    
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
    
    // Create group export data structure
    let group_export_data = models::GroupExportData {
        group: group.clone(),
        systems: system_exports,
        export_date: Some(chrono::Utc::now().to_rfc3339()),
        export_version: Some("3.0".to_string()),
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

// Import Functions with Comprehensive Validation

#[tauri::command]
pub async fn import_system_backup(
    app_handle: AppHandle, 
    file_path: String, 
    import_options: models::ImportOptions
) -> Result<String, Error> {
    use std::io::Read;
    use zip::read::ZipArchive;
    
    println!("Importing system backup from: {}", file_path);
    
    let _app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    
    // Determine file type based on extension
    let file_extension = std::path::Path::new(&file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    
    let system_data = if file_extension.to_lowercase() == "zip" {
        // Handle ZIP file import
        let zip_file = fs::File::open(&file_path)?;
        let mut archive = ZipArchive::new(zip_file)?;
        
        // Look for system_backup.json in the ZIP
        let mut system_backup_content = None;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            if file.name() == "system_backup.json" {
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                system_backup_content = Some(content);
                break;
            }
        }
        
        let backup_content = system_backup_content.ok_or_else(|| {
            Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "No system_backup.json found in ZIP package"
            ))
        })?;
        
        serde_json::from_str::<models::SystemExportData>(&backup_content)?
    } else {
        // Handle JSON file import (legacy support)
        let file_content = fs::read_to_string(&file_path)?;
        
        // Try to parse as SystemExportData first, fallback to POAMData for legacy support
        if let Ok(system_data) = serde_json::from_str::<models::SystemExportData>(&file_content) {
            system_data
        } else if let Ok(poam_data) = serde_json::from_str::<models::POAMData>(&file_content) {
            // Convert legacy POAMData to SystemExportData
            let system_id = uuid::Uuid::new_v4().to_string();
            let system = models::System {
                id: system_id.clone(),
                name: format!("Imported System {}", chrono::Utc::now().format("%Y-%m-%d %H:%M")),
                description: Some("System imported from legacy POAM data".to_string()),
                created_date: chrono::Utc::now().to_rfc3339(),
                updated_date: chrono::Utc::now().to_rfc3339(),
                owner: None,
                classification: None,
                tags: None,
                is_active: true,
                poam_count: Some(poam_data.poams.len() as i32),
                last_accessed: None,
                group_id: None,
            };
            
            models::SystemExportData {
                system,
                poams: poam_data.poams,
                notes: poam_data.notes,
                stig_mappings: poam_data.stig_mappings,
                test_plans: None,
                prep_lists: None,
                baseline_controls: None,
                poam_control_associations: None,
                nessus_scans: None,
                nessus_findings: None,
                nessus_prep_lists: None,
                export_date: Some(chrono::Utc::now().to_rfc3339()),
                export_version: Some("legacy".to_string()),
            }
        } else {
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid file format. Expected SystemExportData or POAMData JSON."
            )));
        }
    };
    
    // Validate the system data
    validate_system_export_data(&system_data)?;
    
    let mut db = database::get_database(&app_handle)?;
    
    // Generate new IDs if needed to avoid conflicts
    let mut import_system = system_data.system.clone();
    let original_system_id = import_system.id.clone();
    
    // Check for ID conflicts and generate new ID if needed
    if import_options.generate_new_ids || db.get_system_by_id(&import_system.id)?.is_some() {
        import_system.id = uuid::Uuid::new_v4().to_string();
    }
    
    // Check for name conflicts and generate unique name if needed
    if import_options.rename_duplicates {
        let mut proposed_name = format!("{} (Imported {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d"));
        let mut counter = 1;
        
        // Keep trying different names until we find one that doesn't exist
        while db.system_name_exists(&proposed_name)? {
            proposed_name = format!("{} (Imported {} - {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d"), counter);
            counter += 1;
            if counter > 100 { // Safety valve to prevent infinite loops
                proposed_name = format!("{} (Imported {} - {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d-%H%M%S"), Uuid::new_v4().to_string()[..8].to_string());
                break;
            }
        }
        import_system.name = proposed_name;
    }
    
    // Set group if specified in options
    if let Some(target_group_id) = &import_options.target_group_id {
        import_system.group_id = Some(target_group_id.clone());
    }
    
    // Create the system
    println!("Creating system: {}", import_system.name);
    db.create_system(&import_system)?;
    
    let mut imported_counts = ImportCounts::default();
    
    // Import POAMs
    for poam in &system_data.poams {
        if import_options.import_poams {
            let mut import_poam = poam.clone();
            if import_options.generate_new_ids {
                // Generate a new POAM ID by finding the next available ID
                let existing_poams = db.get_all_poams(&import_system.id)?;
                let max_id = existing_poams.iter().map(|p| p.id).max().unwrap_or(0);
                import_poam.id = max_id + 1;
            }
            
            db.create_poam(&import_poam, &import_system.id)?;
            imported_counts.poams += 1;
        }
    }
    
    // Import Notes
    for note in &system_data.notes {
        if import_options.import_notes {
            let mut import_note = note.clone();
            if import_options.generate_new_ids {
                import_note.id = uuid::Uuid::new_v4().to_string();
            }
            
            db.create_note(&import_note, &import_system.id)?;
            imported_counts.notes += 1;
        }
    }
    
    // Import STIG Mappings
    if let Some(stig_mappings) = &system_data.stig_mappings {
        for mapping in stig_mappings {
            if import_options.import_stig_mappings {
                let mut import_mapping = mapping.clone();
                if import_options.generate_new_ids {
                    import_mapping.id = uuid::Uuid::new_v4().to_string();
                }
                
                db.save_stig_mapping(&import_mapping, &import_system.id)?;
                imported_counts.stig_mappings += 1;
            }
        }
    }
    
    // Import Test Plans
    if let Some(test_plans) = &system_data.test_plans {
        for test_plan in test_plans {
            if import_options.import_test_plans {
                let mut import_test_plan = test_plan.clone();
                if import_options.generate_new_ids {
                    import_test_plan.id = uuid::Uuid::new_v4().to_string();
                    for test_case in &mut import_test_plan.test_cases {
                        test_case.id = uuid::Uuid::new_v4().to_string();
                    }
                }
                
                db.save_security_test_plan(&import_test_plan, &import_system.id)?;
                imported_counts.test_plans += 1;
            }
        }
    }
    
    // Import Baseline Controls
    if let Some(baseline_controls) = &system_data.baseline_controls {
        for control in baseline_controls {
            if import_options.import_baseline_controls {
                let mut import_control = control.clone();
                import_control.system_id = import_system.id.clone();
                if import_options.generate_new_ids {
                    import_control.id = format!("{}-{}", import_control.id, uuid::Uuid::new_v4());
                }
                
                db.add_baseline_control(&import_control)?;
                imported_counts.baseline_controls += 1;
            }
        }
    }
    
    // Import Nessus data if present
    if let Some(nessus_scans) = &system_data.nessus_scans {
        if import_options.import_nessus_data {
            for scan in nessus_scans {
                // Get findings for this scan
                let scan_findings: Vec<_> = system_data.nessus_findings
                    .as_ref()
                    .map(|findings| findings.iter().filter(|f| f.scan_id == scan.id).cloned().collect())
                    .unwrap_or_default();
                
                db.save_nessus_scan_and_findings(scan, &scan_findings, &import_system.id)?;
                imported_counts.nessus_scans += 1;
                imported_counts.nessus_findings += scan_findings.len();
            }
        }
    }
    
    // Handle evidence files if it's a ZIP backup
    if file_extension.to_lowercase() == "zip" && import_options.import_evidence_files {
        import_evidence_from_zip(&app_handle, &file_path, &original_system_id, &import_system.id).await?;
    }
    
    let result_message = format!(
        "System import completed successfully!\n\n\
        System: {} (ID: {})\n\
        POAMs: {}\n\
        Notes: {}\n\
        STIG Mappings: {}\n\
        Test Plans: {}\n\
        Baseline Controls: {}\n\
        Nessus Scans: {}\n\
        Nessus Findings: {}",
        import_system.name,
        import_system.id,
        imported_counts.poams,
        imported_counts.notes,
        imported_counts.stig_mappings,
        imported_counts.test_plans,
        imported_counts.baseline_controls,
        imported_counts.nessus_scans,
        imported_counts.nessus_findings
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

#[tauri::command]
pub async fn import_group_backup(
    app_handle: AppHandle,
    file_path: String,
    import_options: models::ImportOptions
) -> Result<String, Error> {
    use std::io::Read;
    use zip::read::ZipArchive;
    
    println!("Importing group backup from: {}", file_path);
    
    // Only ZIP files are supported for group imports
    let file_extension = std::path::Path::new(&file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    
    if file_extension.to_lowercase() != "zip" {
        return Err(Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Group imports only support ZIP format"
        )));
    }
    
    // Open and read the ZIP file
    let zip_file = fs::File::open(&file_path)?;
    let mut archive = ZipArchive::new(zip_file)?;
    
    // Look for group_backup.json in the ZIP
    let mut group_backup_content = None;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        if file.name() == "group_backup.json" {
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            group_backup_content = Some(content);
            break;
        }
    }
    
    let backup_content = group_backup_content.ok_or_else(|| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "No group_backup.json found in ZIP package"
        ))
    })?;
    
    let group_data: models::GroupExportData = serde_json::from_str(&backup_content)?;
    
    // Validate the group data
    validate_group_export_data(&group_data)?;
    
    let mut db = database::get_database(&app_handle)?;
    
    // Generate new group ID if needed to avoid conflicts
    let mut import_group = group_data.group.clone();
    let _original_group_id = import_group.id.clone();
    
    // Check for ID conflicts and generate new ID if needed
    if import_options.generate_new_ids || db.get_group_by_id(&import_group.id)?.is_some() {
        import_group.id = Uuid::new_v4().to_string();
    }
    
    // Check for name conflicts and generate unique name if needed
    if import_options.rename_duplicates {
        let mut proposed_name = format!("{} (Imported {})", import_group.name, chrono::Utc::now().format("%Y-%m-%d"));
        let mut counter = 1;
        
        // Keep trying different names until we find one that doesn't exist
        while db.group_name_exists(&proposed_name)? {
            proposed_name = format!("{} (Imported {} - {})", import_group.name, chrono::Utc::now().format("%Y-%m-%d"), counter);
            counter += 1;
            if counter > 100 { // Safety valve to prevent infinite loops
                proposed_name = format!("{} (Imported {} - {})", import_group.name, chrono::Utc::now().format("%Y-%m-%d-%H%M%S"), Uuid::new_v4().to_string()[..8].to_string());
                break;
            }
        }
        import_group.name = proposed_name;
    }
    
    println!("Starting group import transaction for: {}", import_group.name);
    
    // Create the group first
    println!("Creating group: {}", import_group.name);
    db.create_group(&import_group)?;
    
    let mut total_imported_counts = ImportCounts::default();
    let mut imported_system_names = Vec::new();
    
    // Import each system in the group
    for system_data in &group_data.systems {
        println!("Importing system: {}", system_data.system.name);
        
        // Generate new system ID if needed
        let mut import_system = system_data.system.clone();
        let original_system_id = import_system.id.clone();
        
        // Check for ID conflicts and generate new ID if needed
        if import_options.generate_new_ids || db.get_system_by_id(&import_system.id)?.is_some() {
            import_system.id = Uuid::new_v4().to_string();
        }
        
        // Check for name conflicts and generate unique name if needed
        if import_options.rename_duplicates {
            let mut proposed_name = format!("{} (Imported {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d"));
            let mut counter = 1;
            
            // Keep trying different names until we find one that doesn't exist
            while db.system_name_exists(&proposed_name)? {
                proposed_name = format!("{} (Imported {} - {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d"), counter);
                counter += 1;
                if counter > 100 { // Safety valve to prevent infinite loops
                    proposed_name = format!("{} (Imported {} - {})", import_system.name, chrono::Utc::now().format("%Y-%m-%d-%H%M%S"), Uuid::new_v4().to_string()[..8].to_string());
                    break;
                }
            }
            import_system.name = proposed_name;
        }
        
        // Create the system first without group assignment
        import_system.group_id = None;
        db.create_system(&import_system)?;
        
        let mut system_counts = ImportCounts::default();
        
        // Import system data (POAMs, notes, etc.)
        for poam in &system_data.poams {
            if import_options.import_poams {
                let mut import_poam = poam.clone();
                if import_options.generate_new_ids {
                    // Generate a new POAM ID by finding the next available ID
                    let existing_poams = db.get_all_poams(&import_system.id)?;
                    let max_id = existing_poams.iter().map(|p| p.id).max().unwrap_or(0);
                    import_poam.id = max_id + 1;
                }
                
                db.create_poam(&import_poam, &import_system.id)?;
                system_counts.poams += 1;
            }
        }
        
        for note in &system_data.notes {
            if import_options.import_notes {
                let mut import_note = note.clone();
                if import_options.generate_new_ids {
                    import_note.id = Uuid::new_v4().to_string();
                }
                
                db.create_note(&import_note, &import_system.id)?;
                system_counts.notes += 1;
            }
        }
        
        if let Some(stig_mappings) = &system_data.stig_mappings {
            for mapping in stig_mappings {
                if import_options.import_stig_mappings {
                    let mut import_mapping = mapping.clone();
                    if import_options.generate_new_ids {
                        import_mapping.id = Uuid::new_v4().to_string();
                    }
                    
                    db.save_stig_mapping(&import_mapping, &import_system.id)?;
                    system_counts.stig_mappings += 1;
                }
            }
        }
        
        if let Some(test_plans) = &system_data.test_plans {
            for test_plan in test_plans {
                if import_options.import_test_plans {
                    let mut import_test_plan = test_plan.clone();
                    if import_options.generate_new_ids {
                        import_test_plan.id = Uuid::new_v4().to_string();
                        for test_case in &mut import_test_plan.test_cases {
                            test_case.id = Uuid::new_v4().to_string();
                        }
                    }
                    
                    db.save_security_test_plan(&import_test_plan, &import_system.id)?;
                    system_counts.test_plans += 1;
                }
            }
        }
        
        if let Some(baseline_controls) = &system_data.baseline_controls {
            for control in baseline_controls {
                if import_options.import_baseline_controls {
                    let mut import_control = control.clone();
                    import_control.system_id = import_system.id.clone();
                    if import_options.generate_new_ids {
                        import_control.id = format!("{}-{}", import_control.id, Uuid::new_v4());
                    }
                    
                    db.add_baseline_control(&import_control)?;
                    system_counts.baseline_controls += 1;
                }
            }
        }
        
        // Import Nessus data if present
        if let Some(nessus_scans) = &system_data.nessus_scans {
            if import_options.import_nessus_data {
                for scan in nessus_scans {
                    // Get findings for this scan
                    let scan_findings: Vec<_> = system_data.nessus_findings
                        .as_ref()
                        .map(|findings| findings.iter().filter(|f| f.scan_id == scan.id).cloned().collect())
                        .unwrap_or_default();
                    
                    db.save_nessus_scan_and_findings(scan, &scan_findings, &import_system.id)?;
                    system_counts.nessus_scans += 1;
                    system_counts.nessus_findings += scan_findings.len();
                }
            }
        }
        
        // Handle evidence files import for this system
        if import_options.import_evidence_files {
            match import_evidence_from_zip(&app_handle, &file_path, &original_system_id, &import_system.id).await {
                Ok(_) => println!("Successfully imported evidence for system {}", import_system.name),
                Err(e) => println!("Warning: Failed to import evidence for system {}: {}", import_system.name, e),
            }
        }
        
        // Now add system to group - this should work since both group and system exist
        db.add_system_to_group(&import_group.id, &import_system.id, Some("Import Process"))?;
        println!("Successfully added system {} to group {}", import_system.name, import_group.name);
        
        // Aggregate counts
        total_imported_counts.poams += system_counts.poams;
        total_imported_counts.notes += system_counts.notes;
        total_imported_counts.stig_mappings += system_counts.stig_mappings;
        total_imported_counts.test_plans += system_counts.test_plans;
        total_imported_counts.baseline_controls += system_counts.baseline_controls;
        total_imported_counts.nessus_scans += system_counts.nessus_scans;
        total_imported_counts.nessus_findings += system_counts.nessus_findings;
        
        imported_system_names.push(import_system.name.clone());
        
        println!("Completed importing system: {}", import_system.name);
    }
    
    
    let result_message = format!(
        "Group import completed successfully!\n\n\
        Group: {} (ID: {})\n\
        Systems Imported: {}\n\
        Total POAMs: {}\n\
        Total Notes: {}\n\
        Total STIG Mappings: {}\n\
        Total Test Plans: {}\n\
        Total Baseline Controls: {}\n\
        Total Nessus Scans: {}\n\
        Total Nessus Findings: {}\n\n\
        Imported Systems:\n{}",
        import_group.name,
        import_group.id,
        imported_system_names.len(),
        total_imported_counts.poams,
        total_imported_counts.notes,
        total_imported_counts.stig_mappings,
        total_imported_counts.test_plans,
        total_imported_counts.baseline_controls,
        total_imported_counts.nessus_scans,
        total_imported_counts.nessus_findings,
        imported_system_names.iter()
            .enumerate()
            .map(|(i, name)| format!("{}. {}", i + 1, name))
            .collect::<Vec<_>>()
            .join("\n")
    );
    
    println!("{}", result_message);
    Ok(result_message)
}

// Legacy compatibility functions for existing exports

#[tauri::command]
pub async fn export_json_data(file_path: String, data: String) -> Result<(), Error> {
    println!("Exporting JSON data to: {}", file_path);
    fs::write(file_path, data)?;
    println!("JSON export completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn export_data(app_handle: AppHandle, export_path: String, system_id: String) -> Result<String, Error> {
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
pub async fn import_json_file(app_handle: AppHandle, file_path: String, system_id: String) -> Result<String, Error> {
    let file_content = fs::read_to_string(file_path)?;
    let data: models::POAMData = serde_json::from_str(&file_content)?;
    
    // Get database connection
    let mut db = database::get_database(&app_handle)?;
    
    // Import the data
    db.import_poam_data(&data, &system_id)?;
    
    Ok("Data imported successfully".to_string())
}

// Wrapper function for frontend compatibility
#[tauri::command]
pub async fn import_complete_group_backup(
    app_handle: AppHandle,
    import_path: String
) -> Result<String, Error> {
    println!("Import complete group backup wrapper called with: {}", import_path);
    
    // Create default import options for complete import
    let import_options = models::ImportOptions {
        generate_new_ids: true,
        rename_duplicates: true,
        target_group_id: None,
        import_poams: true,
        import_notes: true,
        import_stig_mappings: true,
        import_test_plans: true,
        import_baseline_controls: true,
        import_nessus_data: true,
        import_evidence_files: true,
        overwrite_existing: false,
    };
    
    // Call the main import function
    import_group_backup(app_handle, import_path, import_options).await
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
