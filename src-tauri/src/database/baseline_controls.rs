use crate::models::BaselineControl;
use rusqlite::{params, Connection};
use super::utils::DatabaseError;

pub struct BaselineControlOperations<'a> {
    conn: &'a mut Connection,
}

pub struct BaselineControlQueries<'a> {
    conn: &'a Connection,
}

impl<'a> BaselineControlOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn add_baseline_control(&mut self, control: &BaselineControl) -> Result<(), DatabaseError> {
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

    pub fn update_baseline_control(&mut self, control: &BaselineControl) -> Result<(), DatabaseError> {
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

    pub fn remove_baseline_control(&mut self, control_id: &str, system_id: &str) -> Result<(), DatabaseError> {
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

impl<'a> BaselineControlQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_baseline_controls(&self, system_id: &str) -> Result<Vec<BaselineControl>, DatabaseError> {
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
}
