'use client';

import React from 'react';
import {
    HomeIndicator, PhoneChrome, PhoneScreen, SCREEN_WIDTH, ScaledPhone, StatusBar,
} from './PublicationPhoneShell';
import styles from './instagramPhone.module.css';

/*
 * Instagram n'affiche pas le feed dans une boite fixe: il garde le ratio de la
 * PREMIERE image du post, borne au portrait 4:5 (0,8) et au paysage 1,91:1.
 * Un visuel hors de ces bornes (une story 9:16, un pano) est recadre par
 * Instagram, et l'apercu doit montrer ce recadrage - sinon le carre et le 4:5
 * sortent identiques ici, et differents une fois publies.
 */
const FEED_MIN_ASPECT = 4 / 5;
const FEED_MAX_ASPECT = 1.91;

function feedMediaHeight(item) {
    const width = Number(item?.width) || 0;
    const height = Number(item?.height) || 0;
    if (!width || !height) return Math.round(SCREEN_WIDTH / FEED_MIN_ASPECT);
    const aspect = Math.min(FEED_MAX_ASPECT, Math.max(FEED_MIN_ASPECT, width / height));
    return Math.round(SCREEN_WIDTH / aspect);
}

const iconProps = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2 };

function FeedIcon({ name, size = 24 }) {
    const style = { width: size, height: size };
    if (name === 'heart') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><path {...iconProps} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>;
    if (name === 'comment') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><path {...iconProps} d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.6 9.6 0 0 1-3.8-.8L3 21l1.8-4.7A8.5 8.5 0 1 1 21 11.5Z" /></svg>;
    if (name === 'send') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><path {...iconProps} d="m22 2-7.4 20-4.2-8.4L2 9.4 22 2Z" /><path {...iconProps} d="M10.4 13.6 22 2" /></svg>;
    if (name === 'bookmark') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><path {...iconProps} d="M5 3.8c0-1 .8-1.8 1.8-1.8h10.4c1 0 1.8.8 1.8 1.8V22l-7-4.4L5 22V3.8Z" /></svg>;
    if (name === 'home') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><path {...iconProps} d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg>;
    if (name === 'search') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><circle {...iconProps} cx="11" cy="11" r="7.5" /><path {...iconProps} d="m16.5 16.5 4.5 4.5" /></svg>;
    if (name === 'reels') return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><rect {...iconProps} x="3" y="3" width="18" height="18" rx="5" /><path {...iconProps} d="m8 3 4 5m3-5 4 5M3 8h18" /><path fill="currentColor" stroke="none" d="m10 12 6 3.5-6 3.5v-7Z" /></svg>;
    return <svg aria-hidden="true" style={style} viewBox="0 0 24 24"><rect {...iconProps} x="3" y="3" width="18" height="18" rx="5" /><path {...iconProps} d="M12 8v8M8 12h8" /></svg>;
}

function Avatar({ small = false }) {
    return <span className={small ? styles.avatarSmall : styles.avatar}>VF</span>;
}

function InstagramScreen({ galleryItems, name, description, hashtags }) {
    const availableItems = galleryItems.slice(0, 10);
    const [activeImageIndex, setActiveImageIndex] = React.useState(0);
    const pointerStart = React.useRef(null);
    const story = String(description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = String(name || '').trim() || 'Ton visuel VibeFX';
    const cleanedHashtags = String(hashtags || '').trim();
    const imageCount = availableItems.length;
    /* Comme sur Instagram, tout le carrousel adopte le ratio de la 1re image. */
    const mediaHeight = feedMediaHeight(availableItems[0]);
    const currentImage = availableItems[Math.min(activeImageIndex, Math.max(0, imageCount - 1))];
    const firstVisibleDot = Math.min(Math.max(0, activeImageIndex - 3), Math.max(0, imageCount - 8));
    const moveCarousel = (direction) => {
        if (imageCount < 2) return;
        setActiveImageIndex((current) => Math.min(imageCount - 1, Math.max(0, current + direction)));
    };
    const finishSwipe = (clientX) => {
        if (pointerStart.current === null) return;
        const delta = clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(delta) > 32) moveCarousel(delta < 0 ? 1 : -1);
    };

    return (
        <PhoneScreen className={styles.feedScreen}>
            <StatusBar />
            <div className={styles.instagramHeader}>
                <span className={styles.instagramWordmark}>Instagram</span>
                <div className={styles.headerIcons}><FeedIcon name="heart" /><FeedIcon name="send" /></div>
            </div>
            <div className={styles.accountRow}>
                <div className={styles.accountIdentity}><Avatar /><div><p>vibefx.studio</p><small>Créé dans VibeOS</small></div></div>
                <span className={styles.moreDots} aria-hidden="true">•••</span>
            </div>
            <div
                className={styles.mediaViewport}
                style={{ height: mediaHeight }}
                data-media-height={mediaHeight}
                onPointerDown={(event) => { pointerStart.current = event.clientX; event.currentTarget.setPointerCapture?.(event.pointerId); }}
                onPointerUp={(event) => finishSwipe(event.clientX)}
                onPointerCancel={() => { pointerStart.current = null; }}
                onWheel={(event) => { if (imageCount > 1 && Math.abs(event.deltaX) > 8) moveCarousel(event.deltaX > 0 ? 1 : -1); }}
                data-testid="instagram-preview-carousel"
            >
                {currentImage?.preview ? <img src={currentImage.preview} alt={`Visuel ${activeImageIndex + 1} de la publication Instagram`} data-preview-width={currentImage.width} data-preview-height={currentImage.height} /> : <div className={styles.emptyMedia}>Le visuel apparaîtra ici</div>}
                {imageCount > 1 ? <><div className={styles.mediaCounter}>{activeImageIndex + 1}/{imageCount}</div>{activeImageIndex > 0 ? <button type="button" aria-label="Image précédente" onPointerDown={(event) => event.stopPropagation()} onClick={() => moveCarousel(-1)} className={`${styles.mediaHit} ${styles.mediaHitLeft}`} /> : null}{activeImageIndex < imageCount - 1 ? <button type="button" aria-label="Image suivante" onPointerDown={(event) => event.stopPropagation()} onClick={() => moveCarousel(1)} className={`${styles.mediaHit} ${styles.mediaHitRight}`} /> : null}</> : null}
            </div>
            <div className={styles.actionRow}>
                <div><FeedIcon name="heart" /><FeedIcon name="comment" size={23} /><FeedIcon name="send" /></div>
                {imageCount > 1 ? <div className={styles.dotRow}>{availableItems.slice(firstVisibleDot, firstVisibleDot + 8).map((item, index) => { const itemIndex = firstVisibleDot + index; return <span key={item.id || itemIndex} data-active={itemIndex === activeImageIndex} aria-label={itemIndex === activeImageIndex ? `Image ${itemIndex + 1} sur ${imageCount}` : undefined} />; })}</div> : null}
                <FeedIcon name="bookmark" />
            </div>
            <div className={styles.captionBlock}><p><strong>vibefx.studio</strong><b>{title}</b>{story ? <span> — {story}</span> : <span className={styles.captionMuted}> — Ta légende apparaîtra ici.</span>}{cleanedHashtags ? <span className={styles.hashtags}> {cleanedHashtags}</span> : null}</p>{(story.length > 150 || cleanedHashtags.length > 35) ? <span className={styles.moreCaption}>plus</span> : null}</div>
            <div className={styles.feedFiller} aria-hidden="true" />
            <div className={styles.bottomNav}><FeedIcon name="home" /><FeedIcon name="search" /><FeedIcon name="plus" /><FeedIcon name="reels" /><Avatar small /><HomeIndicator /></div>
        </PhoneScreen>
    );
}

export default function InstagramPublicationPreview({ galleryItems = [], name = '', description = '', hashtags = '', expanded = false }) {
    return <ScaledPhone label="Aperçu Instagram sur iPhone 17 Pro" expanded={expanded}><PhoneChrome /><InstagramScreen galleryItems={galleryItems} name={name} description={description} hashtags={hashtags} /></ScaledPhone>;
}

export function InstagramStoryPreview({ item, expanded = false }) {
    return (
        <ScaledPhone label="Aperçu Instagram sur iPhone 17 Pro" expanded={expanded}>
            <PhoneChrome />
            <PhoneScreen background="#000" text="#fff" className={styles.storyScreen}>
                {item?.preview ? <img src={item.preview} alt="Aperçu de la story" data-preview-width={item.width} data-preview-height={item.height} /> : null}
                <StatusBar tone="light" />
                <div className={styles.storyBar}><i /></div>
                <div className={styles.storyHead}><Avatar /><strong>vibefx.studio</strong><small>2 h</small><span>•••</span></div>
                <div className={styles.storyBottom}><span>Envoyer un message</span><FeedIcon name="heart" /><FeedIcon name="send" /></div>
                <HomeIndicator tone="light" />
            </PhoneScreen>
        </ScaledPhone>
    );
}
