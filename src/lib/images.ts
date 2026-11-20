const MAX_EDGE = 1400;
const OUTPUT_QUALITY = 0.72;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export interface PreparedImage {
  blob: Blob;
  mimeType: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photo could not be read."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The photo could not be processed."));
      },
      "image/jpeg",
      OUTPUT_QUALITY,
    );
  });
}

/**
 * Shrinks a receipt photo for local storage. Falls back to the original file
 * when the browser cannot decode or draw it, so a photo is never dropped
 * silently.
 */
export async function prepareReceiptImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPG, PNG or HEIC photo).");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That photo is over 15 MB. Choose a smaller image.");
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { blob: file, mimeType: file.type };
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    return { blob, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type || "image/jpeg" };
  }
}
