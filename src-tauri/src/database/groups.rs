use crate::models::{SystemGroup, GroupSummary, SystemSummary};
use rusqlite::{params, Connection};
use serde_json;
use super::utils::DatabaseError;

pub struct GroupOperations<'a> {
    conn: &'a mut Connection,
}

pub struct GroupQueries<'a> {
    conn: &'a Connection,
}

impl<'a> GroupOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    // Group Management Methods
    pub fn create_group(&self, group: &SystemGroup) -> Result<(), DatabaseError> {
        println!("Creating group: {}", group.name);

        self.conn.execute(
            "INSERT INTO system_groups (id, name, description, color, created_date, updated_date, created_by, is_active) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                group.id,
                group.name,
                group.description,
                group.color,
                group.created_date,
                group.updated_date,
                group.created_by,
                group.is_active
            ],
        )?;

        println!("Successfully created group: {}", group.name);
        Ok(())
    }

    pub fn get_all_groups(&self) -> Result<Vec<GroupSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT g.id, g.name, g.description, g.color, g.created_date,
                    COUNT(DISTINCT gsa.system_id) as system_count,
                    COALESCE(SUM(s.poam_count), 0) as total_poam_count,
                    COALESCE(SUM(s.notes_count), 0) as total_notes_count,
                    COALESCE(SUM(s.stig_mappings_count), 0) as total_stig_mappings_count,
                    COALESCE(SUM(s.test_plans_count), 0) as total_test_plans_count
             FROM system_groups g
             LEFT JOIN group_system_associations gsa ON g.id = gsa.group_id
             LEFT JOIN (
                 SELECT s.id, s.group_id,
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
                 GROUP BY s.id
             ) s ON gsa.system_id = s.id
             WHERE g.is_active = 1
             GROUP BY g.id, g.name, g.description, g.color, g.created_date
             ORDER BY g.name"
        )?;

        let group_iter = stmt.query_map(params![], |row| {
            Ok(GroupSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_date: row.get(4)?,
                system_count: row.get(5).unwrap_or(0),
                total_poam_count: row.get(6).unwrap_or(0),
                total_notes_count: row.get(7).unwrap_or(0),
                total_stig_mappings_count: row.get(8).unwrap_or(0),
                total_test_plans_count: row.get(9).unwrap_or(0),
                last_accessed: None, // TODO: Implement group access tracking
                systems: None, // Will be populated separately if needed
            })
        })?;

        let mut groups = Vec::new();
        for group in group_iter {
            groups.push(group?);
        }

        println!("Retrieved {} groups", groups.len());
        Ok(groups)
    }

    pub fn get_group_by_id(&self, id: &str) -> Result<Option<SystemGroup>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, color, created_date, updated_date, created_by, is_active 
             FROM system_groups WHERE id = ?1"
        )?;

        let group = stmt.query_row(params![id], |row| {
            // Get system count
            let system_count = self.conn.query_row(
                "SELECT COUNT(*) FROM group_system_associations WHERE group_id = ?1",
                params![id],
                |row| row.get::<_, i32>(0)
            ).unwrap_or(0);

            Ok(SystemGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_date: row.get(4)?,
                updated_date: row.get(5)?,
                created_by: row.get(6)?,
                is_active: row.get(7)?,
                system_count: Some(system_count),
            })
        });

        match group {
            Ok(g) => Ok(Some(g)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }

    pub fn update_group(&self, group: &SystemGroup) -> Result<(), DatabaseError> {
        println!("Updating group: {}", group.name);

        self.conn.execute(
            "UPDATE system_groups 
             SET name = ?2, description = ?3, color = ?4, updated_date = ?5, created_by = ?6, is_active = ?7
             WHERE id = ?1",
            params![
                group.id,
                group.name,
                group.description,
                group.color,
                group.updated_date,
                group.created_by,
                group.is_active
            ],
        )?;

        println!("Successfully updated group: {}", group.name);
        Ok(())
    }

    pub fn delete_group(&mut self, id: &str) -> Result<(), DatabaseError> {
        println!("Deleting group: {}", id);
        
        // Start a transaction
        let tx = self.conn.transaction()?;
        
        // Remove group associations (this will leave systems ungrouped)
        tx.execute("DELETE FROM group_system_associations WHERE group_id = ?1", params![id])?;
        
        // Delete group-level POAMs and related data
        tx.execute("DELETE FROM group_milestones WHERE group_poam_id IN (SELECT id FROM group_poams WHERE group_id = ?1)", params![id])?;
        tx.execute("DELETE FROM group_poams WHERE group_id = ?1", params![id])?;
        tx.execute("DELETE FROM group_security_test_plans WHERE group_id = ?1", params![id])?;
        
        // Finally delete the group
        tx.execute("DELETE FROM system_groups WHERE id = ?1", params![id])?;
        
        tx.commit()?;
        
        println!("Successfully deleted group: {}", id);
        Ok(())
    }

    // System-Group Association Methods
    pub fn add_system_to_group(&self, group_id: &str, system_id: &str, added_by: Option<&str>) -> Result<(), DatabaseError> {
        let now = chrono::Utc::now().to_rfc3339();
        let association_id = uuid::Uuid::new_v4().to_string();

        // Get the next display order
        let display_order = self.conn.query_row(
            "SELECT COALESCE(MAX(display_order), -1) + 1 FROM group_system_associations WHERE group_id = ?1",
            params![group_id],
            |row| row.get::<_, i32>(0)
        ).unwrap_or(0);

        self.conn.execute(
            "INSERT INTO group_system_associations (id, group_id, system_id, added_date, added_by, display_order) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![association_id, group_id, system_id, now, added_by, display_order],
        )?;

        // Update the system's group_id
        self.conn.execute(
            "UPDATE systems SET group_id = ?1 WHERE id = ?2",
            params![group_id, system_id],
        )?;

        println!("Added system {} to group {}", system_id, group_id);
        Ok(())
    }

    pub fn remove_system_from_group(&self, system_id: &str) -> Result<(), DatabaseError> {
        // Remove the association
        self.conn.execute(
            "DELETE FROM group_system_associations WHERE system_id = ?1",
            params![system_id],
        )?;

        // Clear the system's group_id
        self.conn.execute(
            "UPDATE systems SET group_id = NULL WHERE id = ?1",
            params![system_id],
        )?;

        println!("Removed system {} from its group", system_id);
        Ok(())
    }

    pub fn get_systems_in_group(&self, group_id: &str) -> Result<Vec<SystemSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed, s.group_id,
                    COUNT(DISTINCT p.id) as poam_count,
                    COUNT(DISTINCT n.id) as notes_count,
                    COUNT(DISTINCT sm.id) as stig_mappings_count,
                    COUNT(DISTINCT stp.id) as test_plans_count,
                    gsa.display_order
             FROM systems s
             JOIN group_system_associations gsa ON s.id = gsa.system_id
             LEFT JOIN poams p ON s.id = p.system_id
             LEFT JOIN notes n ON s.id = n.system_id
             LEFT JOIN stig_mappings sm ON s.id = sm.system_id
             LEFT JOIN security_test_plans stp ON s.id = stp.system_id
             WHERE gsa.group_id = ?1 AND s.is_active = 1
             GROUP BY s.id, s.name, s.description, s.owner, s.classification, s.tags, s.created_date, s.last_accessed, s.group_id, gsa.display_order
             ORDER BY gsa.display_order, s.name"
        )?;

        let system_iter = stmt.query_map(params![group_id], |row| {
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

        Ok(systems)
    }

    pub fn get_ungrouped_systems(&self) -> Result<Vec<SystemSummary>, DatabaseError> {
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
             WHERE s.group_id IS NULL AND s.is_active = 1
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

        Ok(systems)
    }

    pub fn reorder_systems_in_group(&mut self, group_id: &str, system_orders: &[(String, i32)]) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        for (system_id, order) in system_orders {
            tx.execute(
                "UPDATE group_system_associations SET display_order = ?1 WHERE group_id = ?2 AND system_id = ?3",
                params![order, group_id, system_id],
            )?;
        }
        
        tx.commit()?;
        println!("Reordered systems in group {}", group_id);
        Ok(())
    }
}

impl<'a> GroupQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_all_groups(&self) -> Result<Vec<GroupSummary>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, color, created_date
             FROM system_groups 
             WHERE is_active = 1
             ORDER BY name"
        )?;
        
        let group_rows = stmt.query_map([], |row| {
            Ok(GroupSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_date: row.get(4)?,
                system_count: 0, // TODO: Calculate actual counts
                total_poam_count: 0,
                total_notes_count: 0,
                total_stig_mappings_count: 0,
                total_test_plans_count: 0,
                last_accessed: None,
                systems: None,
            })
        })?;
        
        let mut groups = Vec::new();
        for group_result in group_rows {
            groups.push(group_result?);
        }
        
        Ok(groups)
    }

    pub fn get_group_by_id(&self, id: &str) -> Result<Option<SystemGroup>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, color, created_date, updated_date, created_by, is_active 
             FROM system_groups 
             WHERE id = ?1"
        )?;
        
        let group_result = stmt.query_row(params![id], |row| {
            Ok(SystemGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_date: row.get(4)?,
                updated_date: row.get(5)?,
                created_by: row.get(6)?,
                is_active: row.get(7)?,
                system_count: Some(0), // TODO: Calculate actual count
            })
        });
        
        match group_result {
            Ok(group) => Ok(Some(group)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::Sqlite(e)),
        }
    }
}