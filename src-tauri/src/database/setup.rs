use rusqlite::{params, Connection};
use std::fs;
use tauri::{AppHandle, Manager};
use super::utils::DatabaseError;

pub struct DatabaseSetup<'a> {
    conn: &'a mut Connection,
}

impl<'a> DatabaseSetup<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn create_database(app_handle: &AppHandle) -> Result<Connection, DatabaseError> {
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
        
        Ok(conn)
    }

    pub fn initialize_tables(&mut self) -> Result<(), DatabaseError> {
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

        // Nessus scans metadata
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS nessus_scans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                imported_date TEXT NOT NULL,
                version INTEGER NOT NULL,
                source_file TEXT,
                scan_info TEXT NOT NULL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;

        // Nessus findings per scan
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS nessus_findings (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                plugin_id INTEGER,
                plugin_name TEXT,
                severity TEXT,
                risk_factor TEXT,
                cve TEXT,
                cvss_base_score REAL,
                host TEXT,
                port INTEGER,
                protocol TEXT,
                synopsis TEXT,
                description TEXT,
                solution TEXT,
                raw_json TEXT NOT NULL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (scan_id) REFERENCES nessus_scans (id) ON DELETE CASCADE,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;

        // Nessus Prep Lists for STP process
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS nessus_prep_lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                source_scan_id TEXT,
                asset_info TEXT NOT NULL,
                selected_findings TEXT NOT NULL,
                finding_count INTEGER NOT NULL,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (source_scan_id) REFERENCES nessus_scans (id) ON DELETE SET NULL,
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
                system_id TEXT NOT NULL DEFAULT 'default',
                created_by TEXT,
                notes TEXT,
                FOREIGN KEY (poam_id) REFERENCES poams (id) ON DELETE CASCADE,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create Baseline Controls table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS baseline_controls (
                id TEXT PRIMARY KEY,
                family TEXT NOT NULL,
                title TEXT NOT NULL,
                implementation_status TEXT NOT NULL,
                date_added TEXT NOT NULL,
                responsible_party TEXT,
                notes TEXT,
                system_id TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;

        // Create Group Baseline Controls table (group-level NIST controls)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_baseline_controls (
                id TEXT PRIMARY KEY,
                family TEXT NOT NULL,
                title TEXT NOT NULL,
                implementation_status TEXT NOT NULL,
                date_added TEXT NOT NULL,
                responsible_party TEXT,
                notes TEXT,
                group_id TEXT NOT NULL,
                FOREIGN KEY (group_id) REFERENCES system_groups (id) ON DELETE CASCADE
            )",
            params![],
        )?;

        // Create Group Control-POAM associations table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_control_poam_associations (
                id TEXT PRIMARY KEY,
                control_id TEXT NOT NULL,
                group_poam_id INTEGER NOT NULL,
                association_date TEXT NOT NULL,
                group_id TEXT NOT NULL,
                created_by TEXT,
                notes TEXT,
                FOREIGN KEY (group_poam_id) REFERENCES group_poams (id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES system_groups (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create System Groups table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS system_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                color TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                created_by TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1
            )",
            params![],
        )?;
        
        // Create Group-System associations table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_system_associations (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                system_id TEXT NOT NULL,
                added_date TEXT NOT NULL,
                added_by TEXT,
                display_order INTEGER NOT NULL DEFAULT 0,
                UNIQUE(group_id, system_id),
                FOREIGN KEY (group_id) REFERENCES system_groups (id) ON DELETE CASCADE,
                FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create Group POAMs table for cross-system POAMs
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_poams (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                group_id TEXT NOT NULL,
                affected_systems TEXT NOT NULL, -- JSON array of system IDs
                resources TEXT,
                source_identifying_vulnerability TEXT,
                raw_severity TEXT,
                severity TEXT,
                relevance_of_threat TEXT,
                likelihood TEXT,
                impact TEXT,
                residual_risk TEXT,
                mitigations TEXT,
                devices_affected TEXT,
                FOREIGN KEY (group_id) REFERENCES system_groups (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create Group milestones table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_milestones (
                id TEXT PRIMARY KEY,
                group_poam_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                due_date TEXT NOT NULL,
                status TEXT NOT NULL,
                description TEXT NOT NULL,
                FOREIGN KEY (group_poam_id) REFERENCES group_poams (id) ON DELETE CASCADE
            )",
            params![],
        )?;
        
        // Create Group Security Test Plans table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS group_security_test_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                status TEXT NOT NULL,
                group_id TEXT NOT NULL,
                included_systems TEXT NOT NULL, -- JSON array of system IDs
                group_poam_id INTEGER,
                test_cases TEXT NOT NULL, -- JSON
                overall_score REAL,
                FOREIGN KEY (group_id) REFERENCES system_groups (id) ON DELETE CASCADE,
                FOREIGN KEY (group_poam_id) REFERENCES group_poams (id) ON DELETE SET NULL
            )",
            params![],
        )?;
        
        // Run migrations
        self.migrate_poam_enhanced_fields()?;
        self.ensure_default_system()?;
        self.migrate_to_system_schema()?;
        self.migrate_notes_schema()?;
        self.migrate_groups_schema()?;
        
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
            "devices_affected",
            "source_stig_mapping_id",
            "selected_vulnerabilities"
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
        
        // Check if migration has already been applied by looking for poam_id column
        let has_poam_id = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name = 'poam_id'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;

        if !has_poam_id {
            println!("Note schema migration already applied, skipping");
            return Ok(());
        }

        println!("Note schema migration needed, proceeding with migration");
        
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

    fn migrate_groups_schema(&mut self) -> Result<(), DatabaseError> {
        // Add group_id column to systems table if it doesn't exist
        let has_group_id = self.conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('systems') WHERE name = 'group_id'",
            params![],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;

        if !has_group_id {
            println!("Adding group_id column to systems table");
            self.conn.execute(
                "ALTER TABLE systems ADD COLUMN group_id TEXT",
                params![],
            )?;
        }

        Ok(())
    }
}
