// Simple date utility functions to avoid string formatting issues

/// Normalize a date string to ISO format (YYYY-MM-DD)
pub fn normalize_date_format(date_str: &str) -> String {
    // If the date is already in ISO format (YYYY-MM-DD), return it as is
    if date_str.len() >= 10 && &date_str[4..5] == "-" && &date_str[7..8] == "-" {
        return date_str[0..10].to_string();
    }
    
    // Handle common date formats manually
    // Try MM/DD/YYYY format
    if let Some(parts) = parse_date_slashes(date_str) {
        if parts.len() == 3 {
            // Check if first part is likely month (1-12)
            let first = parts[0].parse::<u32>().unwrap_or(0);
            if first >= 1 && first <= 12 {
                let month = first;
                let day = parts[1].parse::<u32>().unwrap_or(0);
                let year = parts[2].parse::<i32>().unwrap_or(0);
                
                if day >= 1 && day <= 31 && year > 0 {
                    return format!("{:04}-{:02}-{:02}", year, month, day);
                }
            }
        }
    }
    
    // Try DD/MM/YYYY format
    if let Some(parts) = parse_date_slashes(date_str) {
        if parts.len() == 3 {
            // Check if second part is likely month (1-12)
            let second = parts[1].parse::<u32>().unwrap_or(0);
            if second >= 1 && second <= 12 {
                let day = parts[0].parse::<u32>().unwrap_or(0);
                let month = second;
                let year = parts[2].parse::<i32>().unwrap_or(0);
                
                if day >= 1 && day <= 31 && year > 0 {
                    return format!("{:04}-{:02}-{:02}", year, month, day);
                }
            }
        }
    }
    
    // Try RFC3339 format without using chrono's format strings
    if date_str.contains('T') && date_str.contains(':') {
        // Just extract the date part before T
        if let Some(date_part) = date_str.split('T').next() {
            if date_part.len() >= 10 && &date_part[4..5] == "-" && &date_part[7..8] == "-" {
                return date_part[0..10].to_string();
            }
        }
    }
    
    // Return the original string if we can't parse it
    date_str.to_string()
}

// Helper function to split date strings by slashes or dashes
fn parse_date_slashes(date_str: &str) -> Option<Vec<&str>> {
    let parts: Vec<&str>;
    if date_str.contains('/') {
        parts = date_str.split('/').collect();
    } else if date_str.contains('-') {
        parts = date_str.split('-').collect();
    } else {
        return None;
    }
    
    if parts.len() == 3 {
        return Some(parts);
    }
    None
}
