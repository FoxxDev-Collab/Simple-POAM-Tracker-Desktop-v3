use crate::models::{Milestone, POAM, POAMData, Note, STIGMappingData, SecurityTestPlan, StpPrepList, System, SystemSummary, ControlPOAMAssociation, BaselineControl};
use crate::date_utils;
use rusqlite::{Connection, params};
use std::fs;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use thiserror::Error;
use serde_json;


#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),

    #[error("Failed to get app directory: {0}")]
    AppDir(String),
    
    #[error("Failed to clear database: {0}")]
    ClearDatabase(String),
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> Result<Self, DatabaseError> {
        // Use Tauri's app data directory for proper cross-platform support
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| DatabaseError::AppDir(format!("Failed to get app data directory: {}. This may occur in restricted environments. Ensure the application has permission to access user data directories.", e)))?;
        
        // Create the directory if it doesn't exist
        fs::create_dir_all(&app_dir).map_err(|e| {
            let detailed_error = format!(
                "Failed to create data directory at '{}': {}. \
                This may be due to: \
                1) Insufficient user permissions \
                2) Group Policy restrictions \
                3) Antivirus blocking file creation \
                4) Disk space limitations. \
                Please check with your system administrator if this error persists.",
                app_dir.display(),
                e
            );
            DatabaseError::AppDir(detailed_error)
        })?;
        
        let db_path = app_dir.join("poam_tracker.db");
        
        println!("Database path: {:?}", db_path.canonicalize().unwrap_or(db_path.clone()));
        
        let conn = Connection::open(&db_path).map_err(|e| {
            let detailed_error = format!(
                "Failed to open database at '{}': {}. \
                This may be due to: \
                1) File permissions restrictions \
                2) Antivirus blocking database access \
                3) Group Policy preventing SQLite operations \
                4) Corrupted database file. \
                Try running the application as administrator or contact your IT support team.",
                db_path.display(),
                e
            );
            DatabaseError::AppDir(detailed_error)
        })?;
        
        let mut db = Self { conn };
        db.initialize_tables()?;
        
        Ok(db)
    }
    
    fn initialize_tables(&mut self) -> Result<(), DatabaseError> {
        // Create systems table first
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS systems (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                owner TEXT,
                classification TEXT,
                tags TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                last_accessed TEXT
            )",
            params![],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS poams (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS milestones (
                id TEXT PRIMARY KEY,
                poam_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                due_date TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT NOT NULL,
                FOREIGN KEY (poam_id) REFERENCES poams (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                date TEXT NOT NULL,
                folder TEXT,
                tags TEXT,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS note_poam_associations (
                note_id TEXT NOT NULL,
                poam_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, poam_id),
                FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
                FOREIGN KEY (poam_id) REFERENCES poams (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // STIG Mapping tables
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS stig_mappings (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                stig_info TEXT NOT NULL,
                asset_info TEXT NOT NULL,
                mapping_result TEXT NOT NULL,
                cci_mappings TEXT,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Check if we need to add cci_mappings column to existing table
        let has_cci_mappings_column = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('stig_mappings') WHERE name = 'cci_mappings'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;
        
        if !has_cci_mappings_column {
            println!("Adding cci_mappings column to stig_mappings table");
            self.conn.execute(
                "ALTER TABLE stig_mappings ADD COLUMN cci_mappings TEXT",
                params![],
            )?;
        }
        
        // Security Test Plan tables
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS security_test_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                status TEXT NOT NULL,
                poam_id INTEGER,
                stig_mapping_id TEXT,
                test_cases TEXT NOT NULL,
                overall_score REAL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (poam_id) REFERENCES poams (id) ON DELETE SET NULL,
                FOREIGN KEY (stig_mapping_id) REFERENCES stig_mappings (id) ON DELETE SET NULL,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // STP Prep List tables
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS stp_prep_lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                source_mapping_id TEXT,
                stig_info TEXT NOT NULL,
                asset_info TEXT NOT NULL,
                prep_status TEXT NOT NULL,
                selected_controls TEXT NOT NULL,
                control_count INTEGER NOT NULL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (source_mapping_id) REFERENCES stig_mappings (id) ON DELETE SET NULL,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create Control-POAM associations table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS control_poam_associations (
                id TEXT PRIMARY KEY,
                control_id TEXT NOT NULL,
                poam_id INTEGER NOT NULL,
                association_date TEXT NOT NULL,
                created_by TEXT,
                notes TEXT,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (poam_id) REFERENCES poams (id) ON DELETE CASCADE,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create baseline_controls table if it doesn't exist
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS baseline_controls (
                id TEXT NOT NULL,
                family TEXT NOT NULL,
                title TEXT NOT NULL,
                implementation_status TEXT NOT NULL,
                date_added TEXT NOT NULL,
                responsible_party TEXT,
                notes TEXT,
                system_id TEXT NOT NULL,
                PRIMARY KEY (id, system_id),
                FOREIGN KEY (system_id) REFERENCES systems (id)
            )",
            params![],
        )?;
        
        // Migration: Create default system if it doesn't exist
        self.ensure_default_system()?;

        // Migration: Add system_id columns to existing tables
        self.migrate_to_system_schema()?;

        // Check if we need to add folder and tags columns to the notes table
        let has_folder_column = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name = 'folder'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;
        
        if !has_folder_column {
            println!("Adding folder column to notes table");
            self.conn.execute(
                "ALTER TABLE notes ADD COLUMN folder TEXT",
                params![],
            )?;
        }
        
        let has_tags_column = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name = 'tags'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;
        
        if !has_tags_column {
            println!("Adding tags column to notes table");
            self.conn.execute(
                "ALTER TABLE notes ADD COLUMN tags TEXT",
                params![],
            )?;
        }
        
        // Migrate existing data if needed
        // Check if old notes table has poam_id column
        let has_old_schema = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name = 'poam_id'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;
        
        if has_old_schema {
            println!("Migrating note-POAM associations to new schema");
            self.migrate_notes_schema()?;
        }
        
        // Migrate POAM schema to add enhanced fields
        self.migrate_poam_enhanced_fields()?;
        
        Ok(())
    }

    fn migrate_poam_enhanced_fields(&mut self) -> Result<(), DatabaseError> {
        // List of enhanced fields to add
        let enhanced_fields = [
            "resources",
            "source_identifying_vulnerability", 
            "raw_severity",
            "severity",
            "relevance_of_threat",
            "likelihood",
            "impact",
            "residual_risk",
            "mitigations",
            "devices_affected"
        ];

        for field in &enhanced_fields {
            let has_field = self.conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info('poams') WHERE name = ?1",
                params![field],
                |row| row.get::<_, i64>(0)
            ).unwrap_or(0) > 0;

            if !has_field {
                println!("Adding {} column to poams table", field);
                self.conn.execute(
                    &format!("ALTER TABLE poams ADD COLUMN {} TEXT", field),
                    params![],
                )?;
            }
        }

        Ok(())
    }

    fn ensure_default_system(&mut self) -> Result<(), DatabaseError> {
        // Check if default system exists
        let default_exists = self.conn.query_row(
            "SELECT COUNT(*) FROM systems WHERE id = 'default'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;

        if !default_exists {
            let now = chrono::Utc::now().to_rfc3339();
            self.conn.execute(
                "INSERT INTO systems (id, name, description, created_date, updated_date, is_active) 
                 VALUES ('default', 'Default System', 'Default system created during migration', ?1, ?2, 1)",
                params![now, now],
            )?;
            println!("Created default system");
        }

        Ok(())
    }

    fn migrate_to_system_schema(&mut self) -> Result<(), DatabaseError> {
        // Add system_id columns to existing tables if they don't exist
        let tables_to_migrate = vec![
            "poams", "notes", "stig_mappings", "security_test_plans", "stp_prep_lists"
        ];

        for table in tables_to_migrate {
            let has_system_id = self.conn.query_row(
                &format!("SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = 'system_id'", table),
                params![],
                |row| row.get::<_, i64>(0)
            ).unwrap_or(0) > 0;

            if !has_system_id {
                println!("Adding system_id column to {} table", table);
                self.conn.execute(
                    &format!("ALTER TABLE {} ADD COLUMN system_id TEXT NOT NULL DEFAULT 'default'", table),
                    params![],
                )?;
            }
        }

        Ok(())
    }
    
    fn migrate_notes_schema(&mut self) -> Result<(), DatabaseError> {
        println!("Starting note schema migration");
        
        // First, collect all the data we need from the database
        let mut notes_with_poams = Vec::new();
        let mut notes_without_poams = Vec::new();
        
        // Get notes with POAM associations
        {
            let mut stmt = self.conn.prepare(
                "SELECT id, title, content, date, poam_id FROM notes WHERE poam_id IS NOT NULL"
            )?;
            
            let rows = stmt.query_map(params![], |row| {
                Ok((
                    row.get::<_, String>(0)?, // note_id
                    row.get::<_, String>(1)?, // title
                    row.get::<_, String>(2)?, // content
                    row.get::<_, String>(3)?, // date
                    row.get::<_, i64>(4)?     // poam_id
                ))
            })?;
            
            for row_result in rows {
                notes_with_poams.push(row_result?);
            }
        }
        
        // Get notes without POAM associations
        {
            let mut stmt = self.conn.prepare(
                "SELECT id, title, content, date FROM notes WHERE poam_id IS NULL"
            )?;
            
            let rows = stmt.query_map(params![], |row| {
                Ok((
                    row.get::<_, String>(0)?, // note_id
                    row.get::<_, String>(1)?, // title
                    row.get::<_, String>(2)?, // content
                    row.get::<_, String>(3)?  // date
                ))
            })?;
            
            for row_result in rows {
                notes_without_poams.push(row_result?);
            }
        }
        
        // Now perform the migration with all data already collected
        let tx = self.conn.transaction()?;
        
        // Create temporary tables
        tx.execute("CREATE TEMPORARY TABLE temp_notes (id TEXT, title TEXT, content TEXT, date TEXT)", params![])?;
        tx.execute("CREATE TEMPORARY TABLE temp_associations (note_id TEXT, poam_id INTEGER)", params![])?;
        
        // Insert notes with POAM associations
        for (note_id, title, content, date, poam_id) in notes_with_poams {
            tx.execute(
                "INSERT INTO temp_notes (id, title, content, date) VALUES (?1, ?2, ?3, ?4)", 
                params![note_id, title, content, date]
            )?;
            
            tx.execute(
                "INSERT INTO temp_associations (note_id, poam_id) VALUES (?1, ?2)",
                params![note_id, poam_id]
            )?;
        }
        
        // Insert notes without POAM associations
        for (note_id, title, content, date) in notes_without_poams {
            tx.execute(
                "INSERT INTO temp_notes (id, title, content, date) VALUES (?1, ?2, ?3, ?4)", 
                params![note_id, title, content, date]
            )?;
        }
        
        // Drop old table and create new one
        tx.execute("DROP TABLE notes", params![])?;
        tx.execute("CREATE TABLE notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            folder TEXT,
            tags TEXT
        )", params![])?;
        
        // Copy data from temporary tables
        tx.execute("INSERT INTO notes SELECT id, title, content, date, NULL, NULL FROM temp_notes", params![])?;
        tx.execute("INSERT INTO note_poam_associations SELECT note_id, poam_id FROM temp_associations", params![])?;
        
        // Drop temporary tables
        tx.execute("DROP TABLE temp_notes", params![])?;
        tx.execute("DROP TABLE temp_associations", params![])?;
        
        // Commit the transaction
        tx.commit()?;
        
        println!("Migration completed successfully");
        Ok(())
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
                                relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
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
                poam.devices_affected
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
    
    pub fn get_all_poams(&self, system_id: &str) -> Result<Vec<POAM>, DatabaseError> {
        let mut poam_stmt = self.conn.prepare(
            "SELECT id, title, description, start_date, end_date, status, priority, risk_level,
                    resources, source_identifying_vulnerability, raw_severity, severity,
                    relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected
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
                    relevance_of_threat, likelihood, impact, residual_risk, mitigations, devices_affected
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
    
    pub fn update_poam(&mut self, poam: &POAM, system_id: &str) -> Result<(), DatabaseError> {
        println!("Updating POAM: id={}, title={}, milestones count={} in system: {}", 
            poam.id, poam.title, poam.milestones.len(), system_id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Update the POAM
        let start_date = normalize_date_format(&poam.start_date);
        let end_date = normalize_date_format(&poam.end_date);
        
        println!("Normalized dates: start_date={}, end_date={}", start_date, end_date);
        
        tx.execute(
            "UPDATE poams 
             SET title = ?1, description = ?2, start_date = ?3, end_date = ?4, 
                 status = ?5, priority = ?6, risk_level = ?7,
                 resources = ?8, source_identifying_vulnerability = ?9, raw_severity = ?10, severity = ?11,
                 relevance_of_threat = ?12, likelihood = ?13, impact = ?14, residual_risk = ?15,
                 mitigations = ?16, devices_affected = ?17
             WHERE id = ?18 AND system_id = ?19",
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
            
            println!("Inserting milestone: id={}, title={}, due_date={} (normalized from {})", 
                milestone.id, milestone.title, due_date, milestone.due_date);
            
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

    // Note-related methods
    pub fn get_all_notes(&self, system_id: &str) -> Result<Vec<Note>, DatabaseError> {
        println!("Retrieving all notes from database for system: {}", system_id);
        
        let mut stmt = self.conn.prepare(
            "SELECT id, title, content, date, folder, tags FROM notes WHERE system_id = ?1"
        )?;
        
        let notes_iter = stmt.query_map(params![system_id], |row| {
            let id: String = row.get(0)?;
            let title: String = row.get(1)?;
            let content: String = row.get(2)?;
            let date: String = row.get(3)?;
            let folder: Option<String> = row.get(4)?;
            let tags_str: Option<String> = row.get(5)?;
            
            println!("Retrieved note: id={}, title={}", id, title);
            println!("  folder: {:?}", folder);
            println!("  tags_str: {:?}", tags_str);
            
            let tags = if let Some(json_str) = tags_str {
                match serde_json::from_str(&json_str) {
                    Ok(parsed_tags) => {
                        println!("  parsed tags: {:?}", parsed_tags);
                        Some(parsed_tags)
                    },
                    Err(e) => {
                        println!("Error parsing tags JSON: {}", e);
                        None
                    }
                }
            } else {
                println!("  no tags");
                None
            };
            
            Ok(Note {
                id,
                title,
                content,
                date,
                folder,
                tags,
                poam_ids: None,
                poam_titles: None,
            })
        })?;
        
        let mut notes = Vec::new();
        for note_result in notes_iter {
            notes.push(note_result?);
        }
        
        println!("Retrieved {} notes total", notes.len());
        
        // Get all note-poam associations
        let associations = self.get_all_note_poam_associations()?;
        
        // Group associations by note_id
        let mut note_associations: std::collections::HashMap<String, (Vec<i64>, Vec<String>)> = std::collections::HashMap::new();
        
        for (note_id, poam_id, poam_title) in associations {
            let entry = note_associations
                .entry(note_id)
                .or_insert_with(|| (Vec::new(), Vec::new()));
                
            entry.0.push(poam_id);
            entry.1.push(poam_title);
        }
        
        // Attach POAM information to notes
        for note in &mut notes {
            if let Some((poam_ids, poam_titles)) = note_associations.get(&note.id) {
                note.poam_ids = Some(poam_ids.clone());
                note.poam_titles = Some(poam_titles.clone());
            }
        }
        
        Ok(notes)
    }
    
    pub fn get_notes_by_poam(&self, poam_id: i64, system_id: &str) -> Result<Vec<Note>, DatabaseError> {
        // Get all notes associated with the given POAM
        let mut stmt = self.conn.prepare(
            "SELECT n.id, n.title, n.content, n.date, n.folder, n.tags
             FROM notes n
             JOIN note_poam_associations npa ON n.id = npa.note_id
             WHERE npa.poam_id = ?1 AND n.system_id = ?2
             ORDER BY n.date DESC"
        )?;
        
        let mut notes = stmt.query_map(params![poam_id, system_id], |row| {
            let tags_str: Option<String> = row.get(5)?;
            let tags = if let Some(json_str) = tags_str {
                match serde_json::from_str(&json_str) {
                    Ok(parsed_tags) => Some(parsed_tags),
                    Err(e) => {
                        println!("Error parsing tags JSON: {}", e);
                        None
                    }
                }
            } else {
                None
            };
            
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                date: row.get(3)?,
                folder: row.get(4)?,
                tags,
                poam_ids: None,
                poam_titles: None,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        if notes.is_empty() {
            return Ok(notes);
        }
        
        // Get the POAM title
        let poam_title: String = self.conn.query_row(
            "SELECT title FROM poams WHERE id = ?1",
            params![poam_id],
            |row| row.get(0)
        )?;
        
        // Set the POAM information for all notes
        for note in &mut notes {
            note.poam_ids = Some(vec![poam_id]);
            note.poam_titles = Some(vec![poam_title.clone()]);
        }
        
        Ok(notes)
    }
    
    pub fn create_note(&mut self, note: &Note, system_id: &str) -> Result<(), DatabaseError> {
        println!("Creating note: id={}, title={} in system: {}", note.id, note.title, system_id);
        println!("Note folder: {:?}", note.folder);
        println!("Note tags: {:?}", note.tags);
        
        // Convert tags to JSON string if present
        let tags_json = if let Some(tags) = &note.tags {
            println!("Converting tags to JSON: {:?}", tags);
            let json = serde_json::to_string(tags).unwrap_or_default();
            println!("Tags JSON: {}", json);
            json
        } else {
            println!("No tags to convert");
            String::new()
        };
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Insert the note
        println!("Executing INSERT query with folder={:?}, tags={:?}", note.folder, if tags_json.is_empty() { None } else { Some(&tags_json) });
        tx.execute(
            "INSERT INTO notes (id, title, content, date, folder, tags, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                note.id,
                note.title,
                note.content,
                note.date,
                note.folder,
                if tags_json.is_empty() { None } else { Some(tags_json) },
                system_id
            ],
        )?;
        
        // Insert associations if they exist
        if let Some(poam_ids) = &note.poam_ids {
            println!("Adding {} POAM associations for note {}", poam_ids.len(), note.id);
            for &poam_id in poam_ids {
                println!("  Adding association with POAM {}", poam_id);
                let result = tx.execute(
                    "INSERT INTO note_poam_associations (note_id, poam_id)
                     VALUES (?1, ?2)",
                    params![note.id, poam_id],
                );
                
                if let Err(err) = &result {
                    println!("Error inserting association: {}", err);
                }
                
                result?;
            }
        } else {
            println!("No POAMs to associate with note {}", note.id);
        }
        
        // Commit the transaction
        tx.commit()?;
        println!("Note {} created successfully", note.id);
        
        Ok(())
    }
    
    pub fn update_note(&mut self, note: &Note, system_id: &str) -> Result<(), DatabaseError> {
        println!("Updating note: id={}, title={} in system: {}", note.id, note.title, system_id);
        println!("Note folder: {:?}", note.folder);
        println!("Note tags: {:?}", note.tags);
        
        // Convert tags to JSON string if present
        let tags_json = if let Some(tags) = &note.tags {
            println!("Converting tags to JSON: {:?}", tags);
            let json = serde_json::to_string(tags).unwrap_or_default();
            println!("Tags JSON: {}", json);
            json
        } else {
            println!("No tags to convert");
            String::new()
        };
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Update the note
        println!("Executing UPDATE query with folder={:?}, tags={:?}", note.folder, if tags_json.is_empty() { None } else { Some(&tags_json) });
        tx.execute(
            "UPDATE notes 
             SET title = ?2, content = ?3, date = ?4, folder = ?5, tags = ?6
             WHERE id = ?1 AND system_id = ?7",
            params![
                note.id,
                note.title,
                note.content,
                note.date,
                note.folder,
                if tags_json.is_empty() { None } else { Some(tags_json) },
                system_id
            ],
        )?;
        
        // Delete all existing associations
        let deleted = tx.execute(
            "DELETE FROM note_poam_associations WHERE note_id = ?1",
            params![note.id],
        )?;
        println!("Deleted {} existing POAM associations for note {}", deleted, note.id);
        
        // Insert new associations if they exist
        if let Some(poam_ids) = &note.poam_ids {
            println!("Adding {} new POAM associations for note {}", poam_ids.len(), note.id);
            for &poam_id in poam_ids {
                println!("  Adding association with POAM {}", poam_id);
                let result = tx.execute(
                    "INSERT INTO note_poam_associations (note_id, poam_id)
                     VALUES (?1, ?2)",
                    params![note.id, poam_id],
                );
                
                if let Err(err) = &result {
                    println!("Error inserting association: {}", err);
                }
                
                result?;
            }
        } else {
            println!("No POAMs to associate with note {}", note.id);
        }
        
        // Commit the transaction
        tx.commit()?;
        println!("Note {} updated successfully", note.id);
        
        Ok(())
    }
    
    pub fn delete_note(&mut self, note_id: &str, system_id: &str) -> Result<(), DatabaseError> {
        // The associations will be automatically deleted due to ON DELETE CASCADE
        self.conn.execute(
            "DELETE FROM notes WHERE id = ?1 AND system_id = ?2",
            params![note_id, system_id],
        )?;
        
        Ok(())
    }
    
    // Get all note-POAM associations
    fn get_all_note_poam_associations(&self) -> Result<Vec<(String, i64, String)>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT note_id, poam_id, 
             (SELECT title FROM poams WHERE id = poam_id) as poam_title 
             FROM note_poam_associations"
        )?;
        
        let mut associations = Vec::new();
        let rows = stmt.query_map(params![], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?
            ))
        })?;
        
        for row in rows {
            associations.push(row?);
        }
        
        Ok(associations)
    }

    // STIG Mapping CRUD operations
    pub fn save_stig_mapping(&mut self, mapping: &STIGMappingData, system_id: &str) -> Result<(), DatabaseError> {
        let stig_info_json = serde_json::to_string(&mapping.stig_info).unwrap();
        let asset_info_json = serde_json::to_string(&mapping.asset_info).unwrap();
        let mapping_result_json = serde_json::to_string(&mapping.mapping_result).unwrap();
        let cci_mappings_json = mapping.cci_mappings.as_ref()
            .map(|mappings| serde_json::to_string(mappings).unwrap());
        
        self.conn.execute(
            "INSERT OR REPLACE INTO stig_mappings 
             (id, name, description, created_date, updated_date, stig_info, asset_info, mapping_result, cci_mappings, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                mapping.id,
                mapping.name,
                mapping.description,
                mapping.created_date,
                mapping.updated_date,
                stig_info_json,
                asset_info_json,
                mapping_result_json,
                cci_mappings_json,
                system_id
            ],
        )?;
        
        Ok(())
    }
    
    pub fn get_all_stig_mappings(&self, system_id: &str) -> Result<Vec<STIGMappingData>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, stig_info, asset_info, mapping_result, cci_mappings
             FROM stig_mappings WHERE system_id = ?1 ORDER BY updated_date DESC"
        )?;
        
        let mut mappings = Vec::new();
        let rows = stmt.query_map(params![system_id], |row| {
            let stig_info_json: String = row.get(5)?;
            let asset_info_json: String = row.get(6)?;
            let mapping_result_json: String = row.get(7)?;
            let cci_mappings_json: Option<String> = row.get(8)?;
            
            let stig_info = serde_json::from_str(&stig_info_json).unwrap();
            let asset_info = serde_json::from_str(&asset_info_json).unwrap();
            let mapping_result = serde_json::from_str(&mapping_result_json).unwrap();
            let cci_mappings = cci_mappings_json
                .map(|json| serde_json::from_str(&json).unwrap());
            
            Ok(STIGMappingData {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                stig_info,
                asset_info,
                mapping_result,
                cci_mappings,
            })
        })?;
        
        for row in rows {
            mappings.push(row?);
        }
        
        Ok(mappings)
    }
    
    pub fn get_stig_mapping_by_id(&self, id: &str, system_id: &str) -> Result<Option<STIGMappingData>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, stig_info, asset_info, mapping_result, cci_mappings
             FROM stig_mappings WHERE id = ?1 AND system_id = ?2"
        )?;
        
        let mapping = stmt.query_row(params![id, system_id], |row| {
            let stig_info_json: String = row.get(5)?;
            let asset_info_json: String = row.get(6)?;
            let mapping_result_json: String = row.get(7)?;
            let cci_mappings_json: Option<String> = row.get(8)?;
            
            let stig_info = serde_json::from_str(&stig_info_json).unwrap();
            let asset_info = serde_json::from_str(&asset_info_json).unwrap();
            let mapping_result = serde_json::from_str(&mapping_result_json).unwrap();
            let cci_mappings = cci_mappings_json
                .map(|json| serde_json::from_str(&json).unwrap());
            
            Ok(STIGMappingData {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                stig_info,
                asset_info,
                mapping_result,
                cci_mappings,
            })
        });
        
        match mapping {
            Ok(m) => Ok(Some(m)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }
    
    pub fn delete_stig_mapping(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM stig_mappings WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }

    // Security Test Plan CRUD operations
    pub fn save_security_test_plan(&mut self, plan: &SecurityTestPlan, system_id: &str) -> Result<(), DatabaseError> {
        let test_cases_json = serde_json::to_string(&plan.test_cases).unwrap();
        
        self.conn.execute(
            "INSERT OR REPLACE INTO security_test_plans 
             (id, name, description, created_date, updated_date, status, poam_id, stig_mapping_id, test_cases, overall_score, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                plan.id,
                plan.name,
                plan.description,
                plan.created_date,
                plan.updated_date,
                plan.status,
                plan.poam_id,
                plan.stig_mapping_id,
                test_cases_json,
                plan.overall_score,
                system_id
            ],
        )?;
        
        Ok(())
    }
    
    pub fn get_all_security_test_plans(&self, system_id: &str) -> Result<Vec<SecurityTestPlan>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, status, poam_id, stig_mapping_id, test_cases, overall_score
             FROM security_test_plans WHERE system_id = ?1 ORDER BY updated_date DESC"
        )?;
        
        let mut plans = Vec::new();
        let rows = stmt.query_map(params![system_id], |row| {
            let test_cases_json: String = row.get(8)?;
            let test_cases = serde_json::from_str(&test_cases_json).unwrap();
            
            Ok(SecurityTestPlan {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                status: row.get(5)?,
                poam_id: row.get(6)?,
                stig_mapping_id: row.get(7)?,
                test_cases,
                overall_score: row.get(9)?,
            })
        })?;
        
        for row in rows {
            plans.push(row?);
        }
        
        Ok(plans)
    }
    
    pub fn get_security_test_plan_by_id(&self, id: &str, system_id: &str) -> Result<Option<SecurityTestPlan>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, status, poam_id, stig_mapping_id, test_cases, overall_score
             FROM security_test_plans WHERE id = ?1 AND system_id = ?2"
        )?;
        
        let plan = stmt.query_row(params![id, system_id], |row| {
            let test_cases_json: String = row.get(8)?;
            let test_cases = serde_json::from_str(&test_cases_json).unwrap();
            
            Ok(SecurityTestPlan {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                status: row.get(5)?,
                poam_id: row.get(6)?,
                stig_mapping_id: row.get(7)?,
                test_cases,
                overall_score: row.get(9)?,
            })
        });
        
        match plan {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }
    
    pub fn delete_security_test_plan(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM security_test_plans WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }
    
    pub fn get_test_plans_by_poam(&self, poam_id: i64, system_id: &str) -> Result<Vec<SecurityTestPlan>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, status, poam_id, stig_mapping_id, test_cases, overall_score
             FROM security_test_plans 
             WHERE poam_id = ?1 AND system_id = ?2
             ORDER BY updated_date DESC"
        )?;
        
        let mut plans = Vec::new();
        let rows = stmt.query_map(params![poam_id, system_id], |row| {
            let test_cases_json: String = row.get(8)?;
            let test_cases = serde_json::from_str(&test_cases_json).unwrap();
            
            Ok(SecurityTestPlan {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                status: row.get(5)?,
                poam_id: row.get(6)?,
                stig_mapping_id: row.get(7)?,
                test_cases,
                overall_score: row.get(9)?,
            })
        })?;
        
        for row in rows {
            plans.push(row?);
        }
        
        Ok(plans)
    }

    // STP Prep List Methods
    pub fn save_stp_prep_list(&mut self, prep_list: &StpPrepList, system_id: &str) -> Result<(), DatabaseError> {
        let stig_info_json = serde_json::to_string(&prep_list.stig_info).unwrap();
        let asset_info_json = serde_json::to_string(&prep_list.asset_info).unwrap();
        let selected_controls_json = serde_json::to_string(&prep_list.selected_controls).unwrap();
        
        self.conn.execute(
            "INSERT OR REPLACE INTO stp_prep_lists 
             (id, name, description, created_date, updated_date, source_mapping_id, stig_info, asset_info, prep_status, selected_controls, control_count, system_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                prep_list.id,
                prep_list.name,
                prep_list.description,
                prep_list.created_date,
                prep_list.updated_date,
                prep_list.source_mapping_id,
                stig_info_json,
                asset_info_json,
                prep_list.prep_status,
                selected_controls_json,
                prep_list.control_count,
                system_id
            ],
        )?;
        
        Ok(())
    }

    pub fn get_all_stp_prep_lists(&self, system_id: &str) -> Result<Vec<StpPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_mapping_id, stig_info, asset_info, prep_status, selected_controls, control_count
             FROM stp_prep_lists WHERE system_id = ?1 ORDER BY updated_date DESC"
        )?;
        
        let mut prep_lists = Vec::new();
        let rows = stmt.query_map(params![system_id], |row| {
            let stig_info_json: String = row.get(6)?;
            let asset_info_json: String = row.get(7)?;
            let selected_controls_json: String = row.get(9)?;
            
            let stig_info = serde_json::from_str(&stig_info_json).unwrap();
            let asset_info = serde_json::from_str(&asset_info_json).unwrap();
            let selected_controls = serde_json::from_str(&selected_controls_json).unwrap();
            
            Ok(StpPrepList {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                source_mapping_id: row.get(5)?,
                stig_info,
                asset_info,
                prep_status: row.get(8)?,
                selected_controls,
                control_count: row.get(10)?,
            })
        })?;
        
        for row in rows {
            prep_lists.push(row?);
        }
        
        Ok(prep_lists)
    }

    pub fn get_stp_prep_list_by_id(&self, id: &str, system_id: &str) -> Result<Option<StpPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_mapping_id, stig_info, asset_info, prep_status, selected_controls, control_count
             FROM stp_prep_lists WHERE id = ?1 AND system_id = ?2"
        )?;
        
        let prep_list = stmt.query_row(params![id, system_id], |row| {
            let stig_info_json: String = row.get(6)?;
            let asset_info_json: String = row.get(7)?;
            let selected_controls_json: String = row.get(9)?;
            
            let stig_info = serde_json::from_str(&stig_info_json).unwrap();
            let asset_info = serde_json::from_str(&asset_info_json).unwrap();
            let selected_controls = serde_json::from_str(&selected_controls_json).unwrap();
            
            Ok(StpPrepList {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                source_mapping_id: row.get(5)?,
                stig_info,
                asset_info,
                prep_status: row.get(8)?,
                selected_controls,
                control_count: row.get(10)?,
            })
        });
        
        match prep_list {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }

    pub fn delete_stp_prep_list(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM stp_prep_lists WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }

    pub fn get_stp_prep_lists_by_source_mapping(&self, source_mapping_id: &str, system_id: &str) -> Result<Vec<StpPrepList>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, source_mapping_id, stig_info, asset_info, prep_status, selected_controls, control_count
             FROM stp_prep_lists 
             WHERE source_mapping_id = ?1 AND system_id = ?2
             ORDER BY updated_date DESC"
        )?;
        
        let mut prep_lists = Vec::new();
        let rows = stmt.query_map(params![source_mapping_id, system_id], |row| {
            let stig_info_json: String = row.get(6)?;
            let asset_info_json: String = row.get(7)?;
            let selected_controls_json: String = row.get(9)?;
            
            let stig_info = serde_json::from_str(&stig_info_json).unwrap();
            let asset_info = serde_json::from_str(&asset_info_json).unwrap();
            let selected_controls = serde_json::from_str(&selected_controls_json).unwrap();
            
            Ok(StpPrepList {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                source_mapping_id: row.get(5)?,
                stig_info,
                asset_info,
                prep_status: row.get(8)?,
                selected_controls,
                control_count: row.get(10)?,
            })
        })?;
        
        for row in rows {
            prep_lists.push(row?);
        }
        
        Ok(prep_lists)
    }

    // System Management Methods
    pub fn create_system(&mut self, system: &System) -> Result<(), DatabaseError> {
        println!("Creating system: {}", system.name);

        let tags_json = if let Some(tags) = &system.tags {
            Some(serde_json::to_string(tags).unwrap_or_default())
        } else {
            None
        };

        self.conn.execute(
            "INSERT INTO systems (id, name, description, created_date, updated_date, owner, classification, tags, is_active, last_accessed) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                system.id,
                system.name,
                system.description,
                system.created_date,
                system.updated_date,
                system.owner,
                system.classification,
                tags_json,
                system.is_active,
                system.last_accessed
            ],
        )?;

        println!("Successfully created system: {}", system.name);
        Ok(())
    }

    pub fn get_all_systems(&self) -> Result<Vec<SystemSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed,
                    COUNT(DISTINCT p.id) as poam_count,
                    COUNT(DISTINCT n.id) as notes_count,
                    COUNT(DISTINCT sm.id) as stig_mappings_count,
                    COUNT(DISTINCT stp.id) as test_plans_count
             FROM systems s
             LEFT JOIN poams p ON s.id = p.system_id
             LEFT JOIN notes n ON s.id = n.system_id
             LEFT JOIN stig_mappings sm ON s.id = sm.system_id
             LEFT JOIN security_test_plans stp ON s.id = stp.system_id
             WHERE s.is_active = 1
             GROUP BY s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed
             ORDER BY s.last_accessed DESC, s.created_date DESC"
        )?;

        let system_iter = stmt.query_map(params![], |row| {
            let tags_str: Option<String> = row.get(5)?;
            let tags = if let Some(json_str) = tags_str {
                serde_json::from_str(&json_str).unwrap_or_default()
            } else {
                None
            };

            Ok(SystemSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                owner: row.get(3)?,
                classification: row.get(4)?,
                tags,
                created_date: row.get(6)?,
                last_accessed: row.get(7)?,
                poam_count: row.get(8).unwrap_or(0),
                notes_count: row.get(9).unwrap_or(0),
                stig_mappings_count: row.get(10).unwrap_or(0),
                test_plans_count: row.get(11).unwrap_or(0),
            })
        })?;

        let mut systems = Vec::new();
        for system in system_iter {
            systems.push(system?);
        }

        println!("Retrieved {} systems", systems.len());
        Ok(systems)
    }

    pub fn get_system_by_id(&self, id: &str) -> Result<Option<System>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, owner, classification, tags, is_active, last_accessed 
             FROM systems WHERE id = ?1"
        )?;

        let system = stmt.query_row(params![id], |row| {
            let tags_str: Option<String> = row.get(7)?;
            let tags = if let Some(json_str) = tags_str {
                serde_json::from_str(&json_str).unwrap_or_default()
            } else {
                None
            };

            // Get counts
            let poam_count = self.conn.query_row(
                "SELECT COUNT(*) FROM poams WHERE system_id = ?1",
                params![id],
                |row| row.get::<_, i32>(0)
            ).unwrap_or(0);

            Ok(System {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_date: row.get(3)?,
                updated_date: row.get(4)?,
                owner: row.get(5)?,
                classification: row.get(6)?,
                tags,
                is_active: row.get(8)?,
                poam_count: Some(poam_count),
                last_accessed: row.get(9)?,
            })
        });

        match system {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }

    pub fn update_system(&mut self, system: &System) -> Result<(), DatabaseError> {
        println!("Updating system: {}", system.name);

        let tags_json = if let Some(tags) = &system.tags {
            Some(serde_json::to_string(tags).unwrap_or_default())
        } else {
            None
        };

        self.conn.execute(
            "UPDATE systems 
             SET name = ?2, description = ?3, updated_date = ?4, owner = ?5, classification = ?6, tags = ?7, is_active = ?8, last_accessed = ?9
             WHERE id = ?1",
            params![
                system.id,
                system.name,
                system.description,
                system.updated_date,
                system.owner,
                system.classification,
                tags_json,
                system.is_active,
                system.last_accessed
            ],
        )?;

        println!("Successfully updated system: {}", system.name);
        Ok(())
    }

    pub fn delete_system(&mut self, id: &str) -> Result<(), DatabaseError> {
        if id == "default" {
            return Err(DatabaseError::ClearDatabase("Cannot delete the default system".to_string()));
        }

        println!("Deleting system: {}", id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Delete all related data (CASCADE should handle this, but let's be explicit)
        tx.execute("DELETE FROM note_poam_associations WHERE note_id IN (SELECT id FROM notes WHERE system_id = ?1)", params![id])?;
        tx.execute("DELETE FROM milestones WHERE poam_id IN (SELECT id FROM poams WHERE system_id = ?1)", params![id])?;
        tx.execute("DELETE FROM poams WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM notes WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM stig_mappings WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM security_test_plans WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM stp_prep_lists WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM control_poam_associations WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM baseline_controls WHERE system_id = ?1", params![id])?;
        
        // Finally delete the system
        tx.execute("DELETE FROM systems WHERE id = ?1", params![id])?;
        
        tx.commit()?;
        
        println!("Successfully deleted system: {}", id);
        Ok(())
    }

    pub fn update_system_last_accessed(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE systems SET last_accessed = ?1 WHERE id = ?2",
            params![now, system_id],
        )?;
        Ok(())
    }

    // Control-POAM Association Methods
    
    pub fn create_control_poam_association(
        &mut self, 
        control_id: &str, 
        poam_id: i64, 
        system_id: &str,
        created_by: Option<&str>,
        notes: Option<&str>
    ) -> Result<String, DatabaseError> {
        println!("Creating control-POAM association for control {} and POAM {}", control_id, poam_id);
        
        // Generate a unique ID for the association
        let id = uuid::Uuid::new_v4().to_string();
        let association_date = chrono::Utc::now().to_rfc3339();
        
        // Check if this association already exists
        let existing = self.conn.query_row(
            "SELECT id FROM control_poam_associations 
             WHERE control_id = ?1 AND poam_id = ?2 AND system_id = ?3",
            params![control_id, poam_id, system_id],
            |row| Ok(row.get::<_, String>(0)?),
        );
        
        if existing.is_ok() {
            return Ok(existing.unwrap());
        }
        
        self.conn.execute(
            "INSERT INTO control_poam_associations (id, control_id, poam_id, association_date, system_id, created_by, notes) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, control_id, poam_id, association_date, system_id, created_by, notes],
        )?;

        println!("Successfully created control-POAM association with id: {}", id);
        Ok(id)
    }
    
    pub fn delete_control_poam_association(
        &mut self,
        association_id: &str,
        system_id: &str
    ) -> Result<(), DatabaseError> {
        println!("Deleting control-POAM association with id: {}", association_id);
        
        self.conn.execute(
            "DELETE FROM control_poam_associations WHERE id = ?1 AND system_id = ?2",
            params![association_id, system_id],
        )?;
        
        println!("Successfully deleted association with id: {}", association_id);
        Ok(())
    }
    
    pub fn get_control_poam_associations_by_control(
        &self,
        control_id: &str,
        system_id: &str
    ) -> Result<Vec<ControlPOAMAssociation>, DatabaseError> {
        println!("Getting POAM associations for control: {}", control_id);
        
        let mut stmt = self.conn.prepare(
            "SELECT id, control_id, poam_id, association_date, created_by, notes
             FROM control_poam_associations
             WHERE control_id = ?1 AND system_id = ?2",
        )?;
        
        let associations_iter = stmt.query_map(params![control_id, system_id], |row| {
            Ok(ControlPOAMAssociation {
                id: row.get(0)?,
                control_id: row.get(1)?,
                poam_id: row.get(2)?,
                association_date: row.get(3)?,
                created_by: row.get(4)?,
                notes: row.get(5)?,
            })
        })?;
        
        let mut associations = Vec::new();
        for assoc in associations_iter {
            associations.push(assoc?);
        }
        
        println!("Found {} associations for control {}", associations.len(), control_id);
        Ok(associations)
    }
    
    pub fn get_control_poam_associations_by_poam(
        &self,
        poam_id: i64,
        system_id: &str
    ) -> Result<Vec<ControlPOAMAssociation>, DatabaseError> {
        println!("Getting control associations for POAM {}", poam_id);
        
        let mut stmt = self.conn.prepare(
            "SELECT id, control_id, poam_id, association_date, created_by, notes 
             FROM control_poam_associations 
             WHERE poam_id = ?1 AND system_id = ?2",
        )?;
        
        let associations_iter = stmt.query_map(params![poam_id, system_id], |row| {
            Ok(ControlPOAMAssociation {
                id: row.get(0)?,
                control_id: row.get(1)?,
                poam_id: row.get(2)?,
                association_date: row.get(3)?,
                created_by: row.get(4)?,
                notes: row.get(5)?,
            })
        })?;
        
        let mut associations = Vec::new();
        for assoc in associations_iter {
            associations.push(assoc?);
        }
        
        println!("Found {} associations for POAM {}", associations.len(), poam_id);
        Ok(associations)
    }
    
    // Baseline Controls Methods
    pub fn get_baseline_controls(&mut self, system_id: &str) -> Result<Vec<BaselineControl>, DatabaseError> {
        println!("Getting baseline controls for system {}", system_id);
        
        let mut stmt = self.conn.prepare(
            "SELECT id, family, title, implementation_status, date_added, responsible_party, notes, system_id 
             FROM baseline_controls 
             WHERE system_id = ?1",
        )?;
        
        let controls = stmt
            .query_map(params![system_id], |row| {
                Ok(BaselineControl {
                    id: row.get(0)?,
                    family: row.get(1)?,
                    title: row.get(2)?,
                    implementation_status: row.get(3)?,
                    date_added: row.get(4)?,
                    responsible_party: row.get(5)?,
                    notes: row.get(6)?,
                    system_id: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        println!("Found {} baseline controls for system {}", controls.len(), system_id);
        Ok(controls)
    }
    
    pub fn add_baseline_control(
        &mut self,
        control: &BaselineControl,
    ) -> Result<(), DatabaseError> {
        println!("Adding baseline control {} to system {}", control.id, control.system_id);
        
        self.conn.execute(
            "INSERT INTO baseline_controls (id, family, title, implementation_status, date_added, responsible_party, notes, system_id) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                control.id,
                control.family,
                control.title,
                control.implementation_status,
                control.date_added,
                control.responsible_party,
                control.notes,
                control.system_id
            ],
        )?;
        
        println!("Successfully added baseline control: {}", control.id);
        Ok(())
    }
    
    pub fn update_baseline_control(
        &mut self,
        control: &BaselineControl,
    ) -> Result<(), DatabaseError> {
        println!("Updating baseline control {} in system {}", control.id, control.system_id);
        
        self.conn.execute(
            r#"UPDATE baseline_controls 
             SET family = ?1, 
                 title = ?2, 
                 implementation_status = ?3, 
                 responsible_party = ?4, 
                 notes = ?5 
             WHERE id = ?6 AND system_id = ?7"#,
            params![
                control.family,
                control.title,
                control.implementation_status,
                control.responsible_party,
                control.notes,
                control.id,
                control.system_id
            ],
        )?;
        
        println!("Successfully updated baseline control: {}", control.id);
        Ok(())
    }
    
    pub fn remove_baseline_control(
        &mut self,
        control_id: &str,
        system_id: &str,
    ) -> Result<(), DatabaseError> {
        println!("Removing baseline control {} from system {}", control_id, system_id);
        
        // First remove any associations this control may have
        self.conn.execute(
            "DELETE FROM baseline_controls WHERE id = ?1 AND system_id = ?2",
            params![control_id, system_id],
        )?;
        
        println!("Removed baseline control {}", control_id);
        Ok(())
    }
}

// Function to normalize date formats for storage
fn normalize_date_format(date_str: &str) -> String {
    // Use the implementation from date_utils module
    date_utils::normalize_date_format(date_str)
}

// Store database connection in app state
static DB: once_cell::sync::Lazy<Mutex<Option<Database>>> = once_cell::sync::Lazy::new(|| {
    Mutex::new(None)
});

pub fn get_database(app_handle: &AppHandle) -> Result<Database, DatabaseError> {
    let mut db_guard = DB.lock().unwrap();
    
    if db_guard.is_none() {
        *db_guard = Some(Database::new(app_handle)?);
    }
    
    // We need to create a new connection for each thread
    Database::new(app_handle)
}