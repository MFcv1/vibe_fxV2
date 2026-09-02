import { serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export const SOCIAL_FORMATS = [
  { id: "portrait", label: "Portrait", hint: "Post 4:5", width: 1080, height: 1350, ratio: 4 / 5, publishKind: "feed", icon: "Smartphone" },
  { id: "square", label: "Carre", hint: "Post 1:1", width: 1080, height: 1080, ratio: 1, publishKind: "feed", icon: "Square" },
  { id: "landscape", label: "Paysage", hint: "Post 1,91:1", width: 1080, height: 566, ratio: 1.91, publishKind: "feed", icon: "RectangleHorizontal" },
  { id: "story-reel", label: "Story / Reel", hint: "9:16", width: 1080, height: 1920, ratio: 9 / 16, publishKind: "story", supportsReel: true, icon: "PanelTop" },
  { id: "pano2", label: "Pano x2", hint: "2 slides 4:5", width: 2160, height: 1350, ratio: 8 / 5, publishKind: "carousel", slices: 2, icon: "Columns2" },
  { id: "pano3", label: "Pano x3", hint: "3 slides 4:5", width: 3240, height: 1350, ratio: 12 / 5, publishKind: "carousel", slices: 3, icon: "Columns3" },
];

export const LAYOUT_TEMPLATES = [
  { id: "standard", label: "Standard", slots: 1, icon: "Box" },
  { id: "polaroid", label: "Polaroid", slots: 1, icon: "StickyNote" },
  { id: "pip", label: "Image dans l'image", slots: 2, icon: "Layers" },
  { id: "split", label: "Double", slots: 2, icon: "SplitSquareVertical" },
  { id: "filmstrip", label: "Pellicule", slots: 3, icon: "Rows3" },
  { id: "mosaic", label: "Mosaique", slots: 3, icon: "LayoutTemplate" },
  { id: "grid4", label: "Grille", slots: 4, icon: "Grid2X2" },
  { id: "cinema", label: "Cinema", slots: 1, icon: "Maximize" },
];

export const DEFAULT_TEXT = {
  id: "brand",
  label: "Signature",
  value: "Vibe_fx Studio",
  x: 50,
  y: 87,
  size: 42,
  weight: 700,
  color: "#fff8e7",
  align: "center",
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_CAPTION_LENGTH = 2200;
export const MAX_HASHTAGS = 30;
export const MAX_MENTIONS = 20;

export const slugify = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Brouillon";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

function countMatches(text, regex) {
  return (String(text || "").match(regex) || []).length;
}

export function buildChecker({ caption, format, exportSize, textLayers }) {
  const hashtags = countMatches(caption, /(^|\s)#[\p{L}\p{N}_]+/gu);
  const mentions = countMatches(caption, /(^|\s)@[\p{L}\p{N}_.]+/gu);
  const issues = [];
  const warnings = [];

  if (format.publishKind === "feed" && (format.ratio < 4 / 5 || format.ratio > 1.91)) issues.push("Le format feed doit rester entre 4:5 et 1.91:1.");
  if (format.publishKind === "story" && (format.width !== 1080 || format.height !== 1920)) issues.push("La story doit etre en 1080 x 1920.");
  if (format.publishKind === "reel") warnings.push("Le visuel est exporte en 9:16, mais l'API Reels demande une video. Pour l'instant, publie-le comme Story ou transforme-le en MP4.");
  if (caption.length > MAX_CAPTION_LENGTH) issues.push("La description depasse 2200 caracteres.");
  if (hashtags > MAX_HASHTAGS) issues.push("Instagram limite les hashtags a 30.");
  if (mentions > MAX_MENTIONS) issues.push("Instagram limite les mentions a 20.");
  if (exportSize && exportSize > MAX_IMAGE_BYTES) issues.push("Le JPEG depasse 8 MB, il faut baisser la qualite ou simplifier le visuel.");

  textLayers.forEach((layer) => {
    if (format.publishKind === "story" && (layer.y < 10 || layer.y > 88)) {
      warnings.push(`Le texte "${layer.label}" est proche d'une zone UI Story.`);
    }
    if (format.publishKind === "feed" && layer.y > 94) {
      warnings.push(`Le texte "${layer.label}" risque d'etre coupe en preview feed.`);
    }
  });

  if (!caption.trim()) warnings.push("Aucune description n'est prevue pour Instagram/Facebook.");
  if (hashtags < 3) warnings.push("Ajoute 3 a 8 hashtags utiles pour donner du contexte.");

  return {
    score: Math.max(0, 100 - issues.length * 28 - warnings.length * 8),
    issues,
    warnings,
    hashtags,
    mentions,
  };
}

export function getCanonicalFormat(input) {
  const incoming = input || {};
  const alias = incoming.id === "story" || incoming.id === "reel" ? "story-reel" : incoming.id;
  const found = SOCIAL_FORMATS.find((item) => item.id === alias) || SOCIAL_FORMATS[0];
  return { ...found, publishKind: incoming.publishKind || (incoming.id === "reel" ? "reel" : found.publishKind) };
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getCanonicalTemplate(input) {
  const alias = input?.id === "minimal" ? "standard" : input?.id;
  return LAYOUT_TEMPLATES.find((item) => item.id === alias) || LAYOUT_TEMPLATES[0];
}

export function cleanVibeFormat(format = {}) {
  return {
    id: String(format.id || ""),
    label: String(format.label || ""),
    width: toFiniteNumber(format.w || format.width),
    height: toFiniteNumber(format.h || format.height),
    ratio: toFiniteNumber(format.ratio),
  };
}

export function cleanVibeTemplate(template = {}) {
  return {
    id: String(template.id || ""),
    label: String(template.label || ""),
    slots: toFiniteNumber(template.slots, 1),
  };
}

export function cleanTextLayer(text = {}) {
  return {
    id: String(text.id || makeId()),
    label: String(text.content || text.label || "Texte"),
    value: String(text.content || text.value || ""),
    x: toFiniteNumber(text.x, 0.5),
    y: toFiniteNumber(text.y, 0.5),
    size: toFiniteNumber(text.size, 42),
    weight: toFiniteNumber(text.weight, 700),
    color: String(text.color || "#ffffff"),
    align: String(text.align || "center"),
    font: String(text.font || "Georgia, serif"),
  };
}

export function cleanSlotConfigs(configs = {}) {
  return Object.fromEntries(
    Object.entries(configs || {}).map(([key, config]) => [
      key,
      {
        zoom: toFiniteNumber(config?.zoom, 1),
        x: toFiniteNumber(config?.x),
        y: toFiniteNumber(config?.y),
        border: toFiniteNumber(config?.border),
        blur: toFiniteNumber(config?.blur),
      },
    ])
  );
}

export function cleanPublicationLayoutDraft(layoutDraft = {}) {
  const settings = layoutDraft.settings || {};
  return {
    source: String(layoutDraft.source || "publication"),
    sourceFormat: cleanVibeFormat(layoutDraft.sourceFormat || {}),
    sourceTemplate: cleanVibeTemplate(layoutDraft.sourceTemplate || {}),
    settings: {
      overlayMode: String(settings.overlayMode || layoutDraft.overlayMode || "landscape"),
      padding: toFiniteNumber(settings.padding ?? layoutDraft.padding, 44),
      gap: toFiniteNumber(settings.gap ?? layoutDraft.gap, 16),
      radius: toFiniteNumber(settings.radius ?? layoutDraft.radius, 0),
      background: String(settings.background || layoutDraft.background || settings.layoutBgColor || "#111111"),
      layoutBgColor: String(settings.layoutBgColor || layoutDraft.background || "#111111"),
      layoutBgBlur: toFiniteNumber(settings.layoutBgBlur),
      layoutBgTexture: String(settings.layoutBgTexture || "none"),
      layoutSmoothBlur: Boolean(settings.layoutSmoothBlur),
      imagesCount: toFiniteNumber(settings.imagesCount),
    },
    textLayers: (layoutDraft.textLayers || []).map(cleanTextLayer),
    slotConfigs: cleanSlotConfigs(layoutDraft.slotConfigs || settings.slotConfigs),
  };
}

export function normalizeVibeFxDraft(payload) {
  const formatMap = {
    "insta-port": "portrait",
    "insta-sq": "square",
    "insta-land": "landscape",
    story: "story-reel",
    "pano-2": "pano2",
    "pano-3": "pano3",
  };
  const format = getCanonicalFormat({
    id: formatMap[payload?.format?.id] || payload?.format?.id,
    publishKind: payload?.format?.id === "story" ? "story" : undefined,
  });
  const template = getCanonicalTemplate({ id: payload?.template?.id });
  const socialImages = payload?.socialImages?.length
    ? payload.socialImages
    : [{ url: payload?.dataUrl, blob: payload?.blob, width: payload?.width || format.width, height: payload?.height || format.height, index: 0 }];

  return {
    renderId: makeId(),
    image: payload?.dataUrl,
    imageBlob: payload?.blob,
    socialImages,
    format: {
      id: format.id,
      label: format.label,
      width: format.width,
      height: format.height,
      publishKind: format.publishKind,
      slices: format.slices || 1,
      supportsReel: Boolean(format.supportsReel),
    },
    template: { id: template.id, label: template.label },
    caption: String(payload?.caption || ""),
    layoutDraft: {
      source: "vibefx",
      sourceFormat: cleanVibeFormat(payload?.format),
      sourceTemplate: cleanVibeTemplate(payload?.template),
      settings: {
        overlayMode: String(payload?.settings?.overlayMode || "landscape"),
        padding: toFiniteNumber(payload?.settings?.padding, 44),
        gap: toFiniteNumber(payload?.settings?.gap, 16),
        radius: toFiniteNumber(payload?.settings?.radius, 0),
        layoutBgColor: String(payload?.settings?.layoutBgColor || "#111111"),
        layoutBgBlur: toFiniteNumber(payload?.settings?.layoutBgBlur),
        layoutBgTexture: String(payload?.settings?.layoutBgTexture || "none"),
        layoutSmoothBlur: Boolean(payload?.settings?.layoutSmoothBlur),
        imagesCount: toFiniteNumber(payload?.imagesCount),
      },
      textLayers: (payload?.settings?.texts || []).map((text) => {
        const clean = cleanTextLayer(text);
        return {
          ...clean,
          x: Math.round(clean.x * 100),
          y: Math.round(clean.y * 100),
        };
      }),
      slotConfigs: cleanSlotConfigs(payload?.settings?.slotConfigs),
    },
  };
}

export function getFunctionErrorMessage(error) {
  const code = error?.code || "unknown";
  const message = error?.message || "Erreur inconnue";
  const details = error?.details ? ` Details: ${JSON.stringify(error.details)}` : "";
  return `${code}: ${message}${details}`;
}

export async function uploadPublicationBlob(storage, blob, path) {
  if (!storage) throw new Error("Firebase Storage n'est pas initialise.");
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}

export async function resolvePublicationAssets({ storage, draft, publication, format, socialImages, publicationId, uid, uploadBlob = uploadPublicationBlob, now = Date.now }) {
  if (!draft?.imageBlob) {
    if (publication?.image) {
      return {
        imageUrl: publication.image,
        socialImages: publication.socialImages || [{ url: publication.image, width: format.width, height: format.height, index: 0 }],
      };
    }
    throw new Error("Importe d'abord un visuel depuis la page Mise en page.");
  }

  const basePath = `users/${uid}/publications/${publicationId}/${now()}`;
  const imageUrl = await uploadBlob(storage, draft.imageBlob, `${basePath}-cover.jpg`);
  const uploadedSocialImages = [];
  for (const item of socialImages) {
    const blob = item.blob || draft.imageBlob;
    const url = item.blob ? await uploadBlob(storage, blob, `${basePath}-slide-${(item.index || 0) + 1}.jpg`) : imageUrl;
    uploadedSocialImages.push({ url, width: item.width || format.width, height: item.height || format.height, index: item.index || 0 });
  }
  return { imageUrl, socialImages: uploadedSocialImages };
}

export function buildPublicationData({
  publication,
  title,
  excerpt,
  content,
  caption,
  tags,
  featured,
  status,
  payload,
  initialFormat,
  publishKind,
  draft,
  checker,
  uid,
}) {
  return {
    ownerUid: publication?.ownerUid || uid,
    title: title.trim() || "Publication sans titre",
    slug: slugify(title || "publication"),
    excerpt: excerpt.trim(),
    content: content.trim(),
    caption: caption.trim(),
    tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    featured,
    status,
    publishedAt: status === "published" ? serverTimestamp() : publication?.publishedAt || null,
    image: payload.imageUrl,
    socialImages: payload.socialImages,
    format: {
      id: initialFormat.id,
      label: initialFormat.label,
      width: initialFormat.width,
      height: initialFormat.height,
      publishKind,
      slices: initialFormat.slices || payload.socialImages.length || 1,
      supportsReel: Boolean(initialFormat.supportsReel),
    },
    template: draft?.template || publication?.template || { id: "standard", label: "Standard" },
    checker,
    layoutDraft: cleanPublicationLayoutDraft(draft?.layoutDraft || publication?.layoutDraft || {}),
    platformStatus: publication?.platformStatus || {},
    updatedAt: serverTimestamp(),
  };
}
