/**
 * Image preprocessing utilities
 * Resize and compress base64 image to reduce token cost
 */

export async function preprocessImage(base64Image: string): Promise<{
  processedBase64: string;
  originalSizeKB: number;
  processedSizeKB: number;
}> {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  
  // Decode base64 to binary to calculate size
  try {
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const originalSizeKB = Math.round(binaryData.length / 1024);
    
    // For MVP, return original image
    // TODO: Add image resizing with https://deno.land/x/imagescript
    // to resize to max 1024px and compress to 80% quality
    
    return {
      processedBase64: base64Data,
      originalSizeKB,
      processedSizeKB: originalSizeKB
    };
  } catch (error) {
    throw new Error(`Invalid base64 image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
