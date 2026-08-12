"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import styles from './primitives.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

const BUTTON_VARIANTS = {
    primary: styles.primary,
    secondary: styles.secondary,
    ghost: styles.ghost,
    danger: styles.danger,
};

const BUTTON_SIZES = {
    sm: styles.sizeSm,
    md: '',
    lg: styles.sizeLg,
};

/* `as` permet un bouton-lien (Link Next) sans dupliquer le style: c'est le meme
   composant que Card utilise deja. Le `type="button"` n'est pose que sur un
   vrai <button>. */
export function Button({
    as: Component = 'button',
    variant = 'secondary',
    size = 'md',
    block = false,
    icon = null,
    iconEnd = null,
    className,
    children,
    ...rest
}) {
    return (
        <Component
            {...(Component === 'button' ? { type: 'button' } : null)}
            className={cx(styles.button, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && styles.block, className)}
            {...rest}
        >
            {icon}
            {children ? <span>{children}</span> : null}
            {iconEnd}
        </Component>
    );
}

export function IconButton({ label, active = false, className, children, ...rest }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={cx(styles.iconButton, active && styles.iconButtonActive, className)}
            {...rest}
        >
            {children}
        </button>
    );
}

export function Segmented({ value, onChange, options = [], label, className }) {
    return (
        <div className={cx(styles.segmented, className)} role="tablist" aria-label={label}>
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange?.(option.value)}
                        className={cx(styles.segment, isActive && styles.segmentActive)}
                    >
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Card({ as = 'div', interactive = false, className, children, ...rest }) {
    const Component = as;
    return (
        <Component className={cx(styles.card, interactive && styles.cardInteractive, className)} {...rest}>
            {children}
        </Component>
    );
}

export function EmptyState({ icon = null, title, children, action = null, className }) {
    return (
        <div className={cx(styles.empty, className)}>
            {icon ? <span className={styles.emptyIcon}>{icon}</span> : null}
            <p className={styles.emptyTitle}>{title}</p>
            {children ? <p className={styles.emptyBody}>{children}</p> : null}
            {action ? <div className={styles.emptyAction}>{action}</div> : null}
        </div>
    );
}

export function Spinner({ label = 'Chargement' }) {
    return <span className={styles.spinner} role="status" aria-label={label} />;
}

export function Progress({ value = 0, label }) {
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div
            className={styles.progress}
            role="progressbar"
            aria-label={label}
            aria-valuenow={Math.round(clamped)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div className={styles.progressBar} style={{ width: `${clamped}%` }} />
        </div>
    );
}

export function Badge({ tone = 'neutral', icon = null, className, children }) {
    const toneClass = tone === 'accent' ? styles.badgeAccent : tone === 'warning' ? styles.badgeWarning : null;
    return (
        <span className={cx(styles.badge, toneClass, className)}>
            {icon}
            {children}
        </span>
    );
}

/*
 * Section repliable. La transition passe par `grid-template-rows: 0fr -> 1fr`,
 * ce qui anime une hauteur automatique sans la mesurer en JavaScript.
 */
export function Collapsible({ title, value = null, defaultOpen = true, children, testId }) {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();
    /*
     * `value` est rendu A COTE du bouton de repli, jamais dedans: il peut
     * contenir une action, et un bouton dans un bouton est du HTML invalide.
     */
    return (
        <section className={styles.collapsible} data-testid={testId}>
            <div className={styles.collapsibleHead}>
                <button
                    type="button"
                    className={styles.collapsibleToggle}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => setOpen((current) => !current)}
                >
                    <ChevronRight
                        size={14}
                        className={cx(styles.collapsibleChevron, open && styles.collapsibleChevronOpen)}
                    />
                    <h3 className={styles.collapsibleTitle}>{title}</h3>
                </button>
                {value ? <span className={styles.collapsibleValue}>{value}</span> : null}
            </div>
            <div id={bodyId} className={cx(styles.collapsibleBody, open && styles.collapsibleBodyOpen)}>
                <div className={styles.collapsibleInner} hidden={!open}>
                    {children}
                </div>
            </div>
        </section>
    );
}

/*
 * Slider avec label + valeur numerique. Double-clic sur le label ou la valeur:
 * retour a `defaultValue` (convention VibeOS, documentee dans le plan §3.4).
 *
 * LA POSITION DE REPOS EST ALIGNEE, et ce n'est pas cosmetique.
 *
 * Les reglages n'ont pas des bornes symetriques: « Contraste » va de 80 a 125
 * autour de 100, « Ombres » de -35 a +45 autour de 0. Avec un curseur natif, la
 * pastille se place a (valeur - min) / (max - min): deux reglages tous les deux
 * au repos se retrouvent donc a des hauteurs differentes, et on croit — a juste
 * titre — que l'un d'eux n'est pas a zero.
 *
 * On coupe donc la course en deux moities EGALES: la gauche couvre min -> repos,
 * la droite repos -> max. Toutes les pastilles au repos tombent alors sur la
 * meme verticale, sans rien perdre de la plage disponible.
 *
 * Les reglages additifs (grain, nettete, vignetage: leur repos EST le minimum)
 * gardent une pastille a gauche. C'est correct, et ca les distingue d'un coup
 * d'oeil des reglages qui vont dans les deux sens.
 *
 * `accent` colore la piste: on s'en sert pour montrer qu'un preset pilote ce
 * reglage-la.
 */
export function Slider({
    label,
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    defaultValue = null,
    neutral = null,
    accent = false,
    accentTitle = null,
    onInteractStart = null,
    onInteractEnd = null,
    formatValue = (v) => String(v),
    className,
}) {
    const inputId = useId();
    const handleReset = () => {
        if (defaultValue !== null) onChange?.(defaultValue);
    };

    /* Le pivot n'a de sens qu'a l'interieur de la course: un reglage additif
       (repos = min) reste en mapping direct. */
    const pivot = neutral === null ? defaultValue : neutral;
    const centered = pivot !== null && pivot > min && pivot < max;

    /*
     * COMMENT on recentre, et pourquoi pas autrement.
     *
     * Premiere idee, abandonnee: couper la course en deux moities egales et
     * convertir position <-> valeur. Elle marche sur le papier et casse a
     * l'usage — quand les deux cotes n'ont pas le meme nombre de crans, deux
     * positions voisines retombent sur la meme valeur, et l'arrondi renvoie la
     * pastille a sa position de depart. Le curseur se BLOQUE: le Relief refusait
     * de descendre sous -2, quelle que soit la fleche.
     *
     * Ce qu'on fait a la place: on ELARGIT la course du champ pour qu'elle soit
     * symetrique autour du repos, et on borne la valeur a la sortie. Le champ
     * reste un curseur natif de bout en bout — un cran de fleche = un cran de
     * reglage, aucune conversion, donc aucune zone morte possible. Le seul cout
     * est visible et honnete: du cote le plus court, la pastille s'arrete un peu
     * avant le bout de la piste.
     */
    const portee = centered ? Math.max(pivot - min, max - pivot) : 0;
    const borne = (v) => Math.min(max, Math.max(min, v));

    return (
        <div className={cx(styles.slider, accent && styles.sliderAccent, className)}>
            <div className={styles.sliderHead} onDoubleClick={handleReset}>
                <label className={styles.sliderLabel} htmlFor={inputId}>
                    {label}
                    {accent ? (
                        <span className={styles.sliderAccentDot} title={accentTitle || undefined} aria-hidden="true" />
                    ) : null}
                </label>
                <span className={styles.sliderValue} data-numeric>{formatValue(value)}</span>
            </div>
            <input
                id={inputId}
                type="range"
                className={styles.sliderInput}
                min={centered ? pivot - portee : min}
                max={centered ? pivot + portee : max}
                step={step}
                value={value}
                onChange={(event) => onChange?.(borne(Number(event.target.value)))}
                onPointerDown={onInteractStart || undefined}
                onPointerUp={onInteractEnd || undefined}
                onPointerCancel={onInteractEnd || undefined}
                onKeyDown={onInteractStart || undefined}
                onKeyUp={onInteractEnd || undefined}
                onBlur={onInteractEnd || undefined}
            />
        </div>
    );
}

export function TileGrid({ className, children, ...rest }) {
    return (
        <div className={cx(styles.tileGrid, className)} role="listbox" {...rest}>
            {children}
        </div>
    );
}

export function Tile({ active = false, visual = null, label, hint = null, className, ...rest }) {
    return (
        <button
            type="button"
            role="option"
            aria-selected={active}
            className={cx(styles.tile, active && styles.tileActive, className)}
            {...rest}
        >
            {visual ? <span className={styles.tileVisual} aria-hidden="true">{visual}</span> : null}
            <span className={styles.tileLabel}>{label}</span>
            {hint ? <span className={styles.tileHint}>{hint}</span> : null}
        </button>
    );
}

/*
 * Panneau lateral (desktop) / bottom sheet (mobile). Ferme sur Echap et clic
 * sur le fond. Le contenu scrolle dans `sheetBody`, jamais la page.
 */
export function Sheet({ open, onClose, title, wide = false, actions = null, children }) {
    useEffect(() => {
        if (!open) return undefined;
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className={styles.sheetBackdrop} onClick={onClose}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                className={cx(styles.sheetPanel, wide && styles.sheetPanelWide)}
                onClick={(event) => event.stopPropagation()}
            >
                <header className={styles.sheetHead}>
                    <h2 className={styles.sheetTitle}>{title}</h2>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        {actions}
                        <IconButton label="Fermer" onClick={onClose}>
                            <X size={16} />
                        </IconButton>
                    </div>
                </header>
                <div className={styles.sheetBody}>{children}</div>
            </section>
        </div>
    );
}

export function SearchField({ value, onChange, onClear, placeholder = 'Rechercher', label, loading = false, className, ...rest }) {
    return (
        <div className={cx(styles.search, className)}>
            <span className={styles.searchIcon}>
                {loading ? <Spinner label="Recherche en cours" /> : <Search size={15} />}
            </span>
            <input
                type="search"
                className={styles.searchInput}
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                aria-label={label || placeholder}
                {...rest}
            />
            {value ? (
                <span className={styles.searchClear}>
                    <IconButton label="Effacer la recherche" onClick={() => (onClear ? onClear() : onChange?.(''))}>
                        <X size={14} />
                    </IconButton>
                </span>
            ) : null}
        </div>
    );
}

/* ---------- Toasts ---------- */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback((message, { tone = 'neutral', duration = 3200 } = {}) => {
        idRef.current += 1;
        const id = idRef.current;
        setToasts((current) => [...current.slice(-2), { id, message, tone }]);
        window.setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className={styles.toastViewport} aria-live="polite">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={cx(
                            styles.toast,
                            toast.tone === 'success' && styles.toastSuccess,
                            toast.tone === 'danger' && styles.toastDanger,
                        )}
                        role="status"
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast doit etre utilise sous <ToastProvider>');
    return context;
}
