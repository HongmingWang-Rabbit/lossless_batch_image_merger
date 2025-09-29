import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// Increase Sharp's pixel limit for large image processing
sharp.cache(false);
sharp.concurrency(1);

export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const alignmentMode = formData.get('alignmentMode') as string;
    const gridRows = parseInt(formData.get('gridRows') as string) || 2;
    const gridCols = parseInt(formData.get('gridCols') as string) || 2;
    const resizeWidth = formData.get('resizeWidth') as string;
    const resizeHeight = formData.get('resizeHeight') as string;
    const alignDimension = formData.get('alignDimension') as 'none' | 'width' | 'height';

    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image-') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    // Convert files to buffers and process with sharp
    const imageBuffers = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return Buffer.from(arrayBuffer);
      })
    );

    // First pass: get all image dimensions
    const imageDimensions = await Promise.all(
      imageBuffers.map(async (buffer) => {
        const image = sharp(buffer, {
          limitInputPixels: false,
          unlimited: true
        }).rotate();
        const metadata = await image.metadata();
        return {
          width: metadata.width!,
          height: metadata.height!,
        };
      })
    );

    // Determine target dimension for alignment
    let targetWidth: number | undefined;
    let targetHeight: number | undefined;

    if (alignDimension === 'width') {
      targetWidth = Math.max(...imageDimensions.map(d => d.width));
    } else if (alignDimension === 'height') {
      targetHeight = Math.max(...imageDimensions.map(d => d.height));
    }

    // Process images with optional resizing and alignment
    const processedImages = await Promise.all(
      imageBuffers.map(async (buffer) => {
        let image = sharp(buffer, {
          limitInputPixels: false,  // Remove input pixel limit
          unlimited: true
        });

        // Apply EXIF rotation to maintain original orientation
        image = image.rotate();

        // Apply manual resize if specified
        if (resizeWidth || resizeHeight) {
          const width = resizeWidth ? parseInt(resizeWidth) : undefined;
          const height = resizeHeight ? parseInt(resizeHeight) : undefined;

          image = image.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
        // Apply alignment resize if specified (always maintain aspect ratio)
        else if (targetWidth) {
          // Scale to match width, maintain aspect ratio
          image = image.resize(targetWidth, null, {
            fit: 'inside',
            withoutEnlargement: false,
          });
        } else if (targetHeight) {
          // Scale to match height, maintain aspect ratio
          image = image.resize(null, targetHeight, {
            fit: 'inside',
            withoutEnlargement: false,
          });
        }

        const processedBuffer = await image.png().toBuffer();
        const processedMetadata = await sharp(processedBuffer, {
          limitInputPixels: false,
          unlimited: true
        }).metadata();

        return {
          buffer: processedBuffer,
          width: processedMetadata.width!,
          height: processedMetadata.height!,
        };
      })
    );

    // Calculate canvas dimensions
    let canvasWidth = 0;
    let canvasHeight = 0;

    if (alignmentMode === 'horizontal') {
      canvasWidth = processedImages.reduce((sum, img) => sum + img.width, 0);
      canvasHeight = Math.max(...processedImages.map((img) => img.height));
    } else if (alignmentMode === 'vertical') {
      canvasWidth = Math.max(...processedImages.map((img) => img.width));
      canvasHeight = processedImages.reduce((sum, img) => sum + img.height, 0);
    } else if (alignmentMode === 'grid') {
      const cellWidth = Math.max(...processedImages.map((img) => img.width));
      const cellHeight = Math.max(...processedImages.map((img) => img.height));
      canvasWidth = cellWidth * gridCols;
      canvasHeight = cellHeight * gridRows;
    }

    // Create base canvas with transparent background
    let mergedImage = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
      limitInputPixels: false,
      unlimited: true
    });

    // Prepare composite operations
    const compositeOps: Array<{ input: Buffer; top: number; left: number }> = [];

    if (alignmentMode === 'horizontal') {
      let xOffset = 0;
      for (const img of processedImages) {
        compositeOps.push({
          input: img.buffer,
          left: xOffset,
          top: 0,
        });
        xOffset += img.width;
      }
    } else if (alignmentMode === 'vertical') {
      let yOffset = 0;
      for (const img of processedImages) {
        compositeOps.push({
          input: img.buffer,
          left: 0,
          top: yOffset,
        });
        yOffset += img.height;
      }
    } else if (alignmentMode === 'grid') {
      const cellWidth = Math.max(...processedImages.map((img) => img.width));
      const cellHeight = Math.max(...processedImages.map((img) => img.height));

      processedImages.forEach((img, index) => {
        const row = Math.floor(index / gridCols);
        const col = index % gridCols;
        compositeOps.push({
          input: img.buffer,
          left: col * cellWidth,
          top: row * cellHeight,
        });
      });
    }

    // Composite all images
    mergedImage = mergedImage.composite(compositeOps);

    // Convert to PNG buffer
    const outputBuffer = await mergedImage.png({ compressionLevel: 0 }).toBuffer();

    // Return the image as a Response with Uint8Array
    return new Response(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="merged-image.png"',
      },
    });
  } catch (error) {
    console.error('Error merging images:', error);
    return NextResponse.json(
      { error: 'Failed to merge images', details: String(error) },
      { status: 500 }
    );
  }
}