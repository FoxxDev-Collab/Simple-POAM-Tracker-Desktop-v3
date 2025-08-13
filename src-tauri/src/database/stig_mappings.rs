use crate::models::STIGMappingData;
use rusqlite::{params, Connection};
use serde_json;
use super::utils::DatabaseError;

pub struct STIGMappingOperations<'a> {
    conn: &'a mut Connection,
}

pub struct STIGMappingQueries<'a> {
    conn: &'a Connection,
}

impl<'a> STIGMappingOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

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

    pub fn delete_stig_mapping(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM stig_mappings WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }

    pub fn clear_stig_mappings_for_system(&mut self, system_id: &str) -> Result<(), DatabaseError> {
        // Remove all STIG mappings for a specific system
        self.conn.execute(
            "DELETE FROM stig_mappings WHERE system_id = ?1",
            params![system_id],
        )?;
        Ok(())
    }
}

impl<'a> STIGMappingQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
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
}
