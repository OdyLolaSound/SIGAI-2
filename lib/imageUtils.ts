
/**
 * Compresses an image Base64 string to a target size or quality.
 * Useful for ensuring Firestore documents stay under the 1MB limit.
 */
export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Generate compressed base64
      const result = canvas.toDataURL('image/jpeg', quality);
      resolve(result);
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
};

/**
 * Checks the size of a base64 string in bytes.
 */
export const getBase64Size = (base64Str: string): number => {
  const base64Content = base64Str.split(',')[1] || base64Str;
  return Math.ceil((base64Content.length * 3) / 4);
};
