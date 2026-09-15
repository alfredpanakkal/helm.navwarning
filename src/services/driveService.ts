import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { NavWarning, RawArtifact, IngestionGeneration } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Drive scope for app-created files
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might need a fresh sign-in if missing after page reload
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive Sign-in Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- Google Drive REST API Integrations ---

const DRIVE_FOLDER_NAME = 'NavWarn Maritime Evidence Locker';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Searches for or creates a dedicated "NavWarn Maritime Evidence Locker" folder in the user's Drive.
 */
export const getOrCreateNavWarnFolder = async (accessToken: string): Promise<string> => {
  // Query existing folder
  const query = encodeURIComponent(`name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive Search Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Secure backup storage for NavWarn maritime evidence artifacts, GeoJSON spatial records, and ingestion audit logs.',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Drive Folder Creation Error (${createRes.status}): ${errText}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

/**
 * Uploads a text/JSON file into the specified folder in Google Drive using multipart upload.
 */
export const uploadFileToDrive = async (
  accessToken: string,
  folderId: string,
  filename: string,
  mimeType: string,
  content: string
): Promise<DriveFileItem> => {
  const metadata = {
    name: filename,
    mimeType: mimeType,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Drive Upload Error (${uploadRes.status}): ${errText}`);
  }

  return await uploadRes.json();
};

/**
 * Lists all files inside the NavWarn folder in Drive.
 */
export const listFilesInNavWarnFolder = async (
  accessToken: string,
  folderId: string
): Promise<DriveFileItem[]> => {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,size,webViewLink)&orderBy=createdTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive List Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Convenience helper to export GeoJSON spatial warnings directly to Google Drive
 */
export const backupGeoJsonToDrive = async (
  accessToken: string,
  warnings: NavWarning[]
): Promise<DriveFileItem> => {
  const folderId = await getOrCreateNavWarnFolder(accessToken);
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      exported_at: new Date().toISOString(),
      total_warnings: warnings.length,
      active_warnings: warnings.filter((w) => w.status === 'active').length,
    },
    features: warnings.flatMap((w) =>
      w.spatial.geometries.map((g, idx) => ({
        type: 'Feature',
        geometry: {
          type: g.type,
          coordinates: g.coordinates,
        },
        properties: {
          warning_id: w.warning_id,
          source_warning_id: w.source_warning_id,
          navarea: w.navarea,
          publisher_id: w.publisher_id,
          status: w.status,
          issued_date: w.issued_date,
          area_text: w.area_text,
          feature_label: g.label || `Feature #${idx + 1}`,
        },
      }))
    ),
  };

  const filename = `NavWarn_GeoJSON_Export_${new Date().toISOString().slice(0, 10)}.geojson`;
  return await uploadFileToDrive(
    accessToken,
    folderId,
    filename,
    'application/geo+json',
    JSON.stringify(geojson, null, 2)
  );
};

/**
 * Convenience helper to backup raw evidence artifacts directly to Google Drive
 */
export const backupEvidenceToDrive = async (
  accessToken: string,
  artifact: RawArtifact
): Promise<DriveFileItem> => {
  const folderId = await getOrCreateNavWarnFolder(accessToken);
  const filename = `Evidence_${artifact.source_id}_${artifact.artifact_id}.txt`;
  return await uploadFileToDrive(
    accessToken,
    folderId,
    filename,
    'text/plain',
    `NAVWARN EVIDENCE ARCHIVE RECORD\n` +
      `==============================\n` +
      `Artifact ID: ${artifact.artifact_id}\n` +
      `Source ID: ${artifact.source_id}\n` +
      `Storage Path: ${artifact.path}\n` +
      `Content Hash (SHA-256): ${artifact.content_hash}\n` +
      `Content Type: ${artifact.content_type}\n` +
      `Fetched Timestamp: ${artifact.timestamp}\n` +
      `Size: ${artifact.size_bytes} bytes\n\n` +
      `RAW PAYLOAD SAMPLE:\n` +
      `-------------------\n` +
      `${artifact.preview_text}\n`
  );
};
