import { useState } from 'react';
import { FORMATS, TEMPLATES } from '../data/constants';

export const useLayoutState = () => {
    const [activeFormat, setActiveFormat] = useState(FORMATS[0]);
    const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);
    const [overlayMode, setOverlayMode] = useState('landscape');
    
    const [texts, setTexts] = useState([
        { id: 1, content: 'Vibe_fx', x: 0.5, y: 0.85, font: 'Inter', bold: true, italic: false, color: '#ffffff', tracking: 0, opacity: 100, rotate: 0, blend: 'source-over' }
    ]);
    const [assets, setAssets] = useState([]);
    const [activeTextId, setActiveTextId] = useState(null);
    const [activeAssetId, setActiveAssetId] = useState(null);

    /*
     * Marges egales par defaut: la marge exterieure vaut l'ecart entre les
     * images, sinon la composition sort dissymetrique (bord large, gouttieres
     * fines) sans que personne ne l'ait demande.
     */
    const [padding, setPadding] = useState(24);
    const [gap, setGap] = useState(24);
    const [radius, setRadius] = useState(0);
    /*
     * Fond neutre par defaut. Avant, `layoutBgBlur` demarrait a `true`: la
     * premiere photo importee etait recopiee, floutee, derriere la grille -
     * un choix esthetique impose, et la meme image se retrouvait deux fois.
     */
    const [layoutBgColor, setLayoutBgColor] = useState('#ffffff');
    const [layoutBgBlur, setLayoutBgBlur] = useState(false);
    const [layoutBgTexture, setLayoutBgTexture] = useState(15);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
    const [slotConfigs, setSlotConfigs] = useState({});

    const resetLayout = () => {
        setTexts([]);
        setAssets([]);
        setActiveTextId(null);
        setActiveAssetId(null);
        setSlotConfigs({});
        setSelectedSlotIndex(null);
    };

    return {
        activeFormat, setActiveFormat,
        activeTemplate, setActiveTemplate,
        overlayMode, setOverlayMode,
        texts, setTexts,
        assets, setAssets,
        activeTextId, setActiveTextId,
        activeAssetId, setActiveAssetId,
        padding, setPadding,
        gap, setGap,
        radius, setRadius,
        layoutBgColor, setLayoutBgColor,
        layoutBgBlur, setLayoutBgBlur,
        layoutBgTexture, setLayoutBgTexture,
        selectedSlotIndex, setSelectedSlotIndex,
        slotConfigs, setSlotConfigs,
        resetLayout
    };
};
