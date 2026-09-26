import type { SourceImage } from "./types";

export const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB
/** Longest edge we keep. Beyond this the extra detail is invisible in a reference print. */
export const MAX_SOURCE_DIM = 6000;

export const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif";

export class ImageLoadError extends Error {}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.replace(/[^\w\- ]+/g, "").trim() || "photo";
}

async function decodeWithImageBitmap(file: File): Promise<ImageBitmap> {
  // `from-image` applies the EXIF orientation, so phone photos are upright.
  const probe = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(probe.width, probe.height);
  if (longest <= MAX_SOURCE_DIM) return probe;

  const k = MAX_SOURCE_DIM / longest;
  const resized = await createImageBitmap(probe, {
    resizeWidth: Math.round(probe.width * k),
    resizeHeight: Math.round(probe.height * k),
    resizeQuality: "high",
    imageOrientation: "from-image",
  });
  probe.close();
  return resized;
}

function decodeWithImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageLoadError("The browser could not decode this image."));
    };
    img.src = url;
  });
}

export async function loadImageFile(file: File): Promise<SourceImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageLoadError(
      `That file is ${formatBytes(file.size)}. Please choose an image under ${formatBytes(MAX_FILE_BYTES)}.`,
    );
  }

  const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

  try {
    const bitmap = await decodeWithImageBitmap(file);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      name: baseName(file.name),
      type: file.type || "image/jpeg",
    };
  } catch {
    // Older Safari has no createImageBitmap options support; try the <img> path.
    try {
      const img = await decodeWithImgElement(file);
      return {
        bitmap: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        name: baseName(file.name),
        type: file.type || "image/jpeg",
      };
    } catch {
      throw new ImageLoadError(
        isHeic
          ? "This browser cannot open HEIC photos. On iPhone, set Camera → Formats to “Most Compatible”, or convert the file to JPEG first."
          : "That file could not be opened as an image. Try a JPEG, PNG or WebP.",
      );
    }
  }
}

export function releaseImage(src: SourceImage | null): void {
  if (src && "close" in src.bitmap && typeof src.bitmap.close === "function") {
    src.bitmap.close();
  }
}

/** First image found in a drop or paste event. */
export function pickImageFile(list: FileList | null | undefined): File | null {
  if (!list) return null;
  for (const file of Array.from(list)) {
    if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|hei[cf]|avif|gif)$/i.test(file.name)) {
      return file;
    }
  }
  return null;
}
