import { CourseMaterial } from '../../types';
import { runAdminAction } from './adminActions';

export interface CourseMaterialListOptions {
  courseId?: string;
  mine?: boolean;
}

export interface DownloadedCourseMaterial {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
}

/**
 * List only materials the caller is allowed to see. The server filters by the
 * caller's trusted institution; this is not a client-side Query filter.
 */
export async function listCourseMaterials(
  options: CourseMaterialListOptions = {}
): Promise<CourseMaterial[]> {
  const materials = await runAdminAction<CourseMaterial[]>(
    'list_course_materials',
    {
      courseId: options.courseId,
      mine: options.mine === true,
    }
  );
  return Array.isArray(materials) ? materials : [];
}

export async function createCourseMaterial(input: {
  title: string;
  description: string;
  fileId: string;
  bucketId: string;
  courseId: string;
}): Promise<CourseMaterial> {
  return await runAdminAction<CourseMaterial>('create_course_material', input);
}

export async function updateCourseMaterial(input: {
  materialId: string;
  title?: string;
  description?: string;
  courseId?: string;
}): Promise<CourseMaterial> {
  return await runAdminAction<CourseMaterial>('update_course_material', input);
}

/**
 * Download file bytes through the authorized server action. Storage files are
 * private so a browser cannot bypass institution checks with a direct URL.
 */
export async function downloadCourseMaterial(materialId: string): Promise<DownloadedCourseMaterial> {
  const result = await runAdminAction<{
    fileName: string;
    mimeType: string;
    size: number;
    base64: string;
  }>('get_course_material_file', { materialId });

  if (!result?.base64) {
    throw new Error('The server returned an empty document.');
  }

  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    blob: new Blob([bytes], { type: result.mimeType || 'application/octet-stream' }),
    fileName: result.fileName || 'course-material',
    mimeType: result.mimeType || 'application/octet-stream',
    size: result.size || bytes.length,
  };
}

/** Client-side UX validation. The server repeats every check. */
export function validateMaterialFile(file: File): string | null {
  const extension = file.name.toLowerCase().match(/\.(pdf|docx|pptx|txt)$/);
  if (!extension) return 'invalid_type';
  if (!file.size || file.size <= 0) return 'empty';
  if (file.size > 10 * 1024 * 1024) return 'too_large';
  return null;
}
