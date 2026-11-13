/**
 * Shrink the shopper's photo before upload.
 *
 * Phone photos are 3–12 MB. The AI works at about 864×1296 px, so anything
 * bigger is wasted bandwidth and would hit Vercel's 4.5 MB request limit.
 * We resize the long side to 1280 px and save as JPEG ≈ 200–500 KB.
 * Re-encoding also drops EXIF metadata (GPS location, device info) — a privacy win.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.82;

export interface PreparedPhoto {
  /** Local file, for showing a preview. */
  uri: string;
  /** `data:image/jpeg;base64,...`, for upload. */
  dataUri: string;
}

export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (Math.max(width, height) > MAX_SIDE) {
      // Resize only the longer side; the other keeps the aspect ratio.
      context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG });
      if (!saved.base64) throw new Error('Image encoding failed');
      return { uri: saved.uri, dataUri: `data:image/jpeg;base64,${saved.base64}` };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
