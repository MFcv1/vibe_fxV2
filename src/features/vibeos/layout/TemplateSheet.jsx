"use client";

import React, { useState } from 'react';
import { THEMED_TEMPLATE_CATEGORIES } from '../../vibefx-layout/data/themedTemplates';
import { FORMATS } from '../../vibefx-studio/data/constants';
import { Sheet, useToast } from '../primitives';
import TemplatePreviewSvg from './TemplatePreviewSvg';
import styles from './layout.module.css';

const cx = (...values) => values.filter(Boolean).join(' ');

function templateRatio(themedTpl) {
    const format = FORMATS.find((f) => f.id === themedTpl.formatId);
    return format ? format.ratio : 4 / 5;
}

/*
 * Bibliotheque des templates thematiques (~80 habillages, 17 categories).
 * Les apercus sont dessines a partir des VRAIES zones et textes du template -
 * pas des pavés de couleur (plan §5.2).
 */
export default function TemplateSheet({ open, onClose, onApply, appliedTemplateId }) {
    const [activeCategoryId, setActiveCategoryId] = useState(THEMED_TEMPLATE_CATEGORIES[0].id);
    const { push } = useToast();
    const activeCategory = THEMED_TEMPLATE_CATEGORIES.find((c) => c.id === activeCategoryId)
        || THEMED_TEMPLATE_CATEGORIES[0];

    return (
        <Sheet open={open} onClose={onClose} title="Templates prêts à poster" wide>
            <p className={styles.sheetIntro}>
                Choisis un habillage, importe tes images, ajuste les textes. Le format et la mise
                en page s&apos;appliquent automatiquement.
            </p>

            <div className={styles.templateBrowser}>
                <nav className={styles.templateCategories} aria-label="Catégories de templates">
                    {THEMED_TEMPLATE_CATEGORIES.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            className={cx(
                                styles.templateCategory,
                                category.id === activeCategoryId && styles.templateCategoryActive,
                            )}
                            onClick={() => setActiveCategoryId(category.id)}
                        >
                            {category.icon}
                            <span>{category.label}</span>
                        </button>
                    ))}
                </nav>

                <div className={styles.templateGrid}>
                    {activeCategory.templates.map((template) => {
                        const isApplied = template.id === appliedTemplateId;
                        return (
                            <button
                                key={template.id}
                                type="button"
                                className={cx(styles.templateCard, isApplied && styles.templateCardActive)}
                                onClick={() => {
                                    onApply(template);
                                    push(`Template « ${template.label} » appliqué — remplace les images.`, { tone: 'success' });
                                    onClose();
                                }}
                            >
                                <span className={styles.templateCardStage}>
                                    <TemplatePreviewSvg
                                        ratio={templateRatio(template)}
                                        zones={template.zones || null}
                                        builtinId={template.baseTemplateId || 'minimal'}
                                        texts={template.texts || []}
                                        bgColor={template.layout?.bgColor || '#1d1d22'}
                                    />
                                </span>
                                <span className={styles.templateCardLabel}>{template.label}</span>
                                {template.sub ? <span className={styles.templateCardSub}>{template.sub}</span> : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </Sheet>
    );
}
