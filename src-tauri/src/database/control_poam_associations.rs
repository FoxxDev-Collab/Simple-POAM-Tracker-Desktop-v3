use crate::models::ControlPOAMAssociation;
use rusqlite::{params, Connection};
use super::utils::DatabaseError;

pub struct ControlPOAMAssociationOperations<'a> {
    conn: &'a mut Connection,
}

pub struct ControlPOAMAssociationQueries<'a> {
    conn: &'a Connection,
}

impl<'a> ControlPOAMAssociationOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

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
}

impl<'a> ControlPOAMAssociationQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
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
}
