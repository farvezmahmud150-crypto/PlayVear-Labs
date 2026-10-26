import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX } from 'lucide-react';
import { downloadSrtFile } from '../utils/subtitleGenerator';

interface AudioPlayerProps {
  audioUrl: string;
  characterId: string;
  scriptText?: string;
  onDownloadRaw: () => void;
  onOpenMixMusic?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  characterId,
  scriptText = '',
  onDownloadRaw,
  onOpenMixMusic,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset playback on audioUrl change
  useEffect(() => {
    if (audioRef.current) {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            audioRef.current?.pause();
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
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(false);
  }, [audioUrl]);

  const togglePlay = async () => {
    if (!audioRef.current || hasError) return;
    if (isPlaying) {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            audioRef.current?.pause();
          })
          .catch(() => {});
      } else {
        try {
          audioRef.current.pause();
        } catch {
          // Ignore
        }
      }
      setIsPlaying(false);
    } else {
      try {
        const promise = audioRef.current.play();
        playPromiseRef.current = promise;
        await promise;
        setIsPlaying(true);
      } catch (err: any) {
        // AbortError is expected when playback is paused or replaced mid-play
        if (err?.name !== 'AbortError' && !err?.message?.includes('interrupted')) {
          console.error('Playback error:', err);
        }
        setIsPlaying(false);
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.currentTarget;
    if (!audioUrl || !target.currentSrc) {
      return;
    }
    if (target.error) {
      console.warn('Voice playback notice:', target.error.message || target.error.code);
    }
    setHasError(true);
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDownloadSubtitle = () => {
    const safeDuration = duration || (audioRef.current?.duration ?? 0);
    downloadSrtFile(scriptText, safeDuration, `${characterId || 'voice'}-subtitle.srt`);
  };

  return (
    <div id="audio-player-layout" className="w-full flex flex-col items-center gap-3">
      {/* Primary Voice Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="metadata"
      />

      {/* Main Voice Player Bar */}
      <div
        id="voice-play-layout"
        className="w-full bg-[#11141c] text-stone-100 rounded-2xl p-4 sm:p-5 border border-stone-800 shadow-md flex items-center gap-3 sm:gap-4"
      >
        {/* Play/Pause Button */}
        <button
          id="audio-play-toggle-btn"
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-12 h-12 flex-shrink-0 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(217,70,239,0.45)] hover:shadow-[0_0_18px_rgba(217,70,239,0.7)]"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <input
            id="audio-progress-bar"
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-xs text-stone-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <button
          id="audio-mute-toggle-btn"
          type="button"
          onClick={toggleMute}
          aria-label="Toggle mute"
          className="p-2 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Minimalist Text-Only Action Links */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs select-none pt-1">
        <button
          id="download-mp3-button"
          type="button"
          onClick={onDownloadRaw}
          className="text-stone-300 hover:text-cyan-300 hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0 font-medium"
        >
          Download MP3
        </button>

        <span className="text-stone-700">|</span>

        <button
          id="download-subtitle-button"
          type="button"
          onClick={handleDownloadSubtitle}
          className="text-stone-300 hover:text-cyan-300 hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0 font-medium"
          title="Download auto-timed Subtitle (.srt)"
        >
          Subtitle
        </button>

        {onOpenMixMusic && (
          <>
            <span className="text-stone-700">|</span>
            <button
              id="open-mix-music-button"
              type="button"
              onClick={onOpenMixMusic}
              className="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0 font-semibold"
              title="Mix with Background Music"
            >
              Mix Music
            </button>
          </>
        )}
      </div>
    </div>
  );
};
