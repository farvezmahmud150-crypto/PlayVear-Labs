import React, { useState, useRef, useEffect } from 'react';
import { CharacterId, CHARACTERS } from '../types';
import { ClonedVoiceItem } from './VoiceCloningModal';
import { GoogleUser } from './GoogleAuthModal';
import { MoreVertical, Sparkles, ShieldCheck, Plus, User as UserIcon, LogOut, Zap, Coins } from 'lucide-react';

interface HeaderProps {
  engineMode: 'v2' | 'v3' | 'v4';
  selectedCharacter: CharacterId;
  onSelectCharacter: (char: CharacterId) => void;
  selectedClonedVoiceId: string | null;
  onSelectClonedVoiceId: (id: string) => void;
  v3Voices: ClonedVoiceItem[];
  v4Voices?: ClonedVoiceItem[];
  onOpenVoiceCloneModal: () => void;
  onOpenHistory: () => void;
  onOpenBgMusic: () => void;
  onOpenMusicGuide: () => void;
  onOpenSubtitleGuide: () => void;
  onOpenCartesiaRotator?: () => void;
  onOpenAdminPanel?: () => void;
  historyCount: number;
  activeKeyInfo?: {
    index: number;
    label: string;
    charsUsed: number;
    maxLimit: number;
  };
  hasPaidKey?: boolean;
  availableKeys?: { index: number; label: string; customVoicesCount?: number }[];
  onSwitchKey?: (keyIndex: number) => void;
  googleUser?: GoogleUser | null;
  onOpenGoogleAuth?: () => void;
  onLogout?: () => void;
  userCredit?: number;
}

export const Header: React.FC<HeaderProps> = ({
  engineMode,
  selectedCharacter,
  onSelectCharacter,
  selectedClonedVoiceId,
  onSelectClonedVoiceId,
  v3Voices,
  v4Voices = [],
  onOpenVoiceCloneModal,
  onOpenHistory,
  onOpenBgMusic,
  onOpenMusicGuide,
  onOpenSubtitleGuide,
  onOpenCartesiaRotator,
  onOpenAdminPanel,
  historyCount: _historyCount,
  activeKeyInfo: _activeKeyInfo,
  hasPaidKey: _hasPaidKey,
  availableKeys: _availableKeys = [],
  onSwitchKey: _onSwitchKey,
  googleUser,
  onOpenGoogleAuth,
  onLogout,
  userCredit = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isV2 = engineMode === 'v2';
  const isV3 = engineMode === 'v3';
  const isV4 = engineMode === 'v4';

  const v4VoiceList = v4Voices;

  const activeV2Char = CHARACTERS.find((c) => c.id === selectedCharacter) || CHARACTERS[0];
  const activeV3Char = v3Voices.find((v) => v.id === selectedClonedVoiceId) || (v3Voices.length > 0 ? v3Voices[0] : null);
  const activeV4Char = v4VoiceList.find((v) => v.id === selectedClonedVoiceId) || (v4VoiceList.length > 0 ? v4VoiceList[0] : null);

  const activeCategoryObj = CHARACTERS.find((c) => c.id === selectedCharacter) || CHARACTERS[0];

  const activeName = isV4
    ? (activeV4Char?.name?.replace(/^[💎\s]+/, '') || 'No Voice')
    : isV3
    ? (activeV3Char?.name?.replace(/^[💎\s]+/, '') || 'No Voice')
    : activeV2Char.name;

  const activeRole = isV4
    ? `${activeV4Char?.name?.replace(/^[💎\s]+/, '') || 'Voice'} • ${activeCategoryObj.name.replace(/^\d+\.\s*/, '').split('(')[0].trim()}`
    : isV3
    ? `${activeV3Char?.name?.replace(/^[💎\s]+/, '') || 'Voice'} • ${activeCategoryObj.name.replace(/^\d+\.\s*/, '').split('(')[0].trim()}`
    : activeV2Char.role;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
        setIsVoiceDropdownOpen(false);
        setIsCategoryDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsMenuOpen(false);
        setIsVoiceDropdownOpen(false);
        setIsCategoryDropdownOpen(false);
      }
    };

    const handleCloseAllMenus = () => {
      setIsOpen(false);
      setIsMenuOpen(false);
      setIsVoiceDropdownOpen(false);
      setIsCategoryDropdownOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('close-all-header-menus', handleCloseAllMenus);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('close-all-header-menus', handleCloseAllMenus);
    };
  }, []);

  const handleHistoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    onOpenHistory();
  };

  const handleBgMusicClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    onOpenBgMusic();
  };

  const handleMusicGuideClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    onOpenMusicGuide();
  };

  const handleSubtitleGuideClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    onOpenSubtitleGuide();
  };

  const renderUserProfileSection = () => {
    if (!googleUser) return null;

    const isNewAccount = userCredit <= 0;

    return (
      <div className="flex flex-col items-end leading-none mr-2 select-none pr-2 border-r border-stone-800/80">
        <span className="text-[10px] font-bold text-cyan-200 truncate max-w-[80px] sm:max-w-[100px]">
          {googleUser.name.split(' ')[0]}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] font-bold uppercase tracking-tighter text-stone-500">
            credit
          </span>
          <span className="text-[9px] font-bold font-mono text-stone-500">
            {userCredit.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  const renderThreeDotsButton = () => (
    <div ref={menuRef} className="relative flex items-center">
      {/* Moved User Info to align with 3-dots side */}
      {renderUserProfileSection()}

      <button
        id="header-options-menu-btn"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen((prev) => !prev);
        }}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label="More options"
        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
          isMenuOpen
            ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300'
            : 'bg-[#131823] hover:bg-[#1a2233] border-stone-800 hover:border-cyan-500/50 text-stone-300 hover:text-cyan-300'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* 3 Dots Menu Options */}
      {isMenuOpen && (
        <div
          id="header-options-dropdown"
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-52 bg-[#12161f] border border-stone-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col backdrop-blur-md"
        >
          {/* Sign In / Sign Out Option in 3 Dots Menu */}
          {googleUser ? (
            <button
              id="menu-option-signout"
              type="button"
              role="menuitem"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMenuOpen(false);
                onLogout?.();
              }}
              onClick={() => {
                setIsMenuOpen(false);
                onLogout?.();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 rounded cursor-pointer transition-colors flex items-center gap-2 border-b border-stone-800/80 mb-0.5 pb-2"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              id="menu-option-signin"
              type="button"
              role="menuitem"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMenuOpen(false);
                onOpenGoogleAuth?.();
              }}
              onClick={() => {
                setIsMenuOpen(false);
                onOpenGoogleAuth?.();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100 hover:bg-cyan-950/40 rounded cursor-pointer transition-colors flex items-center gap-2 border-b border-stone-800/80 mb-0.5 pb-2"
            >
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </button>
          )}

          {(onOpenAdminPanel || onOpenCartesiaRotator) && (
            <button
              id="menu-option-admin-panel"
              type="button"
              role="menuitem"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMenuOpen(false);
                (onOpenAdminPanel || onOpenCartesiaRotator)?.();
              }}
              onClick={() => {
                setIsMenuOpen(false);
                (onOpenAdminPanel || onOpenCartesiaRotator)?.();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100 hover:bg-cyan-950/40 rounded cursor-pointer transition-colors flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Admin Panel</span>
            </button>
          )}

          <button
            id="menu-option-history"
            type="button"
            role="menuitem"
            onPointerDown={handleHistoryClick}
            onClick={handleHistoryClick}
            className="w-full text-left px-3 py-2 text-xs font-medium text-stone-200 hover:text-cyan-300 hover:bg-stone-800/60 rounded cursor-pointer transition-colors border-t border-stone-800/80 mt-0.5 pt-2"
          >
            History
          </button>
          <button
            id="menu-option-bg-music"
            type="button"
            role="menuitem"
            onPointerDown={handleBgMusicClick}
            onClick={handleBgMusicClick}
            className="w-full text-left px-3 py-2 text-xs font-medium text-stone-200 hover:text-cyan-300 hover:bg-stone-800/60 rounded cursor-pointer transition-colors"
          >
            Background Music
          </button>
          <button
            id="menu-option-subtitle-guide"
            type="button"
            role="menuitem"
            onPointerDown={handleSubtitleGuideClick}
            onClick={handleSubtitleGuideClick}
            className="w-full text-left px-3 py-2 text-xs font-medium text-stone-200 hover:text-cyan-300 hover:bg-stone-800/60 rounded cursor-pointer transition-colors border-t border-stone-800/80 mt-0.5 pt-2"
          >
            Subtitle Usage Guide
          </button>
          <button
            id="menu-option-music-guide"
            type="button"
            role="menuitem"
            onPointerDown={handleMusicGuideClick}
            onClick={handleMusicGuideClick}
            className="w-full text-left px-3 py-2 text-xs font-medium text-stone-200 hover:text-cyan-300 hover:bg-stone-800/60 rounded cursor-pointer transition-colors"
          >
            Music Usage & License Guide
          </button>
        </div>
      )}
    </div>
  );

  return (
    <header
      id="main-header"
      className="w-full border-b border-stone-800/80 bg-[#0d1017]/90 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5 sm:px-6 shadow-sm"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Brand Header on left */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div id="brand-header" className="flex items-center gap-2 group cursor-default select-none pt-0.5">
            <img
              src="/playvear-brand.png"
              alt="PlayVear"
              className="h-7 sm:h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="text-xl sm:text-2xl font-black tracking-tight text-[#00f3ff] drop-shadow-[0_0_12px_rgba(0,243,255,0.8)] font-['Plus_Jakarta_Sans',sans-serif]">
              Labs
            </span>
          </div>

          <div className="sm:hidden flex items-center gap-2">
            {renderThreeDotsButton()}
          </div>
        </div>

        {/* Right Area: Dynamic Engine Character Dropdown + 3 Dots Menu on desktop */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div ref={dropdownRef} className="relative flex-1 sm:w-auto">
            {isV4 ? (
              /* Model V4: Single Dropdown with Voice Name in English and Bengali Category Subtitle below */
              <div className="relative w-full sm:w-[380px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenVoiceCloneModal();
                  }}
                  title="Clone Your Voice"
                  aria-label="Clone Your Voice"
                  className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-stone-950 font-bold flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.8)] hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/30"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (v4VoiceList.length > 0) {
                      setIsVoiceDropdownOpen(!isVoiceDropdownOpen);
                    } else {
                      onOpenVoiceCloneModal();
                    }
                    setIsCategoryDropdownOpen(false);
                  }}
                  className="w-full px-3 py-1 rounded-xl text-xs font-bold border bg-[#131823] border-cyan-500/50 text-cyan-200 hover:border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)] flex items-center justify-between gap-2 cursor-pointer transition-all"
                >
                  <div className="flex flex-col gap-0 overflow-hidden text-left">
                    <span className="truncate capitalize font-semibold text-stone-100 text-xs leading-snug">
                      {v4VoiceList.length > 0 && activeV4Char
                        ? activeV4Char.name.replace(/^[💎\s]+/, '').split(' - ')[0].trim()
                        : '+ নিজস্ব ভয়েস ক্লোন করুন'}
                    </span>
                    <span className="text-[9px] text-stone-400 truncate leading-none font-normal">
                      {v4VoiceList.length > 0 && activeV4Char
                        ? (CHARACTERS.find((c) => c.id === activeV4Char.category)?.role || activeV4Char.description || 'Model V4 Cloned Character')
                        : 'Click + to clone voice'}
                    </span>
                  </div>
                  <svg className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${isVoiceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isVoiceDropdownOpen && v4VoiceList.length > 0 && (
                  <div className="absolute left-0 top-full mt-1.5 w-full bg-[#111622] border border-cyan-500/40 rounded-xl shadow-2xl z-50 p-1 max-h-56 overflow-y-auto flex flex-col gap-0.5">
                    <div className="px-2 py-0.5 text-[10px] font-bold text-stone-400 border-b border-stone-800 flex items-center justify-between">
                      <span>Model V4 Cloned Voices</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsVoiceDropdownOpen(false);
                          onOpenVoiceCloneModal();
                        }}
                        className="text-cyan-400 hover:text-cyan-200 font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Clone</span>
                      </button>
                    </div>
                    {v4VoiceList.map((voice) => {
                      const isSelected = selectedClonedVoiceId === voice.id;
                      const cleanName = voice.name.replace(/^[💎\s]+/, '').split(' - ')[0].trim();
                      const categoryRole = CHARACTERS.find((c) => c.id === voice.category)?.role || voice.description || 'Cloned Character';
                      return (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClonedVoiceId(voice.id);
                            setIsVoiceDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded-lg transition-colors cursor-pointer flex flex-col gap-0 border ${
                            isSelected
                              ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-200 font-bold'
                              : 'bg-[#121622] hover:bg-stone-800 border-stone-800 text-stone-300 font-normal'
                          }`}
                        >
                          <span className="text-xs font-semibold truncate text-white leading-snug">{cleanName}</span>
                          <span className="text-[9px] text-stone-400 truncate leading-none">{categoryRole}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isV3 ? (
              /* Model V3: Two Dropdowns (Voice + Category) */
              <div className="flex flex-row gap-2 w-full sm:w-auto sm:min-w-[420px]">
                {/* 1. First Dropdown: Voice Selection */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (v3Voices.length > 0) {
                        setIsVoiceDropdownOpen(!isVoiceDropdownOpen);
                      }
                      setIsCategoryDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold border bg-[#131823] border-purple-500/50 text-purple-200 hover:border-purple-400 flex items-center justify-between gap-1.5 cursor-pointer transition-all"
                  >
                    <span className="truncate capitalize font-semibold">
                      {v3Voices.length > 0 && activeV3Char
                        ? activeV3Char.name.replace(/^[💎\s]+/, '').split(' - ')[0].trim()
                        : 'ভয়েস প্রিসেট'}
                    </span>
                    <svg className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${isVoiceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isVoiceDropdownOpen && v3Voices.length > 0 && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-[#111622] border border-stone-700 rounded-xl shadow-2xl z-50 p-1.5 max-h-60 overflow-y-auto flex flex-col gap-1">
                      <div className="px-2 py-1 text-[10px] font-bold text-stone-400 border-b border-stone-800">
                        Model V3 Presets
                      </div>
                      {v3Voices.map((voice) => {
                        const isSelected = selectedClonedVoiceId === voice.id;
                        const cleanName = voice.name.replace(/^[💎\s]+/, '').split(' - ')[0].trim();
                        return (
                          <button
                            key={voice.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClonedVoiceId(voice.id);
                              setIsVoiceDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-purple-500/30 text-purple-200 font-bold'
                                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                            }`}
                          >
                            <span className="truncate capitalize">{cleanName}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Second Dropdown: Output Category */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                      setIsVoiceDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold border bg-[#131823] border-purple-500/50 text-purple-200 hover:border-purple-400 flex items-center justify-between gap-1.5 cursor-pointer transition-all"
                  >
                    <span className="truncate">
                      {activeCategoryObj ? activeCategoryObj.name.replace(/^\d+\.\s*/, '').split('(')[0].trim() : 'Select Category'}
                    </span>
                    <svg className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isCategoryDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#111622] border border-stone-700 rounded-xl shadow-2xl z-50 p-1.5 max-h-64 overflow-y-auto flex flex-col gap-1">
                      <div className="px-2 py-1 text-[10px] font-bold text-stone-400 border-b border-stone-800">
                        Output Categories
                      </div>
                      {CHARACTERS.map((char) => {
                        const isSelected = char.id === selectedCharacter;
                        return (
                          <button
                            key={char.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCharacter(char.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer flex flex-col gap-0.5 border ${
                              isSelected
                                ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 font-bold'
                                : 'bg-[#121622] hover:bg-stone-800 border-stone-800 text-stone-300 font-normal'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold truncate">{char.name}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                            </div>
                            <span className="text-[9px] text-stone-400 truncate">{char.role}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* V2 Single Trigger Button */
              <>
                <button
                  id="character-dropdown-trigger"
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
                  className="w-full sm:w-auto sm:min-w-[360px] bg-[#131823] text-stone-200 px-3.5 py-2 rounded-xl border border-cyan-500/30 hover:border-cyan-400/70 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 cursor-pointer transition-all shadow-sm flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-cyan-400" />
                      <span className="text-xs font-semibold text-stone-100 tracking-wide truncate">
                        {activeName}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 border bg-cyan-950/80 text-cyan-300 border-cyan-500/30">
                        Model V2
                      </span>
                    </div>
                    <span className="text-[9px] text-stone-400 truncate leading-tight tracking-normal font-normal pl-3.5">
                      {activeRole}
                    </span>
                  </div>
                  <div className={`transition-transform duration-200 shrink-0 text-cyan-400 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div
                    id="character-dropdown-menu"
                    role="listbox"
                    className="absolute top-full mt-1.5 right-0 w-full sm:w-[460px] max-h-[75vh] overflow-y-auto bg-[#111622] border border-cyan-500/40 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-2 backdrop-blur-xl"
                  >
                    <div className="px-2.5 py-1.5 border-b border-stone-800/80 flex items-center justify-between text-[11px] font-semibold text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Model V2 Characters</span>
                      </span>
                    </div>
                    {CHARACTERS.map((char) => {
                      const isSelected = char.id === selectedCharacter;
                      return (
                        <button
                          key={char.id}
                          type="button"
                          onClick={() => {
                            onSelectCharacter(char.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-all flex flex-col gap-0.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                              : 'border-transparent hover:bg-stone-800/60 text-stone-200 hover:text-stone-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-wide text-stone-100">{char.name}</span>
                            {isSelected && (
                              <span className="font-bold text-cyan-400 uppercase tracking-wider bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30 text-[8px]">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-stone-400 leading-snug font-normal">{char.role}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          {renderThreeDotsButton()}
        </div>
      </div>
    </header>
  );
};
