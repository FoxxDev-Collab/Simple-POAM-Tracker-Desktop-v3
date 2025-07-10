# POAM Tracker - DoD/Air Force Deployment Guide

## Overview
This guide provides specific instructions for deploying the POAM Tracker application in DoD Air Force environments with enhanced security policies.

## System Requirements
- Windows 10/11 (Air Force standard)
- User account with local application installation permissions
- Minimum 500MB free disk space in user profile

## Data Storage Location
The application now uses the proper Windows user data directory for database storage:
```
%APPDATA%\com.poam-tracker.app\poam_tracker.db
```

This ensures compatibility with DoD security policies and user permission structures.

## Installation Steps

### Option 1: Portable Installation (Recommended for DoD)
1. Download the portable executable (.exe file)
2. Create a folder in your user directory: `C:\Users\[YOUR_USERNAME]\Applications\POAM_Tracker`
3. Place the executable in this folder
4. Run the application - it will automatically create the database in the proper user data location

### Option 2: Standard Installation
1. Download the installer (.msi file)
2. Run as administrator if available, or request IT assistance
3. The application will install to Program Files and create user data in the appropriate location

## Troubleshooting Common DoD Environment Issues

### Error: "Failed to Create POAM: the filename, directory name, or volume label syntax is incorrect"
**Solution:** This error typically occurs when the application tries to write to restricted directories. The updated version now uses proper user data directories.

**Additional Steps:**
1. Ensure you have write permissions to your user profile
2. Check that your antivirus isn't blocking the application
3. Try running the application from your Documents folder initially

### Error: Database Access Denied
**Causes:**
- Group Policy restrictions on database files
- Antivirus real-time protection blocking SQLite operations
- Insufficient user permissions

**Solutions:**
1. Request IT to whitelist the application executable
2. Add the application data folder to antivirus exclusions:
   `%APPDATA%\com.poam-tracker.app\`
3. Check with your system administrator about SQLite database permissions

### Network/Proxy Issues
If the application needs to download updates or components:
1. Configure the application to work with your proxy settings
2. Request IT to whitelist any required URLs
3. Use the offline/portable version if network restrictions are strict

## Security Considerations

### Data Encryption
- The SQLite database stores data in plain text
- For classified information, ensure the database file is on an encrypted drive
- Consider implementing additional encryption if required by your security protocols

### File Permissions
The application creates files with standard user permissions. If enhanced security is needed:
1. Manually set stricter permissions on the data directory
2. Use Windows EFS encryption on the database file
3. Store the database on a secured network drive if policy requires

### Audit Trail
- All database operations are logged to the console during development
- For production use, consider implementing audit logging if required

## Network Isolation Environments

For air-gapped or highly restricted networks:
1. Use the portable version - no network connectivity required
2. Database is fully local - no external dependencies
3. Export/import functionality works with local files only

## Backup and Recovery

### Automatic Backup Location
The database is stored in:
```
%APPDATA%\com.poam-tracker.app\poam_tracker.db
```

### Manual Backup Process
1. Close the application
2. Copy the database file to your backup location
3. To restore: replace the database file with your backup

### Group Policy Backup
If your organization uses roaming profiles or folder redirection:
- The database will automatically be included in profile backups
- Ensure %APPDATA% is included in your roaming profile

## Performance Optimization for DoD Systems

### Antivirus Exclusions
Request these exclusions from your IT team:
- Application executable: `POAM_Tracker.exe`
- Data directory: `%APPDATA%\com.poam-tracker.app\`
- File types: `*.db`, `*.sqlite`

### Memory and CPU Usage
- The application uses minimal resources (~50MB RAM)
- Database operations are optimized for local use
- No background network activity

## Support and Maintenance

### Version Updates
1. Download new version
2. Replace the executable (data is preserved automatically)
3. First run will handle any database schema updates

### Data Migration
When moving to a new computer:
1. Export data using the built-in export function
2. Install application on new system
3. Import data using the import function

## Contact Information
For DoD-specific deployment issues:
- Work with your local IT support team
- Provide this deployment guide to assist with troubleshooting
- Reference error codes and database path information from this guide

## Compliance Notes
- Application stores data locally (no cloud components)
- No telemetry or analytics collection
- Offline-capable for secure environments
- Compatible with standard DoD Windows configurations 