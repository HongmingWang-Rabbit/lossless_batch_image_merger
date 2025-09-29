'use client';

import { useState, useRef } from 'react';

type AlignmentMode = 'horizontal' | 'vertical' | 'grid';

interface ImageData {
  file: File;
  url: string;
  img: HTMLImageElement;
}

export default function Home() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>('horizontal');
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [resizeWidth, setResizeWidth] = useState<number | ''>('');
  const [resizeHeight, setResizeHeight] = useState<number | ''>('');
  const [alignDimension, setAlignDimension] = useState<'none' | 'width' | 'height'>('none');
  const [mergedImage, setMergedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImageData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const url = URL.createObjectURL(file);
      const img = new Image();

      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = url;
      });

      newImages.push({ file, url, img });
    }

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setMergedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const mergeImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);

    try {
      // Calculate expected canvas size
      let expectedWidth = 0;
      let expectedHeight = 0;

      if (alignmentMode === 'horizontal') {
        expectedWidth = images.reduce((sum, img) => sum + img.img.width, 0);
        expectedHeight = Math.max(...images.map(img => img.img.height));
      } else if (alignmentMode === 'vertical') {
        expectedWidth = Math.max(...images.map(img => img.img.width));
        expectedHeight = images.reduce((sum, img) => sum + img.img.height, 0);
      } else if (alignmentMode === 'grid') {
        const cellWidth = Math.max(...images.map(img => img.img.width));
        const cellHeight = Math.max(...images.map(img => img.img.height));
        expectedWidth = cellWidth * gridCols;
        expectedHeight = cellHeight * gridRows;
      }

      const expectedPixels = expectedWidth * expectedHeight;
      const MAX_CANVAS_AREA = 268435456; // 16384 x 16384
      const needsServerProcessing =
        expectedPixels > MAX_CANVAS_AREA ||
        alignDimension !== 'none' ||
        resizeWidth !== '' ||
        resizeHeight !== '';

      if (needsServerProcessing) {
        console.log('Canvas too large or special processing needed, using server-side processing...');
        await mergeImagesServer();
      } else {
        console.log('Using client-side processing for fast merge...');
        try {
          await mergeImagesClient();
        } catch (clientError) {
          console.warn('Client-side processing failed, falling back to server:', clientError);
          await mergeImagesServer();
        }
      }
    } catch (error) {
      console.error('Error merging images:', error);
      alert(`Error merging images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const mergeImagesServer = async () => {
    const formData = new FormData();
    formData.append('alignmentMode', alignmentMode);
    formData.append('gridRows', gridRows.toString());
    formData.append('gridCols', gridCols.toString());
    if (resizeWidth !== '') formData.append('resizeWidth', resizeWidth.toString());
    if (resizeHeight !== '') formData.append('resizeHeight', resizeHeight.toString());
    formData.append('alignDimension', alignDimension);

    images.forEach((img, index) => {
      formData.append(`image-${index}`, img.file);
    });

    const response = await fetch('/api/merge', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to merge images');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    console.log('Successfully merged images on server');
    setMergedImage(url);
  };

  const mergeImagesClient = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Could not get canvas context');

    let canvasWidth = 0;
    let canvasHeight = 0;

    if (alignmentMode === 'horizontal') {
      canvasWidth = images.reduce((sum, img) => sum + img.img.width, 0);
      canvasHeight = Math.max(...images.map(img => img.img.height));
    } else if (alignmentMode === 'vertical') {
      canvasWidth = Math.max(...images.map(img => img.img.width));
      canvasHeight = images.reduce((sum, img) => sum + img.img.height, 0);
    } else if (alignmentMode === 'grid') {
      const cellWidth = Math.max(...images.map(img => img.img.width));
      const cellHeight = Math.max(...images.map(img => img.img.height));
      canvasWidth = cellWidth * gridCols;
      canvasHeight = cellHeight * gridRows;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Verify canvas was created
    if (canvas.width === 0 || canvas.height === 0 || canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      throw new Error('Canvas creation failed - size too large');
    }

    if (alignmentMode === 'horizontal') {
      let xOffset = 0;
      images.forEach(({ img }) => {
        ctx.drawImage(img, xOffset, 0);
        xOffset += img.width;
      });
    } else if (alignmentMode === 'vertical') {
      let yOffset = 0;
      images.forEach(({ img }) => {
        ctx.drawImage(img, 0, yOffset);
        yOffset += img.height;
      });
    } else if (alignmentMode === 'grid') {
      const cellWidth = Math.max(...images.map(img => img.img.width));
      const cellHeight = Math.max(...images.map(img => img.img.height));
      images.forEach(({ img }, index) => {
        const row = Math.floor(index / gridCols);
        const col = index % gridCols;
        ctx.drawImage(img, col * cellWidth, row * cellHeight);
      });
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length < 100) {
      throw new Error('Canvas rendering failed');
    }

    console.log('Successfully merged images on client');
    setMergedImage(dataUrl);
  };

  const downloadMergedImage = () => {
    if (!mergedImage) return;

    const link = document.createElement('a');
    link.download = 'merged-image.png';
    link.href = mergedImage;
    link.click();
  };

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Lossless Batch Image Merger",
            "description": "Free online tool to merge multiple images into one without quality loss. Combine photos vertically, horizontally, or in a grid layout with lossless PNG output.",
            "url": "https://losslessimagemerge.com",
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "featureList": [
              "Lossless PNG image merging",
              "Batch image processing",
              "Vertical image alignment",
              "Horizontal image alignment",
              "Grid layout with custom rows and columns",
              "Image resizing with aspect ratio preservation",
              "Align images by width or height",
              "No file size limits",
              "No watermarks",
              "Client-side and server-side processing"
            ],
            "screenshot": "https://losslessimagemerge.com/screenshot.png",
            "softwareVersion": "1.0",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "5",
              "ratingCount": "1"
            }
          })
        }}
      />

      <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
            Lossless Image Merger
          </h1>

        {/* File Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Upload Images
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-900 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
          />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Selected: {images.length} image(s)
          </p>
          {images.length > 0 && (
            <button
              onClick={clearAll}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Image Preview */}
        {images.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Selected Images
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {img.img.width} × {img.img.height}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Merge Options
          </h2>

          {/* Alignment Mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Alignment Mode
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setAlignmentMode('horizontal')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  alignmentMode === 'horizontal'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Horizontal
              </button>
              <button
                onClick={() => setAlignmentMode('vertical')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  alignmentMode === 'vertical'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Vertical
              </button>
              <button
                onClick={() => setAlignmentMode('grid')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  alignmentMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Grid Options */}
          {alignmentMode === 'grid' && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">
                Grid Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-900 dark:text-white">
                    Rows
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={gridRows}
                    onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-900 dark:text-white">
                    Columns
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={gridCols}
                    onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Resize Options */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">
              Resize Options (Optional)
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Leave empty for original size. Specify one dimension to maintain aspect ratio.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1 text-gray-900 dark:text-white">
                  Width (px)
                </label>
                <input
                  type="number"
                  min="1"
                  value={resizeWidth}
                  onChange={(e) => setResizeWidth(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                  placeholder="Original"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-900 dark:text-white">
                  Height (px)
                </label>
                <input
                  type="number"
                  min="1"
                  value={resizeHeight}
                  onChange={(e) => setResizeHeight(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                  placeholder="Original"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Align dimensions */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Align All Images
              </label>
              <select
                value={alignDimension}
                onChange={(e) => setAlignDimension(e.target.value as 'none' | 'width' | 'height')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="none">None (keep original sizes)</option>
                <option value="width">Scale to largest width (maintain aspect ratio)</option>
                <option value="height">Scale to largest height (maintain aspect ratio)</option>
              </select>
            </div>
          </div>

          {/* Merge Button */}
          <button
            onClick={mergeImages}
            disabled={images.length === 0 || isProcessing}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isProcessing ? 'Processing...' : 'Merge Images (Lossless PNG)'}
          </button>
        </div>

        {/* Result Section */}
        {mergedImage && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Merged Image
            </h2>
            <div className="mb-4 overflow-auto max-h-96 bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mergedImage}
                alt="Merged result"
                className="max-w-full"
                onError={(e) => {
                  console.error('Failed to load merged image');
                  console.log('Image src length:', mergedImage?.length);
                }}
                onLoad={() => console.log('Merged image loaded successfully')}
              />
            </div>
            <button
              onClick={downloadMergedImage}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              Download Merged Image
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}