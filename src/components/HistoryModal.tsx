import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HistoryVoiceItem, downloadVoiceMP3 } from '../services/historyStorage';
import {
  X,
  Play,
  Pause,
  Download,
  Trash2,
  HardDrive,
  Clock,
  RotateCcw,
  Check,
  FileText,
  Volume2,
  Search,
  Sparkles,
  AlertTriangle,
  Music,
} from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: HistoryVoiceItem[];
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onSelectScript?: (script: string) => void;
  onOpenMixMusic?: (item: HistoryVoiceItem) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  historyItems,
  onDeleteItem,
  onClearAll,
  onSelectScript,
  onOpenMixMusic,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Stop audio and cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (audioRef.current) audioRef.current.pause();
            })
            .catch(() => {});
        } else {
          try {
            audioRef.current.pause();
          } catch {
            // Ignore
          }
        }
      }
      setPlayingId(null);
      setShowClearConfirmModal(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      if (audioRef.current) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (audioRef.current) audioRef.current.pause();
            })
            .catch(() => {});
        } else {
          try {
            audioRef.current.pause();
          } catch {
            // Ignore
          }
        }
      }
    };
  }, []);

  // Listen to Escape key or custom back event to close modal / clear confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showClearConfirmModal) {
          setShowClearConfirmModal(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    const handleCloseConfirmEvent = () => {
      setShowClearConfirmModal(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('close-clear-confirm-modal', handleCloseConfirmEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('close-clear-confirm-modal', handleCloseConfirmEvent);
    };
  }, [isOpen, onClose, showClearConfirmModal]);

  if (!isOpen) return null;

  const handlePlayToggle = (item: HistoryVoiceItem) => {
    if (playingId === item.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          const promise = audioRef.current.play();
          playPromiseRef.current = promise;
          promise.catch((err) => {
            if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
              console.error(err);
            }
          });
        } else {
          if (playPromiseRef.current) {
            playPromiseRef.current
              .then(() => {
                if (audioRef.current) audioRef.current.pause();
              })
              .catch(() => {});
          } else {
            try {
              audioRef.current.pause();
            } catch {
              // Ignore
            }
          }
          setPlayingId(null);
        }
      }
      return;
    }

    // Clean up previous blob url
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
    }

    try {
      const byteCharacters = atob(item.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: item.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      activeUrlRef.current = url;

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      if (!audioRef.current.paused) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (audioRef.current) audioRef.current.pause();
            })
            .catch(() => {});
        } else {
          try {
            audioRef.current.pause();
          } catch {
            // Ignore
          }
        }
      }

      audioRef.current.src = url;
      audioRef.current.currentTime = 0;
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          setDuration(audioRef.current.duration || 0);
        }
      };
      audioRef.current.onended = () => {
        setPlayingId(null);
        setCurrentTime(0);
      };

      const promise = audioRef.current.play();
      playPromiseRef.current = promise;
      promise.catch((err) => {
        if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
          console.error('Failed to play audio from history:', err);
        }
      });
      setPlayingId(item.id);
    } catch (err) {
      console.error('Failed to play audio from history:', err);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyScript = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getCharacterBadgeStyle = (charId: string) => {
    switch (charId) {
      case 'news_anchor':
        return 'bg-red-950/80 border-red-500/50 text-red-300';
      case 'reviewer':
        return 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300';
      case 'caster':
        return 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300';
      case 'bounty':
        return 'bg-amber-950/70 border-amber-500/40 text-amber-300';
      case 'mystery_teller':
        return 'bg-teal-950/70 border-teal-500/40 text-teal-300';
      case 'nature_poet':
        return 'bg-lime-950/70 border-lime-500/40 text-lime-300';
      case 'horror_thriller':
        return 'bg-purple-950/80 border-purple-500/50 text-purple-300';
      case 'geopolitics_analyst':
        return 'bg-slate-900 border-slate-500/50 text-slate-200';
      case 'village_food':
        return 'bg-yellow-950/70 border-yellow-500/40 text-yellow-300';
      case 'islamic_storyteller':
        return 'bg-emerald-950/80 border-emerald-400/50 text-emerald-200';
      case 'hype_streamer':
        return 'bg-rose-950/70 border-rose-500/40 text-rose-300';
      case 'pro_analyst':
        return 'bg-blue-950/70 border-blue-500/40 text-blue-300';
      case 'comic_roaster':
        return 'bg-purple-950/70 border-purple-500/40 text-purple-300';
      case 'election_campaigner':
        return 'bg-orange-950/80 border-orange-500/50 text-orange-300';
      case 'vear':
        return 'bg-pink-950/80 border-pink-500/50 text-pink-300';
      default:
        return 'bg-stone-800 border-stone-600 text-stone-300';
    }
  };

  const filteredItems = searchQuery.trim()
    ? historyItems.filter(
        (item) =>
          item.script.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.characterName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : historyItems;

  const modalElement = (
    <div
      id="history-modal-backdrop"
      style={{ zIndex: 99999 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden animate-in fade-in duration-200"
    >
      {/* FULLSCREEN MODAL CONTAINER */}
      <div
        id="history-modal-content"
        className="w-full h-full max-w-6xl mx-auto flex flex-col bg-[#0b0e14] border-x border-stone-800/80 text-stone-100 shadow-2xl overflow-hidden relative"
      >
        {/* Fullscreen Header Bar */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-stone-800/90 bg-[#10141d]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-stone-100 tracking-tight">
                  Voice History
                </h2>
                <span className="text-xs font-bold bg-cyan-950 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                  {historyItems.length} {historyItems.length === 1 ? 'Voice' : 'Voices'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Saved locally in device storage</span>
              </div>
            </div>
          </div>

          {/* Search bar & Controls */}
          <div className="flex items-center gap-3">
            {historyItems.length > 0 && (
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search script or character..."
                  className="w-full bg-[#161c28] text-xs text-stone-200 placeholder-stone-500 pl-9 pr-3 py-2 rounded-xl border border-stone-800 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all"
                />
              </div>
            )}

            {/* Pure small text with NO background: "Clear all" */}
            {historyItems.length > 0 && (
              <button
                id="clear-all-text-btn"
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="text-[11px] font-normal text-stone-400 hover:text-rose-400 hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0 shrink-0"
              >
                Clear all
              </button>
            )}

            {/* Fullscreen Close Button */}
            <button
              id="close-history-modal-btn"
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-stone-400 hover:text-white bg-[#161c28] hover:bg-stone-800 border border-stone-800 rounded-xl transition-all cursor-pointer shadow-sm hover:border-stone-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fullscreen Body / History List Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {historyItems.length === 0 ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-[#141a24] border border-stone-800 flex items-center justify-center text-stone-500 mb-4 shadow-inner">
                <Volume2 className="w-8 h-8 text-cyan-500/60" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-200 mb-1.5">
                No Voice History Yet
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 max-w-md leading-relaxed">
                Generated audio files are automatically saved to your device's local storage. They will appear here for playback and download anytime.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-sm">
              No matching voice history found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const isPlaying = playingId === item.id;
                const isExpanded = expandedId === item.id;
                const isScriptLong = item.script.length > 180;
                const displayText =
                  isExpanded || !isScriptLong
                    ? item.script
                    : item.script.slice(0, 180) + '...';

                return (
                  <div
                    key={item.id}
                    id={`history-item-${item.id}`}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isPlaying
                        ? 'bg-[#121a28] border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                        : 'bg-[#10141d] border-stone-800/90 hover:border-stone-700/90 hover:bg-[#131823]'
                    }`}
                  >
                    {/* Item Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-lg border ${getCharacterBadgeStyle(
                              item.character
                            )}`}
                          >
                            {item.characterName}
                          </span>
                          <span className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-stone-500" />
                            {item.formattedDate}
                          </span>
                        </div>

                        {/* Top Actions: Load Script, Copy, Delete */}
                        <div className="flex items-center gap-1">
                          {onSelectScript && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectScript(item.script);
                                onClose();
                              }}
                              className="p-1.5 text-stone-400 hover:text-cyan-300 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
                              title="Load script into editor"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyScript(item.id, item.script)}
                            className="p-1.5 text-stone-400 hover:text-cyan-300 hover:bg-stone-800/80 rounded-lg transition-colors cursor-pointer"
                            title="Copy script text"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (playingId === item.id && audioRef.current) {
                                audioRef.current.pause();
                                setPlayingId(null);
                              }
                              onDeleteItem(item.id);
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete from device storage"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Script Excerpt */}
                      <div className="text-xs sm:text-sm text-stone-200 leading-relaxed bg-[#080b10] p-3 rounded-xl border border-stone-800/70">
                        <p className="whitespace-pre-wrap select-text">{displayText}</p>
                        {isScriptLong && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline mt-1.5 font-medium cursor-pointer"
                          >
                            {isExpanded ? '▲ Show less' : '▼ Show full text'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Full Player Bar for each item */}
                    <div className="flex items-center gap-3 bg-[#151c2a] px-3.5 py-2.5 rounded-xl border border-stone-800/80 mt-1">
                      <button
                        type="button"
                        onClick={() => handlePlayToggle(item)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.6)] scale-105'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        }`}
                        title={isPlaying ? 'Pause' : 'Play Voice'}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Scrubber & Time */}
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono">
                          <span>{isPlaying ? formatTime(currentTime) : '0:00'}</span>
                          <span>{isPlaying && duration ? formatTime(duration) : 'Voice'}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={isPlaying && duration ? duration : 100}
                          step="0.01"
                          value={isPlaying ? currentTime : 0}
                          onChange={isPlaying ? handleSeek : undefined}
                          disabled={!isPlaying}
                          className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40 disabled:cursor-default"
                        />
                      </div>

                      {/* Direct Download MP3 & Mix Music */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenMixMusic && (
                          <button
                            type="button"
                            onClick={() => {
                              if (playingId === item.id && audioRef.current) {
                                audioRef.current.pause();
                                setPlayingId(null);
                              }
                              onOpenMixMusic(item);
                              onClose();
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#182234] hover:bg-cyan-950 text-cyan-300 font-semibold text-xs rounded-lg border border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer"
                            title="Mix with Background Music"
                          >
                            <Music className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Mix</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadVoiceMP3(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600/90 hover:bg-fuchsia-500 active:scale-95 text-white font-semibold text-xs rounded-lg border border-fuchsia-400/40 shadow-sm transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>MP3</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fullscreen Footer */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-stone-800/90 bg-[#10141d]/95 backdrop-blur-md flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Total Stored Voices: <strong className="text-stone-200">{historyItems.length}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-100 font-semibold rounded-xl transition-all cursor-pointer border border-stone-700"
          >
            Close
          </button>
        </div>

        {/* DEDICATED CONFIRMATION MODAL FOR CLEAR ALL */}
        {showClearConfirmModal && (
          <div
            id="clear-all-confirmation-modal"
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-sm bg-[#131722] border border-rose-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-100 mb-1">
                  Clear all voice history?
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  This will permanently delete all {historyItems.length} saved audio records from your device storage. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors cursor-pointer border border-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirmModal(false);
                  }}
                  className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-900/30"
                >
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
};
