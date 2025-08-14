use rusqlite::{params, Connection};
use super::utils::DatabaseError;
use serde::{Deserialize, Serialize};

// Group-level baseline control structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupBaselineControl {
    pub id: String,
    pub family: String,
    pub title: String,
    pub implementation_status: String,
    pub date_added: String,
    pub responsible_party: Option<String>,
    pub notes: Option<String>,
    pub group_id: String,
}

pub struct GroupBaselineControlOperations<'a> {
    conn: &'a mut Connection,
}

pub struct GroupBaselineControlQueries<'a> {
    conn: &'a Connection,
}

impl<'a> GroupBaselineControlOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn add_group_baseline_control(&mut self, control: &GroupBaselineControl) -> Result<(), DatabaseError> {
        println!("Adding group baseline control {} to group {}", control.id, control.group_id);
        
        self.conn.execute(
            "INSERT INTO group_baseline_controls (id, family, title, implementation_status, date_added, responsible_party, notes, group_id) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                control.id,
                control.family,
                control.title,
                control.implementation_status,
                control.date_added,
                control.responsible_party,
                control.notes,
                control.group_id
            ],
        )?;
        
        println!("Successfully added group baseline control: {}", control.id);
        Ok(())
    }

    pub fn update_group_baseline_control(&mut self, control: &GroupBaselineControl) -> Result<(), DatabaseError> {
        println!("Updating group baseline control {} in group {}", control.id, control.group_id);
        
        self.conn.execute(
            r#"UPDATE group_baseline_controls 
             SET family = ?1, 
                 title = ?2, 
                 implementation_status = ?3, 
                 responsible_party = ?4, 
                 notes = ?5 
             WHERE id = ?6 AND group_id = ?7"#,
            params![
                control.family,
                control.title,
                control.implementation_status,
                control.responsible_party,
                control.notes,
                control.id,
                control.group_id
            ],
        )?;
        
        println!("Successfully updated group baseline control: {}", control.id);
        Ok(())
    }

    pub fn remove_group_baseline_control(&mut self, control_id: &str, group_id: &str) -> Result<(), DatabaseError> {
        println!("Removing group baseline control {} from group {}", control_id, group_id);
        
        // First remove any associations this control may have
        self.conn.execute(
            "DELETE FROM group_control_poam_associations WHERE control_id = ?1 AND group_id = ?2",
            params![control_id, group_id],
        )?;

        // Then remove the baseline control itself
        self.conn.execute(
            "DELETE FROM group_baseline_controls WHERE id = ?1 AND group_id = ?2",
            params![control_id, group_id],
        )?;
        
        println!("Removed group baseline control {}", control_id);
        Ok(())
    }
}

impl<'a> GroupBaselineControlQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_group_baseline_controls(&self, group_id: &str) -> Result<Vec<GroupBaselineControl>, DatabaseError> {
        println!("Getting group baseline controls for group {}", group_id);
        
        let mut stmt = self.conn.prepare(
            "SELECT id, family, title, implementation_status, date_added, responsible_party, notes, group_id 
             FROM group_baseline_controls 
             WHERE group_id = ?1
             ORDER BY family, id",
        )?;
        
        let controls = stmt
            .query_map(params![group_id], |row| {
                Ok(GroupBaselineControl {
                    id: row.get(0)?,
                    family: row.get(1)?,
                    title: row.get(2)?,
                    implementation_status: row.get(3)?,
                    date_added: row.get(4)?,
                    responsible_party: row.get(5)?,
                    notes: row.get(6)?,
                    group_id: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        println!("Found {} group baseline controls for group {}", controls.len(), group_id);
        Ok(controls)
    }
}

// Group Control-POAM Association structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupControlPOAMAssociation {
    pub id: String,
    pub control_id: String,
    pub group_poam_id: i64,
    pub association_date: String,
    pub group_id: String,
    pub created_by: Option<String>,
    pub notes: Option<String>,
}

pub struct GroupControlPOAMAssociationOperations<'a> {
    conn: &'a mut Connection,
}

pub struct GroupControlPOAMAssociationQueries<'a> {
    conn: &'a Connection,
}

impl<'a> GroupControlPOAMAssociationOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn create_group_control_poam_association(
        &mut self,
        control_id: &str,
        group_poam_id: i64,
        group_id: &str,
        created_by: Option<&str>,
        notes: Option<&str>
    ) -> Result<String, DatabaseError> {
        let association_id = uuid::Uuid::new_v4().to_string();
        let association_date = chrono::Utc::now().to_rfc3339();

        println!("Creating group control-POAM association: control {} with group POAM {} in group {}", 
                 control_id, group_poam_id, group_id);

        self.conn.execute(
            "INSERT INTO group_control_poam_associations 
             (id, control_id, group_poam_id, association_date, group_id, created_by, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                association_id,
                control_id,
                group_poam_id,
                association_date,
                group_id,
                created_by,
                notes
            ],
        )?;

        println!("Successfully created group control-POAM association: {}", association_id);
        Ok(association_id)
    }

    pub fn delete_group_control_poam_association(
        &mut self,
        association_id: &str,
        group_id: &str
    ) -> Result<(), DatabaseError> {
        println!("Deleting group control-POAM association: {} in group {}", association_id, group_id);

        self.conn.execute(
            "DELETE FROM group_control_poam_associations WHERE id = ?1 AND group_id = ?2",
            params![association_id, group_id],
        )?;

        println!("Successfully deleted group control-POAM association: {}", association_id);
        Ok(())
    }
}

impl<'a> GroupControlPOAMAssociationQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_group_control_poam_associations_by_control(
        &self,
        control_id: &str,
        group_id: &str
    ) -> Result<Vec<GroupControlPOAMAssociation>, DatabaseError> {
        println!("Getting group control-POAM associations for control {} in group {}", control_id, group_id);

        let mut stmt = self.conn.prepare(
            "SELECT id, control_id, group_poam_id, association_date, group_id, created_by, notes
             FROM group_control_poam_associations 
             WHERE control_id = ?1 AND group_id = ?2
             ORDER BY association_date DESC"
        )?;

        let associations = stmt
            .query_map(params![control_id, group_id], |row| {
                Ok(GroupControlPOAMAssociation {
                    id: row.get(0)?,
                    control_id: row.get(1)?,
                    group_poam_id: row.get(2)?,
                    association_date: row.get(3)?,
                    group_id: row.get(4)?,
                    created_by: row.get(5)?,
                    notes: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        println!("Found {} group control-POAM associations for control {}", associations.len(), control_id);
        Ok(associations)
    }

    pub fn get_group_control_poam_associations_by_poam(
        &self,
        group_poam_id: i64,
        group_id: &str
    ) -> Result<Vec<GroupControlPOAMAssociation>, DatabaseError> {
        println!("Getting group control-POAM associations for group POAM {} in group {}", group_poam_id, group_id);

        let mut stmt = self.conn.prepare(
            "SELECT id, control_id, group_poam_id, association_date, group_id, created_by, notes
             FROM group_control_poam_associations 
             WHERE group_poam_id = ?1 AND group_id = ?2
             ORDER BY association_date DESC"
        )?;

        let associations = stmt
            .query_map(params![group_poam_id, group_id], |row| {
                Ok(GroupControlPOAMAssociation {
                    id: row.get(0)?,
                    control_id: row.get(1)?,
                    group_poam_id: row.get(2)?,
                    association_date: row.get(3)?,
                    group_id: row.get(4)?,
                    created_by: row.get(5)?,
                    notes: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        println!("Found {} group control-POAM associations for group POAM {}", associations.len(), group_poam_id);
        Ok(associations)
    }
}
