/** 对话里一次最多上传的作物照片数 */
export const MAX_IMAGES = 3;

/** 上传前压到最长边 1600px，减少视觉模型等待时间和流量 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片过大，请选择 20MB 以内的照片');
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('图片处理失败');
    return new File([blob], `${file.name.replace(/\.\w+$/, '') || 'photo'}.jpg`, {
      type: 'image/jpeg',
    });
  } catch (error) {
    // 浏览器解不了的格式（如部分 HEIC）交给后端报错，小图直接上传
    if (file.size <= 5 * 1024 * 1024) return file;
    throw new Error('图片处理失败，请换一张 JPG/PNG 照片', { cause: error });
  }
}