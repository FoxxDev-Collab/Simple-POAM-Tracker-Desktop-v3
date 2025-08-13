use crate::models::Note;
use rusqlite::{params, Connection};
use serde_json;
use std::collections::HashMap;
use super::utils::DatabaseError;

pub struct NoteOperations<'a> {
    conn: &'a mut Connection,
}

pub struct NoteQueries<'a> {
    conn: &'a Connection,
}

impl<'a> NoteOperations<'a> {
    pub fn new(conn: &'a mut Connection) -> Self {
        Self { conn }
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
}

impl<'a> NoteQueries<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

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
        let mut note_associations: HashMap<String, (Vec<i64>, Vec<String>)> = HashMap::new();
        
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
}
