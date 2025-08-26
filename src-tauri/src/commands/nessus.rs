use tauri::AppHandle;
use crate::database;
use std::fs;

#[tauri::command]
pub async fn import_nessus_files(app_handle: AppHandle, file_paths: Vec<String>, system_id: String) -> Result<String, crate::Error> {
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
                            // Capture attributes first
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

                            // Parse inner children to extract CVEs and other details
                            let mut cves: Vec<String> = Vec::new();
                            let mut risk_factor: Option<String> = None;
                            let mut synopsis: Option<String> = None;
                            let mut description: Option<String> = None;
                            let mut solution: Option<String> = None;
                            let mut cvss_base_score: Option<f64> = None;
                            let mut plugin_output: Option<String> = None;

                            // We need a nested buffer for inner parsing
                            let mut inner_buf: Vec<u8> = Vec::new();
                            loop {
                                match reader.read_event_into(&mut inner_buf) {
                                    Ok(Event::Start(e2)) => {
                                        let tag = String::from_utf8_lossy(e2.name().as_ref()).to_string();
                                        match tag.as_str() {
                                            "cve" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { cves.push(t.to_string()); }
                                            }
                                            "risk_factor" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { risk_factor = Some(t.to_string()); }
                                            }
                                            "synopsis" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { synopsis = Some(t.to_string()); }
                                            }
                                            "description" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { description = Some(t.to_string()); }
                                            }
                                            "solution" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { solution = Some(t.to_string()); }
                                            }
                                            "cvss_base_score" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                if let Ok(v) = text.trim().parse::<f64>() { cvss_base_score = Some(v); }
                                            }
                                            "plugin_output" => {
                                                let text = reader.read_text(e2.name()).unwrap_or_default();
                                                let t = text.trim();
                                                if !t.is_empty() { plugin_output = Some(t.to_string()); }
                                            }
                                            _ => {
                                                // skip other tags
                                            }
                                        }
                                    }
                                    Ok(Event::End(e2)) => {
                                        // End of this ReportItem
                                        if e2.name().as_ref() == b"ReportItem" { break; }
                                    }
                                    Ok(Event::Eof) => break,
                                    Err(e) => return Err(crate::Error::Nessus(format!("Error parsing Nessus ReportItem: {}", e))),
                                    _ => {}
                                }
                                inner_buf.clear();
                            }

                            let cve_joined = if cves.is_empty() { None } else { Some(cves.join(", ")) };
                            let raw_json = json!({
                                "cves": cves,
                                "plugin_output": plugin_output
                            });

                            let finding = database::nessus::NessusFinding {
                                id: Uuid::new_v4().to_string(),
                                scan_id: String::new(), // set after scan id is known
                                plugin_id,
                                plugin_name,
                                severity,
                                risk_factor,
                                cve: cve_joined,
                                cvss_base_score,
                                host: current_host.clone(),
                                port,
                                protocol,
                                synopsis,
                                description,
                                solution,
                                raw_json,
                            };
                            findings.push(finding);
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(crate::Error::Nessus(format!("Error parsing Nessus XML: {}", e))),
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
pub async fn get_nessus_scans(app_handle: AppHandle, system_id: String) -> Result<Vec<database::nessus::NessusScanMeta>, crate::Error> {
    let db = database::get_database(&app_handle)?;
    let scans = db.get_nessus_scans(&system_id)?;
    Ok(scans)
}

#[tauri::command]
pub async fn get_nessus_findings_by_scan(app_handle: AppHandle, scan_id: String, system_id: String) -> Result<Vec<database::nessus::NessusFinding>, crate::Error> {
    let db = database::get_database(&app_handle)?;
    let findings = db.get_nessus_findings_by_scan(&scan_id, &system_id)?;
    Ok(findings)
}

#[tauri::command]
pub async fn clear_nessus_data(app_handle: AppHandle, system_id: String) -> Result<String, crate::Error> {
    println!("Clearing Nessus scans and findings for system: {}", system_id);
    let mut db = database::get_database(&app_handle)?;
    db.clear_all_nessus_data_for_system(&system_id)?;
    Ok("Nessus data cleared".to_string())
}

#[tauri::command]
pub async fn save_nessus_prep_list(app_handle: AppHandle, prep: database::nessus::NessusPrepList, system_id: String) -> Result<(), crate::Error> {
    let mut db = database::get_database(&app_handle)?;
    db.save_nessus_prep_list(&prep, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn get_all_nessus_prep_lists(app_handle: AppHandle, system_id: String) -> Result<Vec<database::nessus::NessusPrepList>, crate::Error> {
    let db = database::get_database(&app_handle)?;
    let lists = db.get_all_nessus_prep_lists(&system_id)?;
    Ok(lists)
}

#[tauri::command]
pub async fn get_nessus_prep_list_by_id(app_handle: AppHandle, id: String, system_id: String) -> Result<Option<database::nessus::NessusPrepList>, crate::Error> {
    let db = database::get_database(&app_handle)?;
    let prep_list = db.get_nessus_prep_list_by_id(&id, &system_id)?;
    Ok(prep_list)
}

#[tauri::command]
pub async fn update_nessus_prep_list(app_handle: AppHandle, prep_list: database::nessus::NessusPrepList, system_id: String) -> Result<(), crate::Error> {
    let mut db = database::get_database(&app_handle)?;
    db.update_nessus_prep_list(&prep_list, &system_id)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_nessus_prep_list(app_handle: AppHandle, id: String, system_id: String) -> Result<(), crate::Error> {
    let mut db = database::get_database(&app_handle)?;
    db.delete_nessus_prep_list(&id, &system_id)?;
    Ok(())
}
