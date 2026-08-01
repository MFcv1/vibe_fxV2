/*
 * Rendu canvas des calques texte VibeCut.
 * Deplace depuis `preview/VideoPreview.jsx` (aucun changement de comportement) pour
 * que le rendu de texte soit consommable par n'importe quelle interface, ancienne
 * comme nouvelle, sans dependre d'un composant React.
 */

// Load Google Font dynamically
const loadedFonts = new Set();
export function loadGoogleFont(fontName) {
    if (typeof document === 'undefined') return;
    if (loadedFonts.has(fontName)) return;
    loadedFonts.add(fontName);
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;700;900&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
    return 1 - Math.pow(1 - clamp01(value), 3);
}

function resolvePreviewFrameRate(presetFps, sourceFpsMax, requestedFrameRate) {
    if (requestedFrameRate === 'auto') return null;
    const requested = Number(requestedFrameRate);
    if (Number.isFinite(requested) && requested > 0) return Math.min(60, Math.max(1, Math.round(requested)));
    const base = Number.isFinite(Number(presetFps)) ? Number(presetFps) : 30;
    const source = Number.isFinite(Number(sourceFpsMax)) ? Number(sourceFpsMax) : 0;
    return Math.min(60, Math.max(base, source || base));
}

function drawTrackedText(ctx, text, x, y, tracking = 0) {
    if (!tracking) {
        ctx.fillText(text, x, y);
        return;
    }
    const chars = Array.from(text);
    const widths = chars.map(char => ctx.measureText(char).width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, chars.length - 1) * tracking;
    let cursor = x - totalWidth / 2;
    ctx.textAlign = 'left';
    chars.forEach((char, index) => {
        ctx.fillText(char, cursor, y);
        cursor += widths[index] + tracking;
    });
    ctx.textAlign = 'center';
}

// Draw text overlays on canvas
export function drawTextOverlays(canvas, textOverlays, currentTime, selectedTextId) {
    if (!canvas || !textOverlays || textOverlays.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    textOverlays.forEach(text => {
        if (currentTime < text.startTime || currentTime > text.endTime) return;

        const totalDur = Math.max(0.01, text.endTime - text.startTime);
        const progress = (currentTime - text.startTime) / totalDur;

        // Animation alpha (in)
        let alpha = 1;
        const fadeLen = 0.15;
        const introProgress = clamp01(progress / fadeLen);
        const outroProgress = clamp01((progress - (1 - fadeLen)) / fadeLen);
        const introEase = easeOutCubic(introProgress);
        const outroEase = easeOutCubic(outroProgress);
        if (text.animation === 'fade' || text.animation === 'none') {
            if (text.animation === 'fade') {
                if (progress < fadeLen) alpha = introProgress;
            }
        } else if (text.animation === 'scale') {
            if (progress < fadeLen) alpha = introProgress;
        } else if (['slide-up', 'slide-down', 'reveal-up', 'wipe-mask', 'neon-scan', 'tracking-in', 'letter-pop'].includes(text.animation)) {
            if (progress < fadeLen) alpha = introProgress;
        } else if (text.animation === 'typewriter') {
            // typewriter: reveal chars progressively in first 30%
            alpha = 1;
        } else if (text.animation === 'blur-in') {
            if (progress < fadeLen) alpha = introProgress;
        }

        // Animation alpha (out)
        if (text.animationOut === 'fade' || !text.animationOut) {
            if (progress > 1 - fadeLen) alpha = Math.min(alpha, (1 - progress) / fadeLen);
        } else if (text.animationOut !== 'none' && progress > 1 - fadeLen) {
            alpha = Math.min(alpha, 1 - outroProgress);
        }

        const fontSize = Math.round((text.fontSize || 48) * (w / 1920));
        const fontWeight = text.bold ? '700' : '400';
        const fontStyle = text.italic ? 'italic' : 'normal';
        const fontFamily = text.font || 'Inter';

        loadGoogleFont(fontFamily);

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        // Animation transforms
        let px = (text.x ?? 0.5) * w;
        let py = (text.y ?? 0.5) * h;
        let scale = 1;
        let rotation = 0;
        let tracking = 0;
        let clipMask = null;
        let glitchOffset = 0;

        if (text.animation === 'scale' && progress < 0.2) {
            scale = 0.5 + easeOutCubic(progress / 0.2) * 0.5;
        }
        if (text.animation === 'slide-up' && progress < 0.15) {
            py += (1 - introEase) * fontSize * 2;
        }
        if (text.animation === 'slide-down' && progress < 0.15) {
            py -= (1 - introEase) * fontSize * 2;
        }
        if (text.animation === 'reveal-up' && progress < 0.2) {
            py += (1 - easeOutCubic(progress / 0.2)) * fontSize * 1.25;
            clipMask = { x: px - fontSize * 8, y: py - fontSize * 0.72, width: fontSize * 16, height: fontSize * 1.7 };
        }
        if (text.animation === 'wipe-mask' && progress < 0.22) {
            const reveal = easeOutCubic(progress / 0.22);
            clipMask = { x: px - fontSize * 8, y: py - fontSize, width: fontSize * 16 * reveal, height: fontSize * 2 };
        }
        if (text.animation === 'neon-scan' && progress < 0.24) {
            tracking = (1 - easeOutCubic(progress / 0.24)) * fontSize * 0.18;
        }
        if (text.animation === 'tracking-in' && progress < 0.3) {
            tracking = (1 - easeOutCubic(progress / 0.3)) * fontSize * 0.42;
        }
        if (text.animation === 'letter-pop' && progress < 0.18) {
            scale = 0.72 + easeOutCubic(progress / 0.18) * 0.28;
            rotation = (1 - easeOutCubic(progress / 0.18)) * -0.05;
        }

        if (progress > 1 - fadeLen) {
            if (text.animationOut === 'slide-up') py -= outroEase * fontSize * 2;
            if (text.animationOut === 'slide-down') py += outroEase * fontSize * 2;
            if (text.animationOut === 'scale') scale = Math.max(0.2, 1 - outroEase * 0.45);
            if (text.animationOut === 'wipe-out') {
                clipMask = { x: px - fontSize * 8, y: py - fontSize, width: fontSize * 16 * (1 - outroEase), height: fontSize * 2 };
            }
            if (text.animationOut === 'glitch-out') {
                glitchOffset = Math.sin(outroEase * Math.PI * 10) * fontSize * 0.16;
                rotation = Math.sin(outroEase * Math.PI * 6) * 0.015;
            }
        }

        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
        ctx.fillStyle = text.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = Math.round(fontSize * 0.15);
        ctx.shadowOffsetY = Math.round(fontSize * 0.05);
        if (text.animation === 'blur-in' && progress < 0.2) {
            ctx.filter = `blur(${Math.round((1 - easeOutCubic(progress / 0.2)) * 10)}px)`;
        }

        if (clipMask) {
            ctx.beginPath();
            ctx.rect(clipMask.x, clipMask.y, clipMask.width, clipMask.height);
            ctx.clip();
        }

        if (scale !== 1 || rotation !== 0) {
            ctx.translate(px, py);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            px = 0;
            py = 0;
        }

        let displayText = text.content || '';
        if (text.animation === 'typewriter' && progress < 0.3) {
            const charCount = Math.floor((progress / 0.3) * displayText.length);
            displayText = displayText.slice(0, charCount);
        }

        /*
         * Multiligne + fond/contour.
         * Les lignes sont centrees autour du point d'ancrage; le bloc de fond et
         * le contour sont dessines avant le texte pour rester lisibles sur une
         * image claire. FFmpeg reproduit le meme rendu a l'export via `box=1` et
         * `borderw`.
         */
        const lines = String(displayText).split('\n');
        const lineHeight = fontSize * 1.22;
        const blockTop = py - ((lines.length - 1) * lineHeight) / 2;
        const boxStyle = text.boxStyle === 'box' || text.boxStyle === 'outline' ? text.boxStyle : 'none';
        const boxColor = text.boxColor || '#000000';

        if (boxStyle === 'box' && lines.some(line => line.trim().length > 0)) {
            const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
            const padX = fontSize * 0.34;
            const padY = fontSize * 0.22;
            const boxWidth = widest + padX * 2 + Math.max(0, tracking) * 2;
            const boxHeight = lines.length * lineHeight + padY * 2 - (lineHeight - fontSize * 0.96);
            const radius = Math.min(fontSize * 0.28, boxHeight / 2);
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = boxColor;
            ctx.globalAlpha = ctx.globalAlpha * 0.78;
            ctx.beginPath();
            ctx.roundRect(
                px + glitchOffset - boxWidth / 2,
                blockTop - fontSize * 0.62 - padY + padY,
                boxWidth,
                boxHeight,
                radius,
            );
            ctx.fill();
            ctx.restore();
        }

        lines.forEach((line, lineIndex) => {
            const lineY = blockTop + lineIndex * lineHeight;
            if (boxStyle === 'outline') {
                ctx.save();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.strokeStyle = boxColor;
                ctx.lineWidth = Math.max(2, fontSize * 0.1);
                ctx.lineJoin = 'round';
                ctx.strokeText(line, px + glitchOffset, lineY);
                ctx.restore();
            }
            drawTrackedText(ctx, line, px + glitchOffset, lineY, tracking);
        });

        if (text.animation === 'neon-scan' && progress < 0.35) {
            const scan = easeOutCubic(progress / 0.35);
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = Math.round(fontSize * 0.5);
            ctx.strokeStyle = `rgba(0,229,255,${1 - scan})`;
            ctx.lineWidth = Math.max(2, fontSize * 0.04);
            ctx.beginPath();
            ctx.moveTo(px - fontSize * 6 + fontSize * 12 * scan, py - fontSize);
            ctx.lineTo(px - fontSize * 6 + fontSize * 12 * scan, py + fontSize);
            ctx.stroke();
            ctx.restore();
        }

        if (text.animationOut === 'glitch-out' && progress > 1 - fadeLen) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = Math.max(0, 1 - outroProgress) * 0.45;
            ctx.fillStyle = '#00e5ff';
            drawTrackedText(ctx, displayText, px - glitchOffset * 1.6, py, tracking);
            ctx.fillStyle = '#ff315f';
            drawTrackedText(ctx, displayText, px + glitchOffset * 1.6, py, tracking);
            ctx.restore();
        }

        // Selection indicator
        if (text.id === selectedTextId) {
            const selectionLines = String(text.content || '').split('\n');
            const textW = selectionLines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
            const textH = fontSize * 1.2 * selectionLines.length;
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.setLineDash([4, 4]);
            const rx = scale !== 1 ? -textW / 2 - 8 : px - textW / 2 - 8;
            const ry = scale !== 1 ? -textH / 2 - 4 : py - textH / 2 - 4;
            ctx.strokeRect(rx, ry, textW + 16, textH + 8);
            ctx.setLineDash([]);
        }

        ctx.restore();
    });
}
