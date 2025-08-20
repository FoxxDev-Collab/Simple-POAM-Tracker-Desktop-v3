import React from 'react';
import { Upload, FileText } from 'lucide-react';
import { NessusScanMeta } from './types';

interface NessusFileUploadProps {
  loading: boolean;
  savedScans: NessusScanMeta[];
  selectedScanId: string | null;
  onFileSelect: () => void;
  onScanSelection: (scanId: string) => void;
}

export const NessusFileUpload: React.FC<NessusFileUploadProps> = ({
  loading,
  savedScans,
  selectedScanId,
  onFileSelect,
  onScanSelection
}) => {
  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload Nessus Scan Files
        </h3>
        <div className="upload-zone">
          <div className="upload-content" onClick={onFileSelect}>
            <Upload className="w-8 h-8 mb-2" />
            <div className="text-center">
              <p className="mb-1 text-foreground">Click to select Nessus scan file(s)</p>
              <p className="text-sm text-muted-foreground">Browse for .nessus files</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Selection Section */}
      {savedScans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Saved Scans ({savedScans.length})
          </h3>
          <div className="space-y-3">
            <select
              value={selectedScanId || ''}
              onChange={(e) => onScanSelection(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
              disabled={loading}
            >
              <option value="">Select a scan to analyze</option>
              {savedScans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.name} - {new Date(scan.imported_date).toLocaleDateString()} 
                  ({scan.total_vulnerabilities || 0} findings)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};