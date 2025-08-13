use crate::models::{Milestone, POAM, POAMData};
use rusqlite::{params, Connection};
use serde_json;
use std::fs;
use tauri::{AppHandle, Manager};
use super::utils::{DatabaseError, normalize_date_format};

pub struct POAMOperations<'a> {
    conn: &'a mut Connection,
}

pub struct POAMQueries<'a> {
    conn: &'a Connection,
}

impl<'a> POAMOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn import_poam_data(&mut self, data: &POAMData, system_id: &str) -> Result<(), DatabaseError> {
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Clear existing data for this system only
        tx.execute("DELETE FROM milestones WHERE poam_id IN (SELECT id FROM poams WHERE system_id = ?1)", params![system_id])?;
        tx.execute("DELETE FROM note_poam_associations WHERE note_id IN (SELECT id FROM notes WHERE system_id = ?1)", params![system_id])?;
        tx.execute("DELETE FROM notes WHERE system_id = ?1", params![system_id])?;
        tx.execute("DELETE FROM poams WHERE system_id = ?1", params![system_id])?;
        
        // Insert POAMs
        for poam in &data.poams {
            // Normalize date formats for consistent storage
            let start_date = normalize_date_format(&poam.start_date);
            let end_date = normalize_date_format(&poam.end_date);
            
            tx.execute(
                "INSERT INTO poams (id, title, description, start_date, end_date, status, priority, risk_level, system_id) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    poam.id,
                    poam.title,
                    poam.description,
                    start_date,
                    end_date,
                    poam.status,
                    poam.priority,
                    poam.risk_level,
                    system_id
                ],
            )?;
            
            // Insert milestones
            for milestone in &poam.milestones {
                // Normalize date format for consistent storage
                let due_date = normalize_date_format(&milestone.due_date);
                
                tx.execute(
                    "INSERT INTO milestones (id, poam_id, title, due_date, status, description) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        milestone.id,
                        poam.id,
                        milestone.title,
                        due_date,
                        milestone.status,
                        milestone.description
                    ],
                )?;
            }
        }
        
        // Insert Notes
        for note in &data.notes {
            // Convert tags vector to JSON string
            let tags_json = match &note.tags {
                Some(tags) => Some(serde_json::to_string(tags).unwrap_or_default()),
                None => None
            };
            
            tx.execute(
                "INSERT INTO notes (id, title, content, date, folder, tags, system_id) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    note.id,
                    note.title,
                    note.content,
                    note.date,
                    note.folder,
                    tags_json,
                    system_id
                ],
            )?;
            
            // Insert note-POAM associations
            if let Some(poam_ids) = &note.poam_ids {
                for poam_id in poam_ids {
                    tx.execute(
                        "INSERT INTO note_poam_associations (note_id, poam_id) 
                         VALUES (?1, ?2)",
                        params![note.id, poam_id],
                    )?;
                }
            }
        }
        
        // Commit the transaction
        tx.commit()?;
        
        Ok(())
    }

    pub fn create_poam(&mut self, poam: &POAM, system_id: &str) -> Result<(), DatabaseError> {
        println!("Creating new POAM: id={}, title={} in system: {}", poam.id, poam.title, system_id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Normalize date formats for consistent storage
        let start_date = normalize_date_format(&poam.start_date);
        let end_date = normalize_date_format(&poam.end_date);
        
        // Insert the POAM
        tx.execute(
            "INSERT INTO poams (id, title, description, start_date, end_date, status, priority, risk_level, system_id,
                                resources, source_identifying_vulnerability, raw_severity, severity,
                                relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected,
                                source_stig_mapping_id, selected_vulnerabilities) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            params![
                poam.id,
                poam.title,
                poam.description,
                start_date,
                end_date,
                poam.status,
                poam.priority,
                poam.risk_level,
                system_id,
                poam.resources,
                poam.source_identifying_vulnerability,
                poam.raw_severity,
                poam.severity,
                poam.relevance_of_threat,
                poam.likelihood,
                poam.impact,
                poam.residual_risk,
                poam.mitigations,
                poam.devices_affected,
                poam.source_stig_mapping_id,
                poam.selected_vulnerabilities.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default())
            ],
        )?;
        
        // Insert milestones
        for milestone in &poam.milestones {
            let due_date = normalize_date_format(&milestone.due_date);
            
            tx.execute(
                "INSERT INTO milestones (id, poam_id, title, due_date, status, description) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    milestone.id,
                    poam.id,
                    milestone.title,
                    due_date,
                    milestone.status,
                    milestone.description
                ],
            )?;
        }
        
        // Commit the transaction
        tx.commit()?;
        
        println!("Successfully created POAM with id: {}", poam.id);
        Ok(())
    }

    pub fn update_poam(&mut self, poam: &POAM, system_id: &str) -> Result<(), DatabaseError> {
        println!("Updating POAM: id={}, title={}, milestones count={} in system: {}", 
            poam.id, poam.title, poam.milestones.len(), system_id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Update the POAM
        let start_date = normalize_date_format(&poam.start_date);
        let end_date = normalize_date_format(&poam.end_date);
        
        tx.execute(
            "UPDATE poams 
             SET title = ?1, description = ?2, start_date = ?3, end_date = ?4, 
                 status = ?5, priority = ?6, risk_level = ?7,
                 resources = ?8, source_identifying_vulnerability = ?9, raw_severity = ?10, severity = ?11,
                 relevance_of_threat = ?12, likelihood = ?13, impact = ?14, residual_risk = ?15,
                 mitigations = ?16, devices_affected = ?17, source_stig_mapping_id = ?18, selected_vulnerabilities = ?19
             WHERE id = ?20 AND system_id = ?21",
            params![
                poam.title,
                poam.description,
                start_date,
                end_date,
                poam.status,
                poam.priority,
                poam.risk_level,
                poam.resources,
                poam.source_identifying_vulnerability,
                poam.raw_severity,
                poam.severity,
                poam.relevance_of_threat,
                poam.likelihood,
                poam.impact,
                poam.residual_risk,
                poam.mitigations,
                poam.devices_affected,
                poam.source_stig_mapping_id,
                poam.selected_vulnerabilities.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()),
                poam.id,
                system_id
            ],
        )?;
        
        // Delete existing milestones for this POAM
        tx.execute(
            "DELETE FROM milestones WHERE poam_id = ?1",
            params![poam.id],
        )?;
        
        // Insert new milestones
        for milestone in &poam.milestones {
            let due_date = normalize_date_format(&milestone.due_date);
            
            tx.execute(
                "INSERT INTO milestones (id, poam_id, title, due_date, status, description) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    milestone.id,
                    poam.id,
                    milestone.title,
                    due_date,
                    milestone.status,
                    milestone.description
                ],
            )?;
        }
        
        // Commit the transaction
        tx.commit()?;
        
        println!("POAM updated successfully");
        Ok(())
    }

    pub fn update_milestone_status(&mut self, milestone_id: &str, poam_id: i64, status: &str, system_id: &str) -> Result<(), DatabaseError> {
        println!("Updating milestone status: milestone_id={}, poam_id={}, status={}, system_id={}", milestone_id, poam_id, status, system_id);
        
        // Verify the milestone belongs to the specified POAM and system
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM milestones m 
             JOIN poams p ON m.poam_id = p.id 
             WHERE m.id = ?1 AND p.id = ?2 AND p.system_id = ?3",
            params![milestone_id, poam_id, system_id],
            |row| row.get(0)
        )?;
        
        if count == 0 {
            return Err(DatabaseError::ClearDatabase(
                format!("Milestone {} not found for POAM {} in system {}", milestone_id, poam_id, system_id)
            ));
        }
        
        // Update the milestone status
        let updated_rows = self.conn.execute(
            "UPDATE milestones SET status = ?1 WHERE id = ?2 AND poam_id = ?3",
            params![status, milestone_id, poam_id],
        )?;
        
        if updated_rows == 0 {
            return Err(DatabaseError::ClearDatabase(
                format!("Failed to update milestone {} status", milestone_id)
            ));
        }
        
        println!("Successfully updated milestone {} status to {}", milestone_id, status);
        Ok(())
    }

    pub fn delete_poam(&mut self, poam_id: i64, system_id: &str) -> Result<(), DatabaseError> {
        println!("Deleting POAM: id={} in system: {}", poam_id, system_id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Verify the POAM belongs to the specified system
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM poams WHERE id = ?1 AND system_id = ?2",
            params![poam_id, system_id],
            |row| row.get(0)
        )?;
        
        if count == 0 {
            return Err(DatabaseError::ClearDatabase(
                format!("POAM {} not found in system {}", poam_id, system_id)
            ));
        }
        
        // Delete related data (CASCADE should handle this, but let's be explicit)
        
        // 1. Delete note-POAM associations
        let note_associations_deleted = tx.execute(
            "DELETE FROM note_poam_associations WHERE poam_id = ?1",
            params![poam_id],
        )?;
        println!("Deleted {} note associations for POAM {}", note_associations_deleted, poam_id);
        
        // 2. Delete milestones
        let milestones_deleted = tx.execute(
            "DELETE FROM milestones WHERE poam_id = ?1",
            params![poam_id],
        )?;
        println!("Deleted {} milestones for POAM {}", milestones_deleted, poam_id);
        
        // 3. Delete control-POAM associations if they exist
        let control_associations_deleted = tx.execute(
            "DELETE FROM control_poam_associations WHERE poam_id = ?1",
            params![poam_id],
        ).unwrap_or(0); // This table might not exist in all setups
        if control_associations_deleted > 0 {
            println!("Deleted {} control associations for POAM {}", control_associations_deleted, poam_id);
        }
        
        // 4. Update any security test plans that reference this POAM
        let test_plans_updated = tx.execute(
            "UPDATE security_test_plans SET poam_id = NULL WHERE poam_id = ?1",
            params![poam_id],
        ).unwrap_or(0);
        if test_plans_updated > 0 {
            println!("Updated {} security test plans to remove POAM {} reference", test_plans_updated, poam_id);
        }
        
        // 5. Finally, delete the POAM itself
        let poam_deleted = tx.execute(
            "DELETE FROM poams WHERE id = ?1 AND system_id = ?2",
            params![poam_id, system_id],
        )?;
        
        if poam_deleted == 0 {
            return Err(DatabaseError::ClearDatabase(
                format!("Failed to delete POAM {}", poam_id)
            ));
        }
        
        // Commit the transaction
        tx.commit()?;
        
        println!("Successfully deleted POAM {} and all related data", poam_id);
        Ok(())
    }

    pub fn clear_database(&mut self) -> Result<(), DatabaseError> {
        println!("Starting database clearing process");
        
        // Start a transaction
        let tx = self.conn.transaction()
            .map_err(|e| {
                let error_msg = format!("Failed to start transaction: {}", e);
                println!("Error: {}", error_msg);
                DatabaseError::ClearDatabase(error_msg)
            })?;
        
        // Clear all tables with error handling
        let tables = vec![
            "note_poam_associations",
            "milestones", 
            "poams",
            "notes",
            "stp_prep_lists",
            "security_test_plans", 
            "stig_mappings"
        ];
        
        for table_name in tables {
            match tx.execute(&format!("DELETE FROM {}", table_name), params![]) {
                Ok(rows) => println!("Deleted {} rows from {} table", rows, table_name),
                Err(e) => {
                    let error_msg = format!("Failed to clear {} table: {}", table_name, e);
                    println!("Error: {}", error_msg);
                    return Err(DatabaseError::ClearDatabase(error_msg));
                }
            }
        }
        
        // Commit the transaction with error handling
        match tx.commit() {
            Ok(_) => {
                println!("Database cleared successfully");
                Ok(())
            },
            Err(e) => {
                let error_msg = format!("Failed to commit transaction: {}", e);
                println!("Error: {}", error_msg);
                Err(DatabaseError::ClearDatabase(error_msg))
            }
        }
    }

    pub fn delete_database_file(app_handle: &AppHandle) -> Result<(), DatabaseError> {
        println!("Starting database file deletion process");
        
        // Use Tauri's app data directory for proper cross-platform support
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| DatabaseError::AppDir(format!("Failed to get app data directory: {}", e)))?;
        let db_path = app_dir.join("poam_tracker.db");
        
        // Check if the file exists
        if !db_path.exists() {
            println!("Database file does not exist, nothing to delete");
            return Ok(());
        }
        
        // Release any connections from the singleton
        {
            use super::utils::DB;
            println!("Attempting to close database connections before deletion");
            let mut db_guard = DB.lock().unwrap();
            *db_guard = None;
            println!("Database connection released");
        }
        
        // Sleep briefly to ensure connection is fully closed
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Delete the file
        match fs::remove_file(&db_path) {
            Ok(_) => {
                println!("Database file deleted successfully: {:?}", db_path);
                Ok(())
            },
            Err(e) => {
                let error_msg = format!("Failed to delete database file: {}", e);
                println!("Error: {}", error_msg);
                Err(DatabaseError::ClearDatabase(error_msg))
            }
        }
    }
}

impl<'a> POAMQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_all_poams(&self, system_id: &str) -> Result<Vec<POAM>, DatabaseError> {
        let mut poam_stmt = self.conn.prepare(
            "SELECT id, title, description, start_date, end_date, status, priority, risk_level,
                    resources, source_identifying_vulnerability, raw_severity, severity,
                    relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected,
                    source_stig_mapping_id, selected_vulnerabilities
             FROM poams 
             WHERE system_id = ?1
             ORDER BY id"
        )?;
        
        let mut milestone_stmt = self.conn.prepare(
            "SELECT id, title, due_date, status, description
             FROM milestones
             WHERE poam_id = ?1
             ORDER BY due_date"
        )?;
        
        let poam_rows = poam_stmt.query_map(params![system_id], |row| {
            Ok(POAM {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start_date: row.get(3)?,
                end_date: row.get(4)?,
                status: row.get(5)?,
                priority: row.get(6)?,
                risk_level: row.get(7)?,
                milestones: Vec::new(),
                // Enhanced fields (handle backward compatibility with Option)
                resources: row.get::<_, Option<String>>(8)?,
                source_identifying_vulnerability: row.get::<_, Option<String>>(9)?,
                raw_severity: row.get::<_, Option<String>>(10)?,
                severity: row.get::<_, Option<String>>(11)?,
                relevance_of_threat: row.get::<_, Option<String>>(12)?,
                likelihood: row.get::<_, Option<String>>(13)?,
                impact: row.get::<_, Option<String>>(14)?,
                residual_risk: row.get::<_, Option<String>>(15)?,
                mitigations: row.get::<_, Option<String>>(16)?,
                devices_affected: row.get::<_, Option<String>>(17)?,
                source_stig_mapping_id: row.get::<_, Option<String>>(18)?,
                selected_vulnerabilities: {
                    let vuln_json: Option<String> = row.get(19)?;
                    vuln_json.and_then(|json| serde_json::from_str(&json).ok())
                },
            })
        })?;
        
        let mut poams = Vec::new();
        for poam_result in poam_rows {
            let mut poam = poam_result?;
            
            let milestone_rows = milestone_stmt.query_map(params![poam.id], |row| {
                Ok(Milestone {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    due_date: row.get(2)?,
                    status: row.get(3)?,
                    description: row.get(4)?,
                })
            })?;
            
            for milestone_result in milestone_rows {
                poam.milestones.push(milestone_result?);
            }
            
            poams.push(poam);
        }
        
        Ok(poams)
    }

    pub fn get_poam_by_id(&self, id: i64, system_id: &str) -> Result<Option<POAM>, DatabaseError> {
        let mut poam_stmt = self.conn.prepare(
            "SELECT id, title, description, start_date, end_date, status, priority, risk_level,
                    resources, source_identifying_vulnerability, raw_severity, severity,
                    relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected,
                    source_stig_mapping_id, selected_vulnerabilities
             FROM poams 
             WHERE id = ?1 AND system_id = ?2"
        )?;
        
        let mut milestone_stmt = self.conn.prepare(
            "SELECT id, title, due_date, status, description
             FROM milestones
             WHERE poam_id = ?1
             ORDER BY due_date"
        )?;
        
        let poam_result = poam_stmt.query_row(params![id, system_id], |row| {
            Ok(POAM {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start_date: row.get(3)?,
                end_date: row.get(4)?,
                status: row.get(5)?,
                priority: row.get(6)?,
                risk_level: row.get(7)?,
                milestones: Vec::new(),
                // Enhanced fields (handle backward compatibility with Option)
                resources: row.get::<_, Option<String>>(8)?,
                source_identifying_vulnerability: row.get::<_, Option<String>>(9)?,
                raw_severity: row.get::<_, Option<String>>(10)?,
                severity: row.get::<_, Option<String>>(11)?,
                relevance_of_threat: row.get::<_, Option<String>>(12)?,
                likelihood: row.get::<_, Option<String>>(13)?,
                impact: row.get::<_, Option<String>>(14)?,
                residual_risk: row.get::<_, Option<String>>(15)?,
                mitigations: row.get::<_, Option<String>>(16)?,
                devices_affected: row.get::<_, Option<String>>(17)?,
                source_stig_mapping_id: row.get::<_, Option<String>>(18)?,
                selected_vulnerabilities: {
                    let vuln_json: Option<String> = row.get(19)?;
                    vuln_json.and_then(|json| serde_json::from_str(&json).ok())
                },
            })
        });
        
        match poam_result {
            Ok(mut poam) => {
                let milestone_rows = milestone_stmt.query_map(params![poam.id], |row| {
                    Ok(Milestone {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        due_date: row.get(2)?,
                        status: row.get(3)?,
                        description: row.get(4)?,
                    })
                })?;
                
                for milestone_result in milestone_rows {
                    poam.milestones.push(milestone_result?);
                }
                
                Ok(Some(poam))
            },
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }
}
