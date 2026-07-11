import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { api } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';

export type VendorMediaKind = 'image' | 'video';
export type VendorMediaSource = 'camera' | 'library';

export interface VendorMediaUploadResult {
  mediaType: VendorMediaKind;
  publicUrl: string;
  path: string;
  thumbnailUri?: string;
}

export type UploadProgressListener = (progress: number, label: string) => void;

interface UploadToken {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function extension(uri: string, fallback: string): string {
  return (uri.split('?')[0].split('.').pop() ?? fallback).toLowerCase();
}

function imageContentType(uri: string): string {
  const ext = extension(uri, 'jpg');
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function videoContentType(uri: string): string {
  const ext = extension(uri, 'mp4');
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
}

async function blobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

async function requestAsset(
  mediaType: VendorMediaKind,
  source: VendorMediaSource,
): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission is required to capture media.'
        : 'Media library permission is required to choose media.',
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: mediaType === 'image' ? ['images'] : ['videos'],
    quality: mediaType === 'image' ? 0.85 : 0.8,
    videoMaxDuration: 90,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

async function normalizeImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    {
      compress: 0.78,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  return result.uri;
}

export async function captureAndUploadVendorMedia({
  mediaType,
  source,
  onProgress,
}: {
  mediaType: VendorMediaKind;
  source: VendorMediaSource;
  onProgress?: UploadProgressListener;
}): Promise<VendorMediaUploadResult | null> {
  onProgress?.(0, 'Opening picker');
  const asset = await requestAsset(mediaType, source);
  if (!asset) return null;

  onProgress?.(20, mediaType === 'image' ? 'Downscaling image' : 'Preparing video');
  const uploadUri = mediaType === 'image' ? await normalizeImage(asset.uri) : asset.uri;
  const thumbnailUri =
    mediaType === 'video'
      ? (await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 800 })).uri
      : undefined;

  onProgress?.(45, 'Reading file');
  const blob = await blobFromUri(uploadUri);
  const contentType = mediaType === 'image' ? imageContentType(uploadUri) : videoContentType(uploadUri);
  const limit = mediaType === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (blob.size > limit) {
    throw new Error(
      mediaType === 'image'
        ? 'Images must be 5 MB or smaller after compression.'
        : 'Videos must be 50 MB or smaller.',
    );
  }

  onProgress?.(60, 'Requesting secure upload token');
  const token = await api.post<UploadToken>('/api/vendor/upload', {
    mediaType,
    contentType,
    sizeBytes: blob.size,
    fileName: asset.fileName ?? uploadUri,
  });

  onProgress?.(82, 'Uploading media');
  const { error } = await supabase.storage
    .from(token.bucket)
    .uploadToSignedUrl(token.path, token.token, blob, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  onProgress?.(100, 'Upload complete');
  return {
    mediaType,
    publicUrl: token.publicUrl,
    path: token.path,
    thumbnailUri,
  };
}
