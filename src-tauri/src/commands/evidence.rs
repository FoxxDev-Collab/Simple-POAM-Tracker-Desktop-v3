use tauri::{AppHandle, Manager};
use crate::{database, models, Error};
use std::fs;

// Evidence file handling commands

#[tauri::command]
pub async fn copy_evidence_files(
    app_handle: AppHandle, 
    plan_id: String, 
    test_case_id: String, 
    file_paths: Vec<String>
) -> Result<Vec<String>, Error> {
    println!(
        "Copying {} evidence files for test case {} in plan {}",
        file_paths.len(), test_case_id, plan_id
    );

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
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
            let relative_path = format!(
                "evidence/{}/{}/{}",
                plan_id,
                test_case_id,
                file_name.to_string_lossy()
            );
            copied_files.push(relative_path);

            println!("Copied {} to {}", file_path, dest_path.display());
        }
    }

    Ok(copied_files)
}

#[tauri::command]
pub async fn delete_evidence_file(
    app_handle: AppHandle, 
    plan_id: String, 
    test_case_id: String, 
    file_name: String
) -> Result<(), Error> {
    println!(
        "Deleting evidence file {} for test case {} in plan {}",
        file_name, test_case_id, plan_id
    );

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

    let file_path = app_data_dir
        .join("evidence")
        .join(&plan_id)
        .join(&test_case_id)
        .join(&file_name);

    if file_path.exists() {
        fs::remove_file(&file_path)?;
        println!("Deleted evidence file: {}", file_path.display());
    }

    Ok(())
}

#[tauri::command]
pub async fn export_evidence_package(
    app_handle: AppHandle, 
    export_path: String, 
    test_plan: models::SecurityTestPlan
) -> Result<(), Error> {
    println!("Exporting evidence package for test plan: {}", test_plan.name);

    use std::io::Write;
    use zip::write::FileOptions;

    let file = fs::File::create(&export_path)?;
    let mut zip = zip::ZipWriter::new(file);

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

    // Add test plan JSON
    let test_plan_json = serde_json::to_string_pretty(&test_plan)?;
    zip.start_file("test_plan.json", FileOptions::default())?;
    zip.write_all(test_plan_json.as_bytes())?;

    // Create evidence manifest
    let mut manifest = Vec::new();
    manifest.push("# Evidence Package Manifest".to_string());
    manifest.push(format!("Test Plan: {}", test_plan.name));
    manifest.push(format!(
        "Description: {}",
        test_plan.description.unwrap_or_default()
    ));
    manifest.push(format!(
        "Generated: {}",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ));
    manifest.push("".to_string());
    manifest.push("## Test Cases and Evidence:".to_string());

    // Add evidence files for each test case
    for test_case in &test_plan.test_cases {
        manifest.push(format!(
            "\n### {} - {}",
            test_case.nist_control, test_case.test_description
        ));
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
                        let zip_path = format!(
                            "evidence/{}/{}",
                            test_case.nist_control,
                            source_path
                                .file_name()
                                .unwrap()
                                .to_string_lossy()
                        );

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
    let completed_tests = test_plan
        .test_cases
        .iter()
        .filter(|tc| matches!(tc.status.as_str(), "Passed" | "Failed" | "Not Applicable"))
        .count();
    let tests_with_evidence = test_plan
        .test_cases
        .iter()
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
        if test_plan.test_cases.is_empty() { 0.0 } else { (completed_tests as f64 / test_plan.test_cases.len() as f64) * 100.0 },
        tests_with_evidence,
        if test_plan.test_cases.is_empty() { 0.0 } else { (tests_with_evidence as f64 / test_plan.test_cases.len() as f64) * 100.0 },
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    zip.start_file("SUMMARY.md", FileOptions::default())?;
    zip.write_all(summary.as_bytes())?;

    zip.finish()?;

    println!("Evidence package exported to: {}", export_path);
    Ok(())
}

#[tauri::command]
pub async fn open_file_with_default_app(file_path: String) -> Result<(), Error> {
    println!("Opening file with default app: {}", file_path);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd").args(["/C", "start", "", &file_path]).spawn()?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&file_path).spawn()?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&file_path).spawn()?;
    }

    Ok(())
}
