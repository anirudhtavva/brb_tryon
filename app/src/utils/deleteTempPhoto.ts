/**
 * Deletes a temporary photo file from the phone.
 *
 * The photo picker and the photo shrinker each leave a copy in the app's private
 * cache. We delete both as soon as they are no longer needed, so the shopper's
 * photo does not stay on the phone after the try-on closes.
 *
 * Never throws: a file that is already gone, or a web "blob:" address, is simply skipped.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export function deleteTempPhoto(uri: string | null | undefined): void {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file://')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort: the OS clears the cache eventually anyway.
  }
}
