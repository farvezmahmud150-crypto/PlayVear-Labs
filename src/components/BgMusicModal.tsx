import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  X,
  Music,
  Check,
  ArrowDownToLine,
  Radio,
  ChevronDown,
  Filter,
  ShieldCheck,
  Sliders,
  Sparkles,
  Loader2,
  Disc,
  AlertCircle,
} from 'lucide-react';
import { BG_MUSIC_LIST, BgMusicItem } from '../data/bgMusicData';
import { CHARACTERS } from '../types';
import {
  cacheAndGetAudioUrl,
  getTrackBlob,
  getCachedTrackIds,
} from '../services/bgmCache';
import { mixVoiceAndBgm } from '../utils/audioMixer';

interface BgMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCharacterId?: string;
  voiceAudioUrl?: string | null;
  voiceTitle?: string;
  onOpenMusicGuide?: () => void;
}

export const BgMusicModal: React.FC<BgMusicModalProps> = ({
  isOpen,
  onClose,
  defaultCharacterId,
  voiceAudioUrl,
  voiceTitle,
  onOpenMusicGuide,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    defaultCharacterId || 'attitude_boy'
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [cachedIds, setCachedIds] = useState<Set<string>>(() => getCachedTrackIds());

  // Volume sliders (0 to 1)
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [bgmVolume, setBgmVolume] = useState<number>(0.25);

  // Voice playback state in modal
  const [isVoiceSoloPlaying, setIsVoiceSoloPlaying] = useState<boolean>(false);

  // Audio mixing progress modal state
  const [isMixing, setIsMixing] = useState<boolean>(false);
  const [mixingTrackTitle, setMixingTrackTitle] = useState<string>('');
  const [mixSuccessMessage, setMixSuccessMessage] = useState<string | null>(null);
  const [mixErrorMessage, setMixErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null); // BGM audio
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null); // Voice audio
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync category if defaultCharacterId changes when opened
  useEffect(() => {
    if (defaultCharacterId && isOpen) {
      setSelectedCategory(defaultCharacterId);
    }
  }, [defaultCharacterId, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  // Sync cached IDs on open
  useEffect(() => {
    if (isOpen) {
      setCachedIds(getCachedTrackIds());
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Update volume live during playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  useEffect(() => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.volume = voiceVolume;
    }
  }, [voiceVolume]);

  // Stop audio on unmount or close
  const handleClose = () => {
    stopAllAudio();
    setIsVoiceSoloPlaying(false);
    setPlayingId(null);
    setLoadingAudioId(null);
    setIsMixing(false);
    setMixErrorMessage(null);
    onClose();
  };

  const stopAllAudio = () => {
    // Stop BGM
    if (audioRef.current) {
      audioRef.current.onerror = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // Ignore
      }
    }

    // Stop Voice
    if (voiceAudioRef.current) {
      voiceAudioRef.current.onerror = null;
      voiceAudioRef.current.ontimeupdate = null;
      voiceAudioRef.current.onended = null;
      try {
        voiceAudioRef.current.pause();
        voiceAudioRef.current.currentTime = 0;
      } catch {
        // Ignore
      }
    }
  };

  // Toggle Play Voice Solo
  const handleToggleVoiceSolo = () => {
    if (!voiceAudioUrl) return;

    if (isVoiceSoloPlaying) {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }
      setIsVoiceSoloPlaying(false);
    } else {
      // Pause BGM if playing
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // Ignore
        }
      }
      setPlayingId(null);

      if (!voiceAudioRef.current) {
        voiceAudioRef.current = new Audio(voiceAudioUrl);
      } else {
        voiceAudioRef.current.src = voiceAudioUrl;
      }

      voiceAudioRef.current.volume = voiceVolume;
      voiceAudioRef.current.currentTime = 0;
      voiceAudioRef.current.onended = () => {
        setIsVoiceSoloPlaying(false);
      };

      voiceAudioRef.current.play().catch(console.error);
      setIsVoiceSoloPlaying(true);
    }
  };

  // Synchronized Playback: Play BGM and Voice simultaneously
  const handleTogglePlay = async (item: BgMusicItem) => {
    // Stop solo voice if playing
    if (isVoiceSoloPlaying && voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      setIsVoiceSoloPlaying(false);
    }

    if (playingId === item.id) {
      // Pause both BGM and Voice
      stopAllAudio();
      setPlayingId(null);
      setLoadingAudioId(null);
      return;
    }

    try {
      setLoadingAudioId(item.id);
      stopAllAudio();

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      let audioSourceUrl = item.audioUrl;
      try {
        const { objectUrl } = await cacheAndGetAudioUrl(item.id, item.audioUrl);
        audioSourceUrl = objectUrl;
        setCachedIds((prev) => new Set(prev).add(item.id));
      } catch (cacheErr) {
        console.warn('Cache fallback for stream:', item.title, cacheErr);
        audioSourceUrl = `/api/bgm-stream?url=${encodeURIComponent(item.audioUrl)}`;
      }

      audioRef.current.src = audioSourceUrl;
      audioRef.current.volume = bgmVolume;
      audioRef.current.load();

      audioRef.current.onloadedmetadata = () => {
        setDuration(audioRef.current?.duration || 0);
      };

      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };

      audioRef.current.onended = () => {
        setPlayingId(null);
        setCurrentTime(0);
        if (voiceAudioRef.current) {
          voiceAudioRef.current.pause();
        }
      };

      audioRef.current.onerror = () => {
        setLoadingAudioId(null);
        setPlayingId(null);
      };

      // 1. Start BGM playback
      const promise = audioRef.current.play();
      playPromiseRef.current = promise;
      await promise;

      // 2. As soon as BGM is playing, play Voice simultaneously (if voice exists)!
      if (voiceAudioUrl) {
        if (!voiceAudioRef.current) {
          voiceAudioRef.current = new Audio(voiceAudioUrl);
        } else {
          voiceAudioRef.current.src = voiceAudioUrl;
        }

        voiceAudioRef.current.volume = voiceVolume;
        voiceAudioRef.current.currentTime = 0;
        voiceAudioRef.current.onended = () => {
          // Voice ended
        };
        voiceAudioRef.current.play().catch(console.error);
      }

      setLoadingAudioId(null);
      setPlayingId(item.id);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
        console.warn('Playback notice:', err);
      }
      setLoadingAudioId(null);
      setPlayingId(null);
    } finally {
      playPromiseRef.current = null;
    }
  };

  // Download raw BGM track
  const handleDownloadMp3 = async (item: BgMusicItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(item.id);
      const blob = await getTrackBlob(item.id, item.audioUrl);
      setCachedIds((prev) => new Set(prev).add(item.id));

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40);
      link.download = `PlayVear_BGM_${cleanName}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 5000);

      setDownloadingId(null);
      setDownloadSuccessId(item.id);
      setTimeout(() => setDownloadSuccessId(null), 2500);
    } catch (err) {
      console.error('Download error:', err);
      const cleanName = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40);
      const link = document.createElement('a');
      link.href = `/api/bgm-stream?url=${encodeURIComponent(
        item.audioUrl
      )}&download=1&filename=PlayVear_BGM_${cleanName}.mp3`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadingId(null);
    }
  };

  // Mix Voice + BGM & Export Final Mixed WAV
  const handleMixAndDownload = async (item: BgMusicItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!voiceAudioUrl) {
      setMixErrorMessage('Please generate or select a voice first before mixing.');
      return;
    }

    try {
      stopAllAudio();
      setPlayingId(null);
      setIsMixing(true);
      setMixingTrackTitle(item.title);
      setMixErrorMessage(null);

      // Attempt to load track blob from memory cache or server proxy
      let bgmInput: string | Blob = item.audioUrl;
      try {
        bgmInput = await getTrackBlob(item.id, item.audioUrl);
      } catch (blobErr) {
        console.warn('[Mixer] getTrackBlob fallback to direct/proxied stream:', blobErr);
      }

      const mixedBlob = await mixVoiceAndBgm(
        voiceAudioUrl,
        bgmInput,
        bgmVolume,
        voiceVolume
      );

      const blobUrl = URL.createObjectURL(mixedBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanBgm = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 30);
      link.download = `PlayVear_Mixed_Voice_${cleanBgm}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      setMixSuccessMessage(`Successfully mixed with "${item.title}"!`);
      setTimeout(() => setMixSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Audio mix error:', err);
      setMixErrorMessage('Failed to mix audio. Please check network connection and try again.');
      setTimeout(() => setMixErrorMessage(null), 5000);
    } finally {
      setIsMixing(false);
    }
  };

  // Filter items by category
  const filteredItems = useMemo(() => {
    return selectedCategory === 'all'
      ? BG_MUSIC_LIST
      : BG_MUSIC_LIST.filter((item) => item.characterId === selectedCategory);
  }, [selectedCategory]);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  const getEnglishCharName = (charId: string) => {
    const char = CHARACTERS.find((c) => c.id === charId);
    if (!char) return 'Select Character';
    return char.name.replace(/\s*\([^)]*[\u0980-\u09FF][^)]*\)/g, '').trim();
  };

  return (
    <div
      id="bg-music-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={handleClose}
    >
      <div
        id="bg-music-modal-container"
        className="w-full max-w-4xl bg-[#0f141f] border border-stone-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-stone-800 bg-[#131926]">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-sm sm:text-base font-semibold text-stone-100 flex items-center gap-2">
              <Music className="w-4 h-4 text-cyan-400" />
              <span>Background Music Studio</span>
            </h3>
            {onOpenMusicGuide && (
              <button
                id="bgm-modal-open-guide-btn"
                type="button"
                onClick={onOpenMusicGuide}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
                title="View Copyright & License Guide"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Usage & License Guide</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onOpenMusicGuide && (
              <button
                id="bgm-modal-open-guide-btn-mobile"
                type="button"
                onClick={onOpenMusicGuide}
                className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-semibold transition-all cursor-pointer"
                title="View Copyright & License Guide"
              >
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>Guide</span>
              </button>
            )}
            <button
              id="close-bg-music-modal-btn"
              type="button"
              onClick={handleClose}
              aria-label="Close background music modal"
              className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voice Preview & Volume Control Section (if Voice is selected) */}
        {voiceAudioUrl && (
          <div className="px-4 sm:px-5 py-3 bg-[#0d121c] border-b border-stone-800/80 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={handleToggleVoiceSolo}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 border ${
                    isVoiceSoloPlaying
                      ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]'
                      : 'bg-[#182030] text-cyan-400 border-cyan-500/30 hover:border-cyan-400'
                  }`}
                  title={isVoiceSoloPlaying ? 'Pause Voice' : 'Preview Voice Only'}
                >
                  {isVoiceSoloPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-cyan-300 truncate block">
                    Voice to Mix: {voiceTitle || getEnglishCharName(defaultCharacterId || '')}
                  </span>
                  <span className="text-[10px] text-stone-400 block">
                    Play any BGM below to hear synchronized live preview
                  </span>
                </div>
              </div>

              {playingId && (
                <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full animate-pulse">
                  Live Synchronized
                </div>
              )}
            </div>

            {/* Linear Volume Adjustment Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-stone-800/50">
              {/* Voice Volume */}
              <div className="flex items-center gap-2 bg-[#121824] px-3 py-1.5 rounded-xl border border-stone-800">
                <Volume2 className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                <span className="text-[11px] text-stone-300 font-medium shrink-0 w-20">
                  Voice: {Math.round(voiceVolume * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                />
              </div>

              {/* BGM Volume */}
              <div className="flex items-center gap-2 bg-[#121824] px-3 py-1.5 rounded-xl border border-stone-800">
                <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] text-stone-300 font-medium shrink-0 w-20">
                  BGM: {Math.round(bgmVolume * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Character Selection Custom Dropdown */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-stone-800/90 bg-[#0d111a] flex items-center gap-2.5 relative z-20">
          <label
            id="bgm-character-label"
            className="text-xs font-semibold text-stone-300 flex items-center gap-1.5 shrink-0"
          >
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Character:</span>
          </label>

          <div ref={dropdownRef} className="relative flex-1">
            <button
              id="bgm-character-dropdown-btn"
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="w-full px-3 py-1.5 bg-[#131926] hover:bg-[#172032] focus:bg-[#172032] border border-stone-700/80 hover:border-cyan-500/50 focus:border-cyan-400 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer shadow-inner"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-[11px] font-medium text-stone-100 truncate">
                  {selectedCategory === 'all'
                    ? '🎵 All Tracks (150 Tracks)'
                    : getEnglishCharName(selectedCategory)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-cyan-400">
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-cyan-300' : ''
                  }`}
                />
              </div>
            </button>

            {isDropdownOpen && (
              <div
                id="bgm-character-dropdown-menu"
                className="absolute top-full left-0 right-0 mt-1 bg-[#121826] border border-stone-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto p-1 z-50 scrollbar-thin animate-fadeIn"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer mb-1 ${
                    selectedCategory === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'hover:bg-[#192236] text-stone-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-stone-100 flex items-center gap-1.5">
                      <span>🎵 All Tracks (150 Tracks)</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded ml-2 shrink-0">
                    150 Tracks
                  </span>
                </button>

                <div className="h-px bg-stone-800 my-1" />

                {CHARACTERS.map((char) => {
                  const trackCount = BG_MUSIC_LIST.filter((m) => m.characterId === char.id).length;
                  if (trackCount === 0) return null;
                  const isSelected = selectedCategory === char.id;
                  const englishName = char.name.replace(/\s*\([^)]*[\u0980-\u09FF][^)]*\)/g, '').trim();

                  return (
                    <button
                      key={char.id}
                      id={`dropdown-opt-${char.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(char.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer my-0.5 ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-[#192236] text-stone-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div
                          className={`text-[11px] font-semibold truncate ${
                            isSelected ? 'text-cyan-300 font-bold' : 'text-stone-100'
                          }`}
                        >
                          {englishName}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                          {trackCount} Tracks
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Success Toast Banner */}
        {mixSuccessMessage && (
          <div className="px-4 py-2 bg-emerald-950/90 border-b border-emerald-500/50 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{mixSuccessMessage}</span>
          </div>
        )}

        {/* Error Toast Banner */}
        {mixErrorMessage && (
          <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-500/50 text-rose-300 text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{mixErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setMixErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Playing Bar */}
        {playingId && (
          <div className="px-4 sm:px-5 py-2 bg-gradient-to-r from-cyan-950/70 via-[#101928] to-purple-950/50 border-b border-cyan-500/30 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2.5 truncate min-w-0">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
              <span className="text-cyan-300 font-semibold truncate">
                Playing: {BG_MUSIC_LIST.find((m) => m.id === playingId)?.title}
                {voiceAudioUrl ? ' (Voice Synchronized)' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div
                className="flex items-end gap-[3px] h-5 px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/40 rounded-md shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                title="Playing music..."
              >
                <span className="w-1 bg-gradient-to-t from-cyan-500 to-cyan-300 rounded-full animate-music-bar-1" />
                <span className="w-1 bg-gradient-to-t from-cyan-400 to-teal-200 rounded-full animate-music-bar-2" />
                <span className="w-1 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-full animate-music-bar-3" />
              </div>

              <div className="text-stone-300 font-mono text-[11px] shrink-0 font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        )}

        {/* Compact List Header */}
        <div className="hidden sm:flex items-center justify-between px-5 py-1.5 bg-[#0b0e16] border-b border-stone-800/80 text-[11px] font-semibold text-stone-400 uppercase tracking-wider select-none">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-6 text-center">#</span>
            <span className="w-7 text-center">Play</span>
            <span>Title & Mood</span>
          </div>
          <div className="flex items-center gap-6 pr-1">
            <span className="w-14 text-center">Duration</span>
            <span className="w-32 text-right">Actions</span>
          </div>
        </div>

        {/* Compact Music List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 flex flex-col gap-1.5 scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs sm:text-sm">
              No background music tracks found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isPlaying = playingId === item.id;
              const isLoading = loadingAudioId === item.id;
              const isDownloading = downloadingId === item.id;
              const isSuccess = downloadSuccessId === item.id;
              const isCached = cachedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  id={`bgm-item-${item.id}`}
                  className={`px-3 py-2 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                    isPlaying
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                      : 'bg-[#121723] hover:bg-[#161e2e] border-stone-800/70 hover:border-stone-700'
                  }`}
                >
                  {/* Left: Index + Play button + Title/Mood */}
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <span className="hidden sm:inline-block w-5 text-center text-xs font-mono text-stone-400 shrink-0 font-medium">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>

                    <div className="relative shrink-0 flex items-center justify-center">
                      <button
                        id={`play-bgm-${item.id}`}
                        type="button"
                        onClick={() => handleTogglePlay(item)}
                        aria-label={isPlaying ? 'Pause music' : 'Play music'}
                        disabled={isLoading}
                        title={
                          isCached
                            ? 'Cached locally (Instant play)'
                            : 'Play track (Synchronized with voice)'
                        }
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 border ${
                          isPlaying
                            ? 'bg-cyan-500 text-stone-950 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                            : 'bg-[#182030] text-cyan-400 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20'
                        }`}
                      >
                        {isLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>

                      {isCached && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#121723] shadow-[0_0_4px_rgba(239,68,68,1)] pointer-events-none ring-[0.5px] ring-red-400 animate-pulse"
                          title="Cached in local storage — Instant play"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                      <span
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isPlaying ? 'text-cyan-300 font-bold' : 'text-stone-100'
                        }`}
                        title={item.title}
                      >
                        {item.title}
                      </span>

                      {isPlaying && (
                        <span
                          className="inline-flex items-end gap-0.5 h-3.5 px-1 py-0.5 bg-cyan-950/70 border border-cyan-500/40 rounded shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                          title="Playing..."
                        >
                          <span className="w-0.5 bg-cyan-400 rounded-full animate-music-bar-1" />
                          <span className="w-0.5 bg-cyan-300 rounded-full animate-music-bar-2" />
                          <span className="w-0.5 bg-emerald-400 rounded-full animate-music-bar-3" />
                        </span>
                      )}

                      <span className="text-[10px] text-stone-400 bg-stone-800/80 px-1.5 py-0.5 rounded shrink-0 hidden md:inline-block truncate max-w-[140px]">
                        {item.mood}
                      </span>
                    </div>
                  </div>

                  {/* Right: Duration + Download / Mix Action Buttons */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-[11px] text-stone-400 font-mono shrink-0 w-11 text-right">
                      {item.duration}
                    </span>

                    {/* Mix & Export MP3 Button (when Voice is present) */}
                    {voiceAudioUrl && (
                      <button
                        id={`mix-bgm-${item.id}`}
                        type="button"
                        onClick={(e) => handleMixAndDownload(item, e)}
                        title="Mix voice with this background music"
                        className="px-2.5 py-1 sm:py-1.5 bg-gradient-to-r from-fuchsia-600/90 to-cyan-600/90 hover:from-fuchsia-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border border-fuchsia-400/30 shadow-sm shrink-0 active:scale-95"
                      >
                        <Disc className="w-3.5 h-3.5 text-cyan-200" />
                        <span className="text-[11px] font-bold">Mix</span>
                      </button>
                    )}

                    {/* Download Raw BGM Button */}
                    <button
                      id={`download-bgm-${item.id}`}
                      type="button"
                      disabled={isDownloading}
                      onClick={(e) => handleDownloadMp3(item, e)}
                      title="Download raw BGM track"
                      className={`px-2 py-1 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                        isSuccess
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-[#182030] hover:bg-cyan-500/20 border-stone-700/80 hover:border-cyan-500/50 text-stone-200 hover:text-cyan-300'
                      }`}
                    >
                      {isDownloading ? (
                        <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      ) : isSuccess ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownToLine className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* AUDIO MIXING POPUP NOTIFICATION MODAL */}
        {isMixing && (
          <div
            id="mixing-popup-loader"
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          >
            <div className="w-full max-w-sm bg-[#121826] border border-cyan-500/50 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-zoomIn">
              <div className="w-14 h-14 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-100 mb-1 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Mixing Audio Tracks...</span>
                </h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Merging voice with "<strong className="text-cyan-300">{mixingTrackTitle}</strong>". Please wait a moment...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
