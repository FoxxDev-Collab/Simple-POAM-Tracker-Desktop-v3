use crate::models::{SecurityTestPlan, StpPrepList};
use rusqlite::{params, Connection};
use serde_json;
use super::utils::DatabaseError;

pub struct SecurityTestPlanOperations<'a> {
    conn: &'a mut Connection,
}

pub struct SecurityTestPlanQueries<'a> {
    conn: &'a Connection,
}

impl<'a> SecurityTestPlanOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

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

    pub fn delete_security_test_plan(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM security_test_plans WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }

    // STP Prep List Operations
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

    pub fn delete_stp_prep_list(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM stp_prep_lists WHERE id = ?1 AND system_id = ?2",
            params![id, system_id],
        )?;
        Ok(())
    }
}

impl<'a> SecurityTestPlanQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
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

    // STP Prep List Queries
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
}
