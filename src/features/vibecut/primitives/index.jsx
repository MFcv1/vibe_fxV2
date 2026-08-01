"use client";

import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

export function Button({
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
        <button
            type="button"
            className={cx(styles.button, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && styles.block, className)}
            {...rest}
        >
            {icon}
            {children ? <span>{children}</span> : null}
            {iconEnd}
        </button>
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
     * contenir une action ("Appliquer a toutes"), et un bouton dans un bouton
     * est du HTML invalide - le navigateur le signale, et le clic sur l'action
     * replie aussi la section.
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
