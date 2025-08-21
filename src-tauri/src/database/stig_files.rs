use super::DatabaseError;
use crate::models::STIGFileRecord;
use rusqlite::{params, Connection, Row};
use serde_json::Value;
use chrono::{DateTime, Utc};

pub struct STIGFileOperations<'a> {
    conn: &'a mut Connection,
}

impl<'a> STIGFileOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
    }

    pub fn save_stig_file(&mut self, file_record: &STIGFileRecord, checklist: &Value, system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        // Insert or replace STIG file record
        tx.execute(
            "INSERT OR REPLACE INTO stig_files (
                id, system_id, filename, file_path, upload_date, last_modified,
                compliance_summary, remediation_progress, metadata, tags,
                checklist_content, version, created_by
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                file_record.id,
                system_id,
                file_record.filename,
                file_record.file_path,
                file_record.upload_date.to_rfc3339(),
                file_record.last_modified.to_rfc3339(),
                serde_json::to_string(&file_record.compliance_summary)?,
                serde_json::to_string(&file_record.remediation_progress)?,
                serde_json::to_string(&file_record.metadata)?,
                serde_json::to_string(&file_record.tags)?,
                serde_json::to_string(checklist)?,
                file_record.version,
                file_record.created_by
            ]
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn update_stig_file(&mut self, file_record: &STIGFileRecord, system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        tx.execute(
            "UPDATE stig_files SET 
                filename = ?1, file_path = ?2, last_modified = ?3,
                compliance_summary = ?4, remediation_progress = ?5, 
                metadata = ?6, tags = ?7, version = ?8
            WHERE id = ?9 AND system_id = ?10",
            params![
                file_record.filename,
                file_record.file_path,
                file_record.last_modified.to_rfc3339(),
                serde_json::to_string(&file_record.compliance_summary)?,
                serde_json::to_string(&file_record.remediation_progress)?,
                serde_json::to_string(&file_record.metadata)?,
                serde_json::to_string(&file_record.tags)?,
                file_record.version,
                file_record.id,
                system_id
            ]
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn delete_stig_file(&mut self, id: &str, system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        tx.execute(
            "DELETE FROM stig_files WHERE id = ?1 AND system_id = ?2",
            params![id, system_id]
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn update_compliance(&mut self, id: &str, compliance_summary: &Value, system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        tx.execute(
            "UPDATE stig_files SET 
                compliance_summary = ?1, last_modified = ?2
            WHERE id = ?3 AND system_id = ?4",
            params![
                serde_json::to_string(compliance_summary)?,
                Utc::now().to_rfc3339(),
                id,
                system_id
            ]
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn update_progress(&mut self, id: &str, remediation_progress: &Value, system_id: &str) -> Result<(), DatabaseError> {
        let tx = self.conn.transaction()?;
        
        tx.execute(
            "UPDATE stig_files SET 
                remediation_progress = ?1, last_modified = ?2
            WHERE id = ?3 AND system_id = ?4",
            params![
                serde_json::to_string(remediation_progress)?,
                Utc::now().to_rfc3339(),
                id,
                system_id
            ]
        )?;

        tx.commit()?;
        Ok(())
    }
}

pub struct STIGFileQueries<'a> {
    conn: &'a Connection,
}

impl<'a> STIGFileQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_all_stig_files(&self, system_id: &str) -> Result<Vec<STIGFileRecord>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, system_id, filename, file_path, upload_date, last_modified,
                    compliance_summary, remediation_progress, metadata, tags,
                    version, created_by
             FROM stig_files 
             WHERE system_id = ?1 
             ORDER BY upload_date DESC"
        )?;

        let rows = stmt.query_map(params![system_id], |row| {
            self.row_to_stig_file_record(row)
        })?;

        let mut files = Vec::new();
        for row in rows {
            files.push(row?);
        }

        Ok(files)
    }

    pub fn get_stig_file_by_id(&self, id: &str, system_id: &str) -> Result<Option<STIGFileRecord>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, system_id, filename, file_path, upload_date, last_modified,
                    compliance_summary, remediation_progress, metadata, tags,
                    version, created_by
             FROM stig_files 
             WHERE id = ?1 AND system_id = ?2"
        )?;

        let mut rows = stmt.query_map(params![id, system_id], |row| {
            self.row_to_stig_file_record(row)
        })?;

        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_stig_file_content(&self, id: &str, system_id: &str) -> Result<Option<Value>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT checklist_content FROM stig_files WHERE id = ?1 AND system_id = ?2"
        )?;

        let mut rows = stmt.query_map(params![id, system_id], |row| {
            let content_str: String = row.get(0)?;
            let content: Value = serde_json::from_str(&content_str)
                .map_err(|_e| rusqlite::Error::InvalidColumnType(0, "checklist_content".to_string(), rusqlite::types::Type::Text))?;
            Ok(content)
        })?;

        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn row_to_stig_file_record(&self, row: &Row) -> Result<STIGFileRecord, rusqlite::Error> {
        let upload_date_str: String = row.get("upload_date")?;
        let last_modified_str: String = row.get("last_modified")?;
        let compliance_summary_str: String = row.get("compliance_summary")?;
        let remediation_progress_str: String = row.get("remediation_progress")?;
        let metadata_str: String = row.get("metadata")?;
        let tags_str: String = row.get("tags")?;

        let upload_date = DateTime::parse_from_rfc3339(&upload_date_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "upload_date".to_string(), rusqlite::types::Type::Text))?
            .with_timezone(&Utc);

        let last_modified = DateTime::parse_from_rfc3339(&last_modified_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "last_modified".to_string(), rusqlite::types::Type::Text))?
            .with_timezone(&Utc);

        let compliance_summary: Value = serde_json::from_str(&compliance_summary_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "compliance_summary".to_string(), rusqlite::types::Type::Text))?;

        let remediation_progress: Value = serde_json::from_str(&remediation_progress_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "remediation_progress".to_string(), rusqlite::types::Type::Text))?;

        let metadata: Value = serde_json::from_str(&metadata_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "metadata".to_string(), rusqlite::types::Type::Text))?;

        let tags: Vec<String> = serde_json::from_str(&tags_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(0, "tags".to_string(), rusqlite::types::Type::Text))?;

        Ok(STIGFileRecord {
            id: row.get("id")?,
            filename: row.get("filename")?,
            file_path: row.get("file_path")?,
            upload_date,
            last_modified,
            compliance_summary,
            remediation_progress,
            metadata,
            tags,
            version: row.get("version")?,
            created_by: row.get("created_by")?,
        })
    }
}