import { useState, useCallback, useEffect } from 'react';

/**
 * useExport — Gère toute la logique d'export (modal, estimation de taille, téléchargement).
 * 
 * @param {Object} deps
 * @param {Array} deps.images - Tableau d'images chargées
 * @param {React.RefObject} deps.canvasRef - Ref du canvas principal
 * @param {Function} deps.getCanvasDimensions - Retourne { width, height }
 * @param {Function} deps.renderPipeline - Fonction de rendu canvas
 * @param {Object} deps.activeFormat - Format actif (pour panorama)
 */
export default function useExport({ images, canvasRef, getCanvasDimensions, renderPipeline, activeFormat, canExport }) {
    const [exportName, setExportName] = useState('vibefx-export');
    const [exportFormat, setExportFormat] = useState('jpg');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportQuality, setExportQuality] = useState(90);
    const [estimatedSize, setEstimatedSize] = useState(null);
    const canRenderOutput = canExport ?? images.length > 0;

    const renderExportCanvas = useCallback(() => {
        if (!canRenderOutput || !canvasRef.current) return null;
        const { width, height } = getCanvasDimensions();
        if (!width || !height) return null;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        renderPipeline(exportCanvas, width, height, false, 'high');
        return exportCanvas;
    }, [canRenderOutput, canvasRef, getCanvasDimensions, renderPipeline]);

    // --- Utilitaires internes ---
    const getMimeType = (format) => {
        if (format === 'png') return 'image/png';
        if (format === 'webp') return 'image/webp';
        return 'image/jpeg';
    };

    const getQuality = (format, quality) => {
        // WebP at 100% (1.0) quality in browsers switches to LOSSLESS mode, which causes massive file sizes.
        // We cap it at 0.99 so it remains in lossy mode and stays highly optimized compared to JPEG.
        return (format === 'webp' && quality >= 100) ? 0.99 : quality / 100;
    };

    const downloadBlob = (blob, filename) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        // Clean up: give browser time to start the download before revoking
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 10000);
    };

    // --- Estimation du poids ---
    const estimateFileSize = useCallback((format, quality) => {
        if (!canRenderOutput || !canvasRef.current || !isExportModalOpen) return;
        const tempCanvas = renderExportCanvas();
        if (!tempCanvas) return;

        const mimeType = getMimeType(format);
        const q = getQuality(format, quality);

        tempCanvas.toBlob((blob) => {
            if (blob) {
                const sizeKB = blob.size / 1024;
                if (sizeKB > 1024) {
                    setEstimatedSize((sizeKB / 1024).toFixed(2) + ' MB');
                } else {
                    setEstimatedSize(sizeKB.toFixed(0) + ' KB');
                }
            } else {
                setEstimatedSize('---');
            }
        }, mimeType, q);
    }, [canRenderOutput, canvasRef, isExportModalOpen, renderExportCanvas]);

    // Debounced recalculation when modal is open
    useEffect(() => {
        if (isExportModalOpen) {
            setEstimatedSize('Calcul...');
            const timer = setTimeout(() => {
                estimateFileSize(exportFormat, exportQuality);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isExportModalOpen, exportFormat, exportQuality, estimateFileSize]);

    // --- Ouvrir la modal ---
    const handleDownload = useCallback(() => {
        if (!canRenderOutput || !canvasRef.current) return;
        setIsExportModalOpen(true);
    }, [canRenderOutput, canvasRef]);

    // --- Export final ---
    const performExport = useCallback(() => {
        if (!canRenderOutput || !canvasRef.current) return;
        const tempCanvas = renderExportCanvas();
        if (!tempCanvas) return;
        const { width, height } = tempCanvas;
        const mimeType = getMimeType(exportFormat);
        const q = getQuality(exportFormat, exportQuality);

        // PANORAMA SPLITTING LOGIC
        if (activeFormat.id === 'pano-2' || activeFormat.id === 'pano-3') {
            const slices = activeFormat.id === 'pano-2' ? 2 : 3;
            const sliceWidth = width / slices;

            for (let i = 0; i < slices; i++) {
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = sliceWidth;
                sliceCanvas.height = height;
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCtx.drawImage(tempCanvas, i * sliceWidth, 0, sliceWidth, height, 0, 0, sliceWidth, height);

                sliceCanvas.toBlob((blob) => {
                    downloadBlob(blob, `${exportName}_slice_${i + 1}.${exportFormat}`);
                }, mimeType, q);
            }
            setIsExportModalOpen(false);
            return;
        }

        // STANDARD EXPORT
        tempCanvas.toBlob((blob) => {
            downloadBlob(blob, `${exportName}.${exportFormat}`);
            setIsExportModalOpen(false);
        }, mimeType, q);
    }, [canRenderOutput, canvasRef, renderExportCanvas, activeFormat, exportName, exportFormat, exportQuality]);

    return {
        exportName, setExportName,
        exportFormat, setExportFormat,
        isExportModalOpen, setIsExportModalOpen,
        exportQuality, setExportQuality,
        estimatedSize,
        handleDownload,
        performExport,
        renderExportCanvas,
    };
}
