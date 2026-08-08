/*
 * Export social partage.
 *
 * Ce module ne contient RIEN de nouveau: c'est le code d'export vers la
 * publication qui vivait dans `VibeFxStudio.jsx`, sorti tel quel pour que
 * l'ancien studio et le nouveau bouton « Publier » de VibeOS produisent
 * exactement la meme charge utile (memes tranches panorama, meme PNG),
 * sans duplication.
 */

export const canvasToBlob = (canvas, mimeType = 'image/png', quality = 0.92) =>
    new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });

/* Un panorama devient N slides carrousel; tout le reste, une seule image. */
export const buildSocialImages = async (exportCanvas, activeFormat) => {
    const slices = activeFormat?.id === 'pano-2' ? 2 : activeFormat?.id === 'pano-3' ? 3 : 1;
    if (slices <= 1) {
        return [{
            url: exportCanvas.toDataURL('image/png'),
            blob: await canvasToBlob(exportCanvas, 'image/png'),
            width: exportCanvas.width,
            height: exportCanvas.height,
            index: 0,
        }];
    }

    const sliceWidth = exportCanvas.width / slices;
    const slides = [];
    for (let index = 0; index < slices; index += 1) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sliceWidth;
        sliceCanvas.height = exportCanvas.height;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.drawImage(exportCanvas, index * sliceWidth, 0, sliceWidth, exportCanvas.height, 0, 0, sliceWidth, exportCanvas.height);
        slides.push({
            url: sliceCanvas.toDataURL('image/png'),
            blob: await canvasToBlob(sliceCanvas, 'image/png'),
            width: sliceCanvas.width,
            height: sliceCanvas.height,
            index,
        });
    }
    return slides;
};
