/**
 * APPWRITE FUNCTION: pdf-extract
 *
 * Server-side PDF text extraction for course materials.
 *
 * The function retrieves an authorized PDF from Appwrite Storage (server-side,
 * using the function's API key), extracts its actual text with pdfjs-dist, and
 * returns the extracted text to the caller. No Appwrite API keys or service
 * credentials are ever returned to the frontend.
 *
 * Environment variables (set in Appwrite Console → Functions → pdf-extract →
 * Settings → Environment variables — NEVER in the frontend):
 *   APPWRITE_ENDPOINT   e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY    server API key (databases.read, storage.read)
 *   APPWRITE_DATABASE_ID
 *
 * Input (POST JSON): { "fileId": "...", "bucketId": "course-materials" }
 * Output (JSON):     { "success": true, "text": "...", "length": N }
 *                    or { "success": false, "error": "..." }
 *
 * Authorization:
 *   - Caller must present a valid Appwrite JWT (x-appwrite-user-jwt).
 *   - The caller's profile institutionId must match the material's institutionId.
 *   - Only students, instructors, teachers, department admins and global admins
 *     affiliated with the same institution may retrieve the material.
 *   - Frontend institutionId filtering is never trusted; every check is done
 *     server-side from the verified caller profile.
 */

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db';

const COLLECTIONS = {
  COURSE_MATERIALS: 'course_materials',
  PROFILES: 'profiles',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_LENGTH = 100000; // 100 k characters
const MAX_DOCX_EXTRACTED_TEXT = 50000; // 50 k characters max from DOCX
const MAX_PPTX_EXTRACTED_TEXT = 50000; // 50 k characters max from PPTX
const MAX_ZIP_ENTRY_DECOMPRESSED_SIZE = 2 * 1024 * 1024; // 2 MB max decompressed content per ZIP entry
const ALLOWED_ROLES = [
  'student', 'instructor', 'teacher', 'department_admin', 'global_admin', 'tvet_admin', 'admin',
];

const COURSE_MATERIALS_BUCKET = 'course-materials';
const FILE_MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
};
const SUPPORTED_EXTENSIONS = Object.keys(FILE_MIME_BY_EXTENSION);

/**
 * Validate storage file metadata: size, emptiness and supported document type.
 * Extension and MIME type must agree; magic bytes are checked after download.
 * Throws on the first failed validation. Never falls back silently.
 * @param {object} fileMeta - Appwrite storage file document
 */
export function validateFile(fileMeta) {
  if (!fileMeta) throw new Error('Storage file metadata is required.');

  const fileSize = Number(fileMeta.sizeOriginal || fileMeta.size || 0);
  const mimeType = String(fileMeta.mimeType || '').toLowerCase();
  const name = String(fileMeta.name || '').trim();
  const lowerName = name.toLowerCase();
  const extension = SUPPORTED_EXTENSIONS.find((candidate) => lowerName.endsWith(candidate));

  if (!fileSize || fileSize <= 0) {
    throw new Error('The document is empty.');
  }
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).`);
  }
  if (!extension) {
    throw new Error('Only PDF, DOCX, PPTX, and TXT documents are supported.');
  }

  const expectedMime = FILE_MIME_BY_EXTENSION[extension];
  if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== expectedMime) {
    throw new Error('The file type does not match its extension.');
  }

  return { fileSize, mimeType: expectedMime, extension, fileName: name };
}

/**
 * Authorize a caller for a course material.
 * Enforces server-side institution matching and allowed roles.
 * @param {object} profile - caller's profile document
 * @param {object} material - course material document
 */
export function authorizeMaterial(profile, material) {
  if (!profile.institutionId) {
    throw new Error('Caller is not affiliated with an institution.');
  }
  if (!ALLOWED_ROLES.includes(profile.role)) {
    throw new Error('Caller role is not authorized for learning materials.');
  }
  if (material.institutionId !== profile.institutionId) {
    throw new Error('You are not authorized to retrieve this document.');
  }
  return true;
}

/**
 * Verify that the material belongs to a course whose program is in the same
 * institution as the material document. This prevents a material record from
 * being attached to a course in another institution.
 */
export function authorizeMaterialCourse(material, course, program) {
  if (!material) throw new Error('Course material not found.');
  if (!course?.programId) {
    throw new Error('Course is not linked to a program.');
  }
  if (!program || program.$id !== course.programId) {
    throw new Error('Course program could not be verified.');
  }
  if (!program.institutionId) {
    throw new Error('Program is not linked to an institution.');
  }
  if (!material.institutionId || material.institutionId !== program.institutionId) {
    throw new Error('Course material institution binding is invalid.');
  }
  return true;
}

/**
 * Validate magic bytes so a renamed executable or text file cannot be treated
 * as a supported document. Called after the storage download succeeds.
 */
export function validateFileSignature(buffer, fileName = '', mimeType = '') {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!data.length) throw new Error('The document is empty.');

  const lowerName = String(fileName || '').toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf';
  const isDocx = lowerName.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPptx = lowerName.endsWith('.pptx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const isTxt = lowerName.endsWith('.txt') || mimeType === 'text/plain';

  if (isPdf) {
    if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('The file is not a valid PDF.');
    }
    return true;
  }

  if (isDocx || isPptx) {
    if (data[0] !== 0x50 || data[1] !== 0x4b || data[2] !== 0x03 || data[3] !== 0x04) {
      throw new Error('The file is not a valid ZIP-based document.');
    }
    return true;
  }

  if (isTxt) {
    if (data.includes(0x00) || data.toString('utf8').includes('\uFFFD')) {
      throw new Error('The text document is not valid UTF-8 text.');
    }
    return true;
  }

  throw new Error('Unsupported document format.');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function appwriteRequest(path, options = {}) {
  if (!projectId || !apiKey) {
    throw new Error('APPWRITE_PROJECT_ID or APPWRITE_API_KEY is not configured on this function.');
  }
  const response = await fetch(`${endpoint.replace(/\/+$/, '')}${path}`, {
    ...options,
    headers: {
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || text || `Appwrite request failed with ${response.status}`);
  }
  return data;
}

async function verifyCaller(headers) {
  const jwt = headers?.['x-appwrite-user-jwt'];
  if (typeof jwt !== 'string' || !jwt.trim()) return null;
  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/account`, {
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-JWT': jwt,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const account = await response.json();
    return typeof account?.$id === 'string' ? account.$id : null;
  } catch { return null; }
}

async function getProfile(userId) {
  const query = encodeURIComponent(JSON.stringify({
    method: 'equal',
    attribute: 'userId',
    values: [userId],
  }));
  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/${COLLECTIONS.PROFILES}/documents?queries[]=${query}&limit=1`
  );
  return result?.documents?.[0] || null;
}

async function findMaterialByFileId(fileId) {
  const query = encodeURIComponent(JSON.stringify({
    method: 'equal',
    attribute: 'fileId',
    values: [fileId],
  }));
  const result = await appwriteRequest(
    `/databases/${databaseId}/collections/${COLLECTIONS.COURSE_MATERIALS}/documents?queries[]=${query}&limit=1`
  );
  return result?.documents?.[0] || null;
}

async function getMaterial(materialId) {
  return appwriteRequest(
    `/databases/${databaseId}/collections/${COLLECTIONS.COURSE_MATERIALS}/documents/${encodeURIComponent(materialId)}`
  );
}

async function getCourse(courseId) {
  if (!courseId) throw new Error('Course material has no course.');
  return appwriteRequest(
    `/databases/${databaseId}/collections/learning_modules/documents/${encodeURIComponent(courseId)}`
  );
}

async function getProgram(programId) {
  if (!programId) return null;
  return appwriteRequest(
    `/databases/${databaseId}/collections/programs/documents/${encodeURIComponent(programId)}`
  );
}

export function verifyMaterialBinding(material, suppliedFileId, suppliedBucketId) {
  if (!material) {
    throw new Error('Course material not found.');
  }
  if (!material.bucketId || material.bucketId !== COURSE_MATERIALS_BUCKET) {
    throw new Error('Course material storage bucket is invalid.');
  }
  if (!material.fileId) {
    throw new Error('Course material file is missing.');
  }
  if (suppliedBucketId && suppliedBucketId !== material.bucketId) {
    throw new Error('bucketId does not match the material document.');
  }
  if (suppliedFileId && suppliedFileId !== material.fileId) {
    throw new Error('fileId does not match the material document.');
  }
  return { fileId: material.fileId, bucketId: material.bucketId };
}

export default async (context) => {
  const { req, res, log, error } = context;

  if (req.method !== 'POST') {
    return res.json({ success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const userId = await verifyCaller(req.headers);
  if (!userId) {
    return res.json({ success: false, error: 'Authentication required.' }, 401);
  }
  log('pdf-extract request from user: ' + userId);

  let callerProfile;
  try {
    callerProfile = await getProfile(userId);
  } catch (err) {
    return res.json({ success: false, error: 'Failed to verify caller identity.' }, 403);
  }
  if (!callerProfile) {
    return res.json({ success: false, error: 'Caller profile not found.' }, 403);
  }
  const callerInstitutionId = callerProfile.institutionId;
  const callerRole = callerProfile.role;
  if (!callerInstitutionId) {
    return res.json({ success: false, error: 'Caller is not affiliated with an institution.' }, 403);
  }
  if (!ALLOWED_ROLES.includes(callerRole)) {
    return res.json({ success: false, error: 'Caller role is not authorized for learning materials.' }, 403);
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ success: false, error: 'Invalid JSON payload.' }, 400);
  }
  const { materialId, fileId, bucketId } = payload || {};
  if (!materialId && !fileId) {
    return res.json({ success: false, error: 'materialId or fileId is required.' }, 400);
  }

  let material;
  try {
    material = materialId
      ? await getMaterial(materialId)
      : await findMaterialByFileId(fileId);
  } catch (err) {
    error('Material lookup failed: ' + err.message);
    return res.json({ success: false, error: 'Failed to look up course material.' }, 500);
  }
  if (!material) {
    return res.json({ success: false, error: 'Course material not found.' }, 404);
  }
  if (material.institutionId !== callerInstitutionId) {
    log('Authorization denied: user ' + userId + ' (institution ' + callerInstitutionId +
      ') requested material ' + material.$id + ' (institution ' + material.institutionId + ')');
    return res.json({ success: false, error: 'You are not authorized to retrieve this document.' }, 403);
  }

  let course;
  let program;
  try {
    course = await getCourse(material.courseId);
    program = await getProgram(course.programId);
  } catch (err) {
    error('Course binding lookup failed: ' + err.message);
    return res.json({ success: false, error: 'Failed to verify course authorization.' }, 403);
  }
  try {
    authorizeMaterialCourse(material, course, program);
  } catch (err) {
    log('Authorization denied: material ' + material.$id + ' is not bound to its course institution.');
    return res.json({ success: false, error: err.message }, 403);
  }

  let binding;
  try {
    binding = verifyMaterialBinding(material, fileId, bucketId);
  } catch (err) {
    return res.json({ success: false, error: err.message }, 400);
  }

  const resolvedFileId = binding.fileId;
  const resolvedBucketId = binding.bucketId;

  let fileMeta;
  let validatedFile;
  try {
    fileMeta = await appwriteRequest(`/storage/buckets/${resolvedBucketId}/files/${resolvedFileId}`);
    validatedFile = validateFile(fileMeta);
  } catch (err) {
    if (err instanceof Error && /document|file|supported|type|empty|too large/i.test(err.message)) {
      return res.json({ success: false, error: err.message }, 400);
    }
    error('Storage metadata lookup failed: ' + err.message);
    return res.json({ success: false, error: 'Failed to read storage metadata.' }, 500);
  }

  let fileBuffer;
  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/storage/buckets/${resolvedBucketId}/files/${resolvedFileId}/content`, {
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Storage download failed with ${response.status}`);
    }
    fileBuffer = await response.arrayBuffer();
  } catch (err) {
    error('File download failed: ' + err.message);
    return res.json({ success: false, error: 'Failed to download the document.' }, 500);
  }

  try {
    validateFileSignature(fileBuffer, validatedFile.fileName, validatedFile.mimeType);
  } catch (err) {
    error('File signature validation failed: ' + err.message);
    return res.json({ success: false, error: err.message }, 400);
  }

  let extractedText;
  try {
    extractedText = await extractDocumentText(fileBuffer, validatedFile.fileName, validatedFile.mimeType);
  } catch (err) {
    error('Document extraction failed: ' + err.message);
    return res.json({
      success: false,
      error: 'Failed to extract text from the document: ' + err.message,
    }, 422);
  }

  if (!extractedText || !extractedText.trim()) {
    return res.json({
      success: false,
      error: 'The document contains no extractable text.',
    }, 422);
  }

  if (extractedText.length > MAX_TEXT_LENGTH) {
    return res.json({
      success: false,
      error: `Extracted text exceeds maximum length (${MAX_TEXT_LENGTH} characters).`,
    }, 400);
  }

  log('Extracted ' + extractedText.length + ' characters from material ' + resolvedFileId);
  return res.json({ success: true, text: extractedText, length: extractedText.length });
};

/**
 * Extract text from a PDF buffer using pdfjs-dist (maintained library).
 * Throws on malformed/empty/unsupported PDFs — never falls back silently.
 */
function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function readZipEntry(buffer, entryName) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (data.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid ZIP archive.');

  const centralDirectoryOffset = data.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = data.readUInt32LE(eocdOffset + 12);
  let cursor = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  while (cursor < centralDirectoryEnd) {
    if (data.readUInt32LE(cursor) !== 0x02014b50) break;
    const compressionMethod = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const fileNameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const localHeaderOffset = data.readUInt32LE(cursor + 42);
    const fileName = data.toString('utf8', cursor + 46, cursor + 46 + fileNameLength).replace(/\\/g, '/');

    if (fileName === entryName) {
      const localNameLength = data.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = data.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedData = data.subarray(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) return compressedData;
      if (compressionMethod === 8) {
        const zlib = await import('node:zlib');
        return zlib.inflateRawSync(compressedData);
      }
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`ZIP entry not found: ${entryName}`);
}

function extractXmlText(xml, tagPattern) {
  const matches = [...xml.matchAll(tagPattern)];
  return matches
    .map((match) => decodeXmlEntities(match[1] || ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractDocxText(buffer) {
  const xmlBuffer = await readZipEntry(buffer, 'word/document.xml');
  const xmlSize = xmlBuffer.length;
  if (xmlSize > MAX_ZIP_ENTRY_DECOMPRESSED_SIZE) {
    throw new Error('DOCX document is too large (decompressed XML exceeds 2 MB limit).');
  }
  const xml = xmlBuffer.toString('utf8');
  const text = extractXmlText(xml, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  if (!text) throw new Error('The DOCX contains no extractable text.');
  if (text.length > MAX_DOCX_EXTRACTED_TEXT) {
    throw new Error(`DOCX extracted text exceeds maximum length (${MAX_DOCX_EXTRACTED_TEXT} characters).`);
  }
  return text;
}

async function extractPptxText(buffer) {
  const zipData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = zipData.length - 22; i >= 0; i--) {
    if (zipData.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid PPTX archive.');

  const centralDirectoryOffset = zipData.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = zipData.readUInt32LE(eocdOffset + 12);
  const cursorEnd = centralDirectoryOffset + centralDirectorySize;
  const slideNames = [];
  let cursor = centralDirectoryOffset;
  while (cursor < cursorEnd) {
    if (zipData.readUInt32LE(cursor) !== 0x02014b50) break;
    const fileNameLength = zipData.readUInt16LE(cursor + 28);
    const extraLength = zipData.readUInt16LE(cursor + 30);
    const commentLength = zipData.readUInt16LE(cursor + 32);
    const fileName = zipData.toString('utf8', cursor + 46, cursor + 46 + fileNameLength).replace(/\\/g, '/');
    if (/^ppt\/slides\/slide\d+\.xml$/.test(fileName)) {
      slideNames.push(fileName);
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  if (slideNames.length === 0) {
    throw new Error('The PPTX contains no slides.');
  }

  slideNames.sort((a, b) => {
    const aNumber = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
    const bNumber = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
    return aNumber - bNumber;
  });

  const slideTexts = [];
  for (const slideName of slideNames) {
    const slideBuffer = await readZipEntry(buffer, slideName);
    if (slideBuffer.length > MAX_ZIP_ENTRY_DECOMPRESSED_SIZE) {
      throw new Error(`PPTX slide exceeds 2 MB decompressed size limit.`);
    }
    const xml = slideBuffer.toString('utf8');
    const text = extractXmlText(xml, /<a:t>([\s\S]*?)<\/a:t>/g);
    if (text) slideTexts.push(text);
  }

  const text = slideTexts.join('\n');
  if (!text) throw new Error('The PPTX contains no extractable text.');
  if (text.length > MAX_PPTX_EXTRACTED_TEXT) {
    throw new Error(`PPTX extracted text exceeds maximum length (${MAX_PPTX_EXTRACTED_TEXT} characters).`);
  }
  return text;
}

export async function extractDocumentText(buffer, fileName = '', mimeType = '') {
  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result?.text || '').trim();
      if (!text) throw new Error('The PDF contains no extractable text.');
      return text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (lowerName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractDocxText(buffer);
  }

  if (lowerName.endsWith('.pptx') || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return await extractPptxText(buffer);
  }

  if (lowerName.endsWith('.txt') || mimeType === 'text/plain') {
    const text = Buffer.from(buffer).toString('utf8').trim();
    if (!text) throw new Error('The text document is empty.');
    return text;
  }

  throw new Error('Unsupported document format.');
}

export const extractPdfText = (buffer) =>
  extractDocumentText(buffer, 'document.pdf', 'application/pdf');

