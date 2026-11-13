/**
 * The try-on flow as a small state machine:
 *
 *   idle → preparing → uploading → processing → done
 *                 ↘          ↘           ↘
 *                          error  (with "try again" or "choose another photo")
 *
 * Screens just read `state` and call `start`, `retry` or `reset`.
 * Leaving the screen cancels any request in flight.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isNewPhotoNeeded, startTryOn, TryOnError, waitForResult } from '../services/tryOnApi';
import { deleteTempPhoto } from '../utils/deleteTempPhoto';
import { preparePhoto, type PreparedPhoto } from '../utils/preparePhoto';

export type PhotoSource = 'camera' | 'library';

export type TryOnState =
  | { phase: 'idle' }
  | { phase: 'preparing' }
  | { phase: 'uploading'; photo: PreparedPhoto }
  | { phase: 'processing'; photo: PreparedPhoto; startedAt: number }
  | { phase: 'done'; photo: PreparedPhoto; resultUri: string }
  | {
      phase: 'error';
      photo?: PreparedPhoto;
      message: string;
      /** What the main button should do. */
      action: 'retry' | 'new-photo' | 'open-settings' | 'close';
    };

async function pickPhoto(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | 'denied' | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1, // we compress ourselves, once
    exif: false,
    allowsEditing: false,
  };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export function useTryOn(productId: string) {
  const [state, setState] = useState<TryOnState>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  // The shrunk photo file currently on the phone, so it can be deleted later.
  const photoFileRef = useRef<string | null>(null);

  /** Privacy: remove the shopper's photo from the phone's cache. */
  const forgetPhoto = useCallback(() => {
    deleteTempPhoto(photoFileRef.current);
    photoFileRef.current = null;
  }, []);

  // When the screen goes away: cancel anything in flight and delete the photo.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      forgetPhoto();
    },
    [forgetPhoto],
  );

  /** Upload + wait, for a photo that's already prepared. */
  const run = useCallback(
    async (photo: PreparedPhoto) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setState({ phase: 'uploading', photo });
        const job = await startTryOn(productId, photo.dataUri, controller.signal);
        setState({ phase: 'processing', photo, startedAt: Date.now() });
        const resultUri = await waitForResult(job, controller.signal);
        if (!controller.signal.aborted) setState({ phase: 'done', photo, resultUri });
      } catch (error) {
        if (controller.signal.aborted) return; // user closed the sheet — stay quiet
        const tryOnError =
          error instanceof TryOnError ? error : new TryOnError('UNKNOWN', 'Something went wrong. Please try again.', true);
        setState({
          phase: 'error',
          photo,
          message: tryOnError.message,
          action: isNewPhotoNeeded(tryOnError) ? 'new-photo' : tryOnError.retryable ? 'retry' : 'close',
        });
      }
    },
    [productId],
  );

  /** Pick a photo from camera or library, then run the try-on. */
  const start = useCallback(
    async (source: PhotoSource) => {
      try {
        const asset = await pickPhoto(source);
        if (asset === null) return; // user cancelled the picker
        if (asset === 'denied') {
          setState({
            phase: 'error',
            message:
              source === 'camera'
                ? 'BRB needs camera access to take your photo. You can allow it in Settings.'
                : 'BRB needs access to your photos to pick one. You can allow it in Settings.',
            action: 'open-settings',
          });
          return;
        }
        setState({ phase: 'preparing' });
        forgetPhoto(); // a new photo replaces any earlier one
        const photo = await preparePhoto(asset.uri, asset.width, asset.height);
        deleteTempPhoto(asset.uri); // the picker's full-size copy is no longer needed
        photoFileRef.current = photo.uri;
        await run(photo);
      } catch {
        setState({ phase: 'error', message: "We couldn't open that photo. Please try another one.", action: 'new-photo' });
      }
    },
    [run, forgetPhoto],
  );

  const retry = useCallback(() => {
    if (state.phase === 'error' && state.photo) void run(state.photo);
  }, [state, run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    forgetPhoto();
    setState({ phase: 'idle' });
  }, [forgetPhoto]);

  return { state, start, retry, reset };
}
