use crate::models::{System, SystemSummary};
use rusqlite::{params, Connection};
use serde_json;
use super::utils::DatabaseError;

pub struct SystemOperations<'a> {
    conn: &'a mut Connection,
}

pub struct SystemQueries<'a> {
    conn: &'a Connection,
}

impl<'a> SystemOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    // System Management Methods
    pub fn create_system(&self, system: &System) -> Result<(), DatabaseError> {
        println!("Creating system: {}", system.name);

        let tags_json = if let Some(tags) = &system.tags {
            Some(serde_json::to_string(tags).unwrap_or_default())
        } else {
            None
        };

        self.conn.execute(
            "INSERT INTO systems (id, name, description, created_date, updated_date, owner, classification, tags, is_active, last_accessed, group_id) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
                system.last_accessed,
                system.group_id
            ],
        )?;

        println!("Successfully created system: {}", system.name);
        Ok(())
    }

    pub fn get_all_systems(&self) -> Result<Vec<SystemSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed, s.group_id,
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
             GROUP BY s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed, s.group_id
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
                group_id: row.get(8)?,
                poam_count: row.get(9).unwrap_or(0),
                notes_count: row.get(10).unwrap_or(0),
                stig_mappings_count: row.get(11).unwrap_or(0),
                test_plans_count: row.get(12).unwrap_or(0),
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
            "SELECT id, name, description, created_date, updated_date, owner, classification, tags, is_active, last_accessed, group_id 
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
                group_id: row.get(10)?,
            })
        });

        match system {
            Ok(s) => Ok(Some(s)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }

    pub fn update_system(&self, system: &System) -> Result<(), DatabaseError> {
        println!("Updating system: {}", system.name);

        let tags_json = if let Some(tags) = &system.tags {
            Some(serde_json::to_string(tags).unwrap_or_default())
        } else {
            None
        };

        self.conn.execute(
            "UPDATE systems 
             SET name = ?2, description = ?3, updated_date = ?4, owner = ?5, classification = ?6, tags = ?7, is_active = ?8, last_accessed = ?9, group_id = ?10
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
                system.last_accessed,
                system.group_id
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
        
        // Delete Nessus-related data
        tx.execute("DELETE FROM nessus_findings WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM nessus_scans WHERE system_id = ?1", params![id])?;
        tx.execute("DELETE FROM nessus_prep_lists WHERE system_id = ?1", params![id])?;
        
        // Delete group associations for this system
        tx.execute("DELETE FROM group_system_associations WHERE system_id = ?1", params![id])?;
        
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
}

impl<'a> SystemQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_all_systems(&self) -> Result<Vec<SystemSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, owner, classification, tags, last_accessed, created_date, group_id
             FROM systems 
             ORDER BY name"
        )?;
        
        let system_rows = stmt.query_map([], |row| {
            let tags_json: Option<String> = row.get(5)?;
            let tags = if let Some(json_str) = tags_json {
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
                poam_count: 0, // TODO: Calculate actual counts
                notes_count: 0,
                stig_mappings_count: 0,
                test_plans_count: 0,
                last_accessed: row.get(6)?,
                created_date: row.get(7)?,
                group_id: row.get(8)?,
            })
        })?;
        
        let mut systems = Vec::new();
        for system_result in system_rows {
            systems.push(system_result?);
        }
        
        Ok(systems)
    }

    pub fn get_system_by_id(&self, id: &str) -> Result<Option<System>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, created_date, updated_date, owner, classification, tags, is_active, last_accessed, group_id 
             FROM systems 
             WHERE id = ?1"
        )?;
        
        let system_result = stmt.query_row(params![id], |row| {
            let tags_json: Option<String> = row.get(7)?;
            let tags = if let Some(json_str) = tags_json {
                serde_json::from_str(&json_str).unwrap_or_default()
            } else {
                None
            };
            
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
                poam_count: Some(0), // TODO: Calculate actual count
                last_accessed: row.get(9)?,
                group_id: row.get(10)?,
            })
        });
        
        match system_result {
            Ok(system) => Ok(Some(system)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }
}
