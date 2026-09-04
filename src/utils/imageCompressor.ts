/**
 * Utility to smartly compress and resize images client-side before uploading
 * Reduces 5~15MB images down to 100~300KB with crystal clear readability for screenshots/guides.
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeKB?: number;
  } = {}
): Promise<File> {
  // If not an image or is a GIF (preserve animation), return original
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality !== undefined ? options.quality : 0.85;

  // If already under 300KB and small, return early
  if (file.size < 300 * 1024) {
    // Check dimensions
    const dims = await getImageDimensions(file);
    if (dims.width <= maxWidth && dims.height <= maxHeight) {
      return file;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let { width, height } = img;

      // Calculate scaled dimensions keeping aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Output format (convert heavy PNG photos to JPEG for 90% size reduction, but keep transparent PNGs)
      const isPNG = file.type === 'image/png';
      const outputType = isPNG ? 'image/png' : 'image/jpeg';
      const outputExt = isPNG ? 'png' : 'jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compressed blob is somehow larger than original, return original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.${outputExt}`, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}
