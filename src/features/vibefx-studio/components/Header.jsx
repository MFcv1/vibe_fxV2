import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Camera, Sun, Moon, Zap, LayoutTemplate, Aperture, Download, Library, Film, Send, Sparkles, Music2, UserCircle } from 'lucide-react';
import SoundtrackHeaderMiniPlayer from '../soundtrack/components/SoundtrackHeaderMiniPlayer';
import { useAuth } from '@/context/AuthContext';

const ADMIN_EMAIL = 'matthis.fradin2@gmail.com';

const Header = ({ isDarkMode, setIsDarkMode, view, setView, hasImages, onReset, onExport, onImportPublication, onOpenPublications, isAiRailOpen, onToggleAiRail, aiJobActive, aiInterfacesEnabled = false, soundtrack, onOpenSoundtrack }) => {
    const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
    const { user } = useAuth();
    const isAdmin = user?.email === ADMIN_EMAIL;

    const getIcon = (name) => {
        const map = { Zap, LayoutTemplate, Aperture, Library, Music2, Film };
        const Icon = map[name];
        return Icon ? <Icon size={14} /> : null;
    };

    return (
        <header className={`vibefx-studio-header border-b backdrop-blur-md sticky top-0 z-20 shrink-0 transition-colors duration-300 ${isDarkMode ? 'border-neutral-800 bg-black/90' : 'border-gray-200 bg-white/90'}`}>
            <div className="vibefx-studio-header__inner max-w-[1920px] mx-auto px-2 sm:px-6 h-24 sm:h-14 flex flex-wrap sm:flex-nowrap items-center justify-between gap-0 sm:gap-2">
                {/* Brand — lien vers accueil */}
                <div className="vibefx-studio-header__brand order-1 flex h-12 sm:h-full items-center gap-2 sm:gap-4 min-w-0 sm:min-w-[150px] shrink">
                    <Link href="/" className="flex items-center gap-2 group" aria-label="Vibe_fx accueil">
                        <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)] group-hover:bg-indigo-500 transition-colors">
                            <Camera size={16} className="text-white" />
                        </div>
                        <h1 className="text-lg font-mono font-bold tracking-tighter uppercase hidden sm:block">Vibe<span className="text-indigo-500">_OS</span></h1>
                    </Link>
                    <div className="h-4 w-px bg-neutral-700 mx-2 hidden sm:block"></div>
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        aria-label={isDarkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
                        className={`p-1.5 transition-all duration-300 ${isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-black'}`}
                    >
                        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <SoundtrackHeaderMiniPlayer
                        controller={soundtrack}
                        onOpenSoundtrack={onOpenSoundtrack}
                    />
                </div>

                {/* Tabs de navigation centrale */}
                <div className="vibefx-studio-header__tabs order-3 sm:order-2 w-full sm:w-auto flex-none sm:flex-1 min-w-0 flex h-12 sm:h-full items-center gap-1 overflow-x-auto scrollbar-hide md:justify-center">
                    {[
                        { id: 'studio', icon: 'Zap', label: 'Studio' },
                        { id: 'layout', icon: 'LayoutTemplate', label: 'Layout' },
                        ...(aiInterfacesEnabled ? [{ id: 'library', icon: 'Library', label: 'Library' }] : []),
                        { id: 'soundtrack', icon: 'Music2', label: 'Soundtrack' },
                        { id: 'vision-pro', icon: 'Aperture', label: 'Vision' },
                        /*
                         * PHASE 7 (2026-08-01): VibeCut n'est plus une vue interne du
                         * studio, c'est une SECTION A PART, sur ses propres routes.
                         * L'onglet devient donc un vrai lien.
                         *
                         * Il etait reste un `setView` apres la suppression de l'ancien
                         * editeur: le clic changeait un etat que plus rien ne rendait,
                         * donc l'onglet ne faisait RIEN. Un bouton mort, ce que
                         * `plan.md` 4.2 interdit - et que seul l'usage a revele.
                         */
                        { id: 'video', icon: 'Film', label: 'VibeCut', href: '/video' }
                    ].map(tab => {
                        const tabClassName = `relative h-full shrink-0 flex items-center gap-2 px-3 md:px-6 text-[10px] uppercase font-mono tracking-widest transition-all duration-300 border-b-2 ${view === tab.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : tab.href ? 'border-transparent text-purple-500 hover:text-purple-400 hover:bg-purple-500/5' : 'border-transparent text-neutral-500 hover:text-white hover:bg-white/5'}`;
                        const tabContent = (
                            <>
                                {getIcon(tab.icon)} <span className="hidden md:inline">{tab.label}</span>
                                {tab.href && <span className="text-[7px] bg-purple-500/20 text-purple-400 px-1 py-px font-mono uppercase tracking-wider hidden lg:inline">New</span>}
                            </>
                        );
                        if (tab.href) {
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    aria-label={tab.label}
                                    title={tab.label}
                                    className={tabClassName}
                                    data-testid="studio-tab-vibecut"
                                >
                                    {tabContent}
                                </Link>
                            );
                        }
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id)}
                                aria-label={tab.label}
                                title={tab.label}
                                className={tabClassName}
                            >
                                {tabContent}
                            </button>
                        );
                    })}
                </div>

                {/* Actions droite */}
                <div className="vibefx-studio-header__actions order-2 sm:order-3 flex h-12 sm:h-full gap-2 sm:gap-4 min-w-0 sm:min-w-[150px] justify-end items-center shrink-0 ml-auto sm:ml-0">
                    {onToggleAiRail && (
                        <button
                            type="button"
                            onClick={onToggleAiRail}
                            data-testid="studio-ai-toggle"
                            data-active={isAiRailOpen ? 'true' : 'false'}
                            className="vf-ai-header-button"
                            aria-pressed={isAiRailOpen}
                            title="Ouvrir les agents IA"
                            style={{ visibility: hydrated ? 'visible' : 'hidden' }}
                        >
                            <Sparkles size={13} />
                            AI
                            {aiJobActive && <span className="vf-ai-header-button__badge">RUN</span>}
                        </button>
                    )}
                    {/* Mon compte */}
                    <Link
                        href="/account"
                        className={`hidden lg:flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest px-3 py-1 transition-colors duration-200 border ${isDarkMode ? 'border-neutral-800 text-neutral-500 hover:text-white hover:border-indigo-500/50' : 'border-gray-200 text-gray-500 hover:text-black'}`}
                        title="Mon compte"
                    >
                        <UserCircle size={13} />
                        <span className="hidden xl:inline">Compte</span>
                    </Link>
                    {/*
                      * Backoffice — réservé aux admins.
                      *
                      * PHASE 7: la condition portait aussi sur la vue 'video', qui
                      * n'existe plus dans le studio. Le lien était donc devenu
                      * INJOIGNABLE, et un admin n'avait plus aucune entrée vers le
                      * backoffice depuis cet en-tête. Elle ne porte plus que sur le rôle.
                      */}
                    {isAdmin && (
                        <Link href="/backoffice" className={`hidden lg:flex text-[10px] uppercase font-mono tracking-widest px-3 py-1 transition-colors duration-200 border ${isDarkMode ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:border-cyan-300/70 hover:text-white' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-400 hover:text-cyan-900'}`}>
                            Backoffice
                        </Link>
                    )}
                    <button onClick={onReset} disabled={!hasImages} className={`hidden sm:block text-[10px] uppercase font-mono tracking-widest px-3 py-1 transition-colors duration-200 disabled:opacity-30 border border-transparent hover:border-red-900/50 ${isDarkMode ? 'text-neutral-500 hover:text-red-400 hover:bg-red-950/20' : 'text-gray-500 hover:text-red-600'}`}>Reset</button>
                    {onImportPublication && (
                        <button onClick={onImportPublication} disabled={!hasImages} className="flex items-center justify-center gap-2 border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 px-2 lg:px-4 py-1.5 text-[10px] font-mono font-medium hover:bg-indigo-500 hover:text-white transition disabled:opacity-40 disabled:bg-transparent uppercase tracking-wide">
                            <Send size={14} /> Publication
                        </button>
                    )}
                    <button onClick={onExport} disabled={!hasImages} className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-3 sm:px-5 py-1.5 text-xs font-mono font-medium hover:bg-indigo-500 transition shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:shadow-none uppercase tracking-wide clip-path-polygon">
                        <Download size={14} /> <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
