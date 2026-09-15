import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutDrive,
  getAccessToken,
  getOrCreateNavWarnFolder,
  backupGeoJsonToDrive,
  listFilesInNavWarnFolder,
  uploadFileToDrive,
  DriveFileItem,
} from '../services/driveService';
import { NavWarning, RawArtifact, IngestionGeneration } from '../types';
import { HardDrive, CloudUpload, ShieldCheck, CheckCircle2, RefreshCw, ExternalLink, FileText, Lock, LogOut, Download } from 'lucide-react';

interface DriveBackupViewProps {
  warnings: NavWarning[];
  artifacts: RawArtifact[];
  generations: IngestionGeneration[];
}

export const DriveBackupView: React.FC<DriveBackupViewProps> = ({
  warnings,
  artifacts,
  generations,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        loadFolderAndFiles(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setFolderId(null);
        setDriveFiles([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadFolderAndFiles = async (accessToken: string) => {
    setIsLoadingFiles(true);
    try {
      const fId = await getOrCreateNavWarnFolder(accessToken);
      setFolderId(fId);
      const files = await listFilesInNavWarnFolder(accessToken, fId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Error loading Drive folder:', err);
      setStatusMessage(`Drive connection error: ${err.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        await loadFolderAndFiles(res.accessToken);
        setStatusMessage('Successfully authenticated with Google Drive.');
      }
    } catch (err: any) {
      setStatusMessage(`Sign in failed: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutDrive();
    setUser(null);
    setToken(null);
    setFolderId(null);
    setDriveFiles([]);
    setStatusMessage('Signed out of Google Drive.');
  };

  const handleBackupGeoJson = async () => {
    if (!token) return;
    setIsUploading(true);
    try {
      const file = await backupGeoJsonToDrive(token, warnings);
      setStatusMessage(`Saved GeoJSON spatial export '${file.name}' to Google Drive.`);
      await loadFolderAndFiles(token);
    } catch (err: any) {
      setStatusMessage(`GeoJSON Backup failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackupAuditLogs = async () => {
    if (!token || !folderId) return;
    setIsUploading(true);
    try {
      const filename = `Generations_Audit_Log_${new Date().toISOString().slice(0, 10)}.json`;
      const file = await uploadFileToDrive(
        token,
        folderId,
        filename,
        'application/json',
        JSON.stringify(generations, null, 2)
      );
      setStatusMessage(`Saved generation audit log '${file.name}' to Google Drive.`);
      await loadFolderAndFiles(token);
    } catch (err: any) {
      setStatusMessage(`Audit Log Backup failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackupEvidenceLocker = async () => {
    if (!token || !folderId) return;
    setIsUploading(true);
    try {
      const filename = `Evidence_Locker_Artifacts_${new Date().toISOString().slice(0, 10)}.json`;
      const file = await uploadFileToDrive(
        token,
        folderId,
        filename,
        'application/json',
        JSON.stringify(artifacts, null, 2)
      );
      setStatusMessage(`Saved evidence locker artifacts '${file.name}' to Google Drive.`);
      await loadFolderAndFiles(token);
    } catch (err: any) {
      setStatusMessage(`Artifacts Backup failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Overview Banner */}
      <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gw-primary" />
            <h2 className="text-base font-bold text-gw-primary uppercase tracking-wider">Google Drive Secure Evidence & Spatial Locker</h2>
          </div>
          <p className="text-xs text-gw-accent mt-1 leading-relaxed">
            Store and backup raw scraper HTTP evidence, GeoJSON spatial hazard features, and atomic pointer audit histories in a dedicated Google Drive folder (<code className="bg-gw-bg px-1 py-0.5 rounded border border-gw-secondary font-mono">NavWarn Maritime Evidence Locker</code>).
          </p>
        </div>

        {user ? (
          <div className="flex items-center gap-3 bg-gw-bg px-4 py-2.5 rounded-xl border border-gw-primary">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-7 h-7 rounded-full border border-gw-primary" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            )}
            <div className="text-left">
              <div className="text-xs font-bold text-gw-primary">{user.displayName || user.email}</div>
              <div className="text-[10px] font-bold text-green-600 uppercase">Google Drive Connected</div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="text-gw-accent hover:text-red-600 p-1 rounded transition-colors ml-2"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="gsi-material-button hover:opacity-95 transition shadow-sm cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: '#131314',
              color: '#E3E3E3',
              borderRadius: '8px',
              border: '1px solid #333538',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <div className="gsi-material-button-icon" style={{ width: '18px', height: '18px' }}>
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google Drive'}</span>
          </button>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className="bg-green-50 border-2 border-green-500 p-4 rounded-xl text-xs font-mono font-bold text-green-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-green-700 hover:text-green-900 font-bold">✕</button>
        </div>
      )}

      {!user ? (
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-gw-bg border border-gw-primary text-gw-primary flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-gw-primary uppercase tracking-wider">Google Drive Authentication Required</h3>
            <p className="text-xs text-gw-accent">
              Sign in with your Google account to grant permission to write secure backups to your personal Google Drive (<code className="font-mono">drive.file</code> scope).
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded transition-all shadow-sm disabled:opacity-50"
            >
              {isLoggingIn ? 'Connecting to Google...' : 'Connect Google Drive'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Action Backup Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-gw-primary p-5 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gw-bg border border-gw-primary rounded text-gw-primary">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-gw-bg px-2 py-0.5 rounded font-bold text-gw-primary border border-gw-secondary uppercase">
                  GeoJSON Format
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gw-primary">Export Active Spatial Warnings</h3>
                <p className="text-xs text-gw-accent mt-1">
                  Save all {warnings.length} active spatial hazard geometries to Drive.
                </p>
              </div>
              <button
                onClick={handleBackupGeoJson}
                disabled={isUploading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Save GeoJSON to Drive</span>
              </button>
            </div>

            <div className="bg-white border-2 border-gw-primary p-5 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gw-bg border border-gw-primary rounded text-gw-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-gw-bg px-2 py-0.5 rounded font-bold text-gw-primary border border-gw-secondary uppercase">
                  JSON Evidence
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gw-primary">Archive Evidence Artifacts</h3>
                <p className="text-xs text-gw-accent mt-1">
                  Backup {artifacts.length} raw scraper payloads and SHA-256 hashes.
                </p>
              </div>
              <button
                onClick={handleBackupEvidenceLocker}
                disabled={isUploading}
                className="w-full bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                <span>Backup Artifacts to Drive</span>
              </button>
            </div>

            <div className="bg-white border-2 border-gw-primary p-5 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-gw-bg border border-gw-primary rounded text-gw-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-gw-bg px-2 py-0.5 rounded font-bold text-gw-primary border border-gw-secondary uppercase">
                  Audit History
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gw-primary">Save Generation Audit Logs</h3>
                <p className="text-xs text-gw-accent mt-1">
                  Export atomic pointer state updates and worker run history.
                </p>
              </div>
              <button
                onClick={handleBackupAuditLogs}
                disabled={isUploading}
                className="w-full bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                <span>Backup Audit Logs to Drive</span>
              </button>
            </div>
          </div>

          {/* Drive Folder File Browser */}
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b-2 border-gw-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gw-bg">
              <div>
                <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
                  <HardDrive className="w-4 h-4 text-gw-primary" />
                  <span>NavWarn Maritime Evidence Locker</span>
                </h3>
                <p className="text-[11px] text-gw-accent mt-0.5 font-mono">
                  Drive Folder ID: <span className="text-gw-primary font-bold">{folderId || 'Resolving...'}</span>
                </p>
              </div>

              <button
                onClick={() => token && loadFolderAndFiles(token)}
                disabled={isLoadingFiles}
                className="text-xs font-bold text-gw-primary hover:bg-white bg-gw-bg px-3 py-1.5 rounded border border-gw-primary flex items-center gap-2 uppercase tracking-wider shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                <span>Refresh List</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              {isLoadingFiles ? (
                <div className="p-8 text-center text-xs text-gw-accent font-mono flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-gw-primary" />
                  <span>Loading files from Google Drive...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="p-8 text-center text-xs text-gw-accent font-mono space-y-1">
                  <div>No files backed up yet in this folder.</div>
                  <div className="text-[11px] text-gw-accent">Use one of the backup buttons above to upload data to Google Drive.</div>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gw-primary">
                  <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b border-gw-secondary">
                    <tr>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">MIME Type</th>
                      <th className="py-3 px-4">Created Time</th>
                      <th className="py-3 px-4">Drive Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gw-secondary font-mono text-[11px]">
                    {driveFiles.map((f) => (
                      <tr key={f.id} className="hover:bg-gw-bg transition-colors">
                        <td className="py-3 px-4 font-bold text-gw-primary flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gw-primary shrink-0" />
                          <span>{f.name}</span>
                        </td>
                        <td className="py-3 px-4 text-gw-accent">{f.mimeType}</td>
                        <td className="py-3 px-4 text-gw-accent">
                          {f.createdTime ? f.createdTime.replace('T', ' ').slice(0, 19) : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {f.webViewLink ? (
                            <a
                              href={f.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gw-primary hover:underline flex items-center gap-1 font-bold uppercase text-[10px]"
                            >
                              <span>Open in Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-gw-accent">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
