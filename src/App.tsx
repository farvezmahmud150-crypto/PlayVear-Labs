import React, { useState, useRef, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db, subscribeUserClonedVoices, checkUserV2Limit, incrementUserV2Limit, checkUserV3Limit, incrementUserV3Limit } from './lib/firebase';
import { CharacterId, VoiceGenerationResponse, EngineMode, CHARACTERS } from './types';
import { Header } from './components/Header';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryModal } from './components/HistoryModal';
import { BgMusicModal } from './components/BgMusicModal';
import { MusicGuideModal } from './components/MusicGuideModal';
import { SubtitleGuideModal } from './components/SubtitleGuideModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { VoiceCloningModal, ClonedVoiceItem } from './components/VoiceCloningModal';
import { GoogleAuthModal, GoogleUser } from './components/GoogleAuthModal';
import { convertNumbersAndDatesToBanglaWords } from './utils/banglaNumberDateConverter';
import {
  HistoryVoiceItem,
  getAllVoicesFromDevice,
  saveVoiceToDevice,
  deleteVoiceFromDevice,
  clearAllVoicesFromDevice,
} from './services/historyStorage';
import { Sparkles, Loader2, Zap, Plus, Mic } from 'lucide-react';

export default function App() {
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('news_anchor');
  const [script, setScript] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Multi-Engine Selection:
  // - Model V2 (v2): Gemini TTS Built-in standard voices (free)
  // - Model V3 (v3): Cartesia AI Sonic Free Rotator Pool (8 keys, free)
  // - Model V4 (v4): Cartesia Paid Subscription & Dedicated Voice Cloning Engine (exclusive to paid key)
  const [engineMode, setEngineMode] = useState<EngineMode>('v2');
  const [cartesiaApiKey, setCartesiaApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('playvear_cartesia_api_key') || '';
    } catch {
      return '';
    }
  });
  const [cartesiaPaidApiKey, setCartesiaPaidApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('playvear_cartesia_paid_api_key') || '';
    } catch {
      return '';
    }
  });
  const [hasPaidKey, setHasPaidKey] = useState<boolean>(false);
  const [showCartesiaKeyModal, setShowCartesiaKeyModal] = useState<boolean>(false);

  // Model V3 free voices state (Strictly populated from active Cartesia key)
  const [v3Voices, setV3Voices] = useState<ClonedVoiceItem[]>([]);

  // Model V4 Paid Cloned Voices state (Strictly populated from Paid key)
  const [clonedVoices, setClonedVoices] = useState<ClonedVoiceItem[]>([]);

  const [selectedClonedVoiceId, setSelectedClonedVoiceId] = useState<string | null>(null);

  // Voice cloning modal state (Active exclusively on Model V4)
  const [showVoiceCloneModal, setShowVoiceCloneModal] = useState<boolean>(false);

  // Google Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => {
    try {
      const saved = localStorage.getItem('playvear_google_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState<boolean>(false);
  const authIntentRef = useRef<'voice_clone' | 'general' | null>(null);
  const [userCredit, setUserCredit] = useState<number>(0.00);

  // Real-time Firestore Credit Sync
  useEffect(() => {
    if (!googleUser?.uid) {
      setUserCredit(0.00);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', googleUser.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (typeof data.credit === 'number') {
          setUserCredit(data.credit);
        }
      }
    });

    return () => unsubscribe();
  }, [googleUser?.uid]);

  // Real-time Firestore Sync for Authenticated User's Private Cloned Voices (Model V4)
  // Ensures User A ONLY sees their own voices, and never anyone else's!
  useEffect(() => {
    if (!googleUser?.uid) {
      setClonedVoices([]);
      return;
    }

    // Try loading immediate cached user voices for fast offline/instant display
    try {
      const userCachedKey = `playvear_v4_voices_${googleUser.uid}`;
      const cached = localStorage.getItem(userCachedKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setClonedVoices(parsed);
          setSelectedClonedVoiceId((prev) => (prev ? prev : parsed[0].id));
        }
      }
    } catch {}

    const unsubscribe = subscribeUserClonedVoices(googleUser.uid, (userVoiceRecords) => {
      const userItems: ClonedVoiceItem[] = userVoiceRecords.map((v) => ({
        id: v.id,
        name: v.name.replace(/^[💎\s]+/, '').trim() || 'Cloned Voice',
        description: v.description || 'Personal V4 Cloned Character',
        category: v.category || 'news_anchor',
        speed: '1.0x',
        emotion: 'neutral',
        createdAt: v.createdAt ? new Date(v.createdAt).toLocaleDateString('bn-BD') : 'Cloned',
        isCloned: true,
        isPaidCloned: true,
        isV4: true,
      }));

      setClonedVoices(userItems);

      try {
        localStorage.setItem(`playvear_v4_voices_${googleUser.uid}`, JSON.stringify(userItems));
      } catch {}

      // Synchronize selection with user's personal voices
      if (userItems.length > 0) {
        setSelectedClonedVoiceId((prevId) => {
          const exists = userItems.some((v) => v.id === prevId);
          return exists ? prevId : userItems[0].id;
        });
      } else {
        setSelectedClonedVoiceId(null);
      }
    });

    return () => unsubscribe();
  }, [googleUser?.uid]);

  // Dynamic Key Rotator & Voice Synchronization State
  const [activeKeyInfo, setActiveKeyInfo] = useState<{
    index: number;
    label: string;
    charsUsed: number;
    maxLimit: number;
  }>({
    index: 1,
    label: 'Key #1',
    charsUsed: 0,
    maxLimit: 19500,
  });
  const [availableKeys, setAvailableKeys] = useState<{ index: number; label: string; customVoicesCount?: number }[]>([]);
  const [keyRotationToast, setKeyRotationToast] = useState<string | null>(null);

  // Load and synchronize Cartesia voices for Model V3 (free pool) and Model V4 (paid status)
  const loadCartesiaVoices = async (keyIndex?: number) => {
    try {
      // 1. Fetch Model V3 voices (Strictly from the active key in Cartesia)
      const v3Url = typeof keyIndex === 'number' ? `/api/cartesia-voices?keyIndex=${keyIndex}` : '/api/cartesia-voices';
      const res3 = await fetch(v3Url);
      if (res3.ok) {
        const data3 = await res3.json();
        const incomingV3Voices: ClonedVoiceItem[] = Array.isArray(data3.voices) ? data3.voices : [];
        setV3Voices(incomingV3Voices);

        if (Array.isArray(data3.availableKeys)) {
          setAvailableKeys(data3.availableKeys);
        }

        // Synchronize selected voice for V3
        if (engineMode === 'v3') {
          if (incomingV3Voices.length > 0) {
            setSelectedClonedVoiceId((prevId) => {
              const exists = incomingV3Voices.some((v) => v.id === prevId);
              return exists ? prevId : incomingV3Voices[0].id;
            });
          } else {
            setSelectedClonedVoiceId(null);
          }
        }

        if (data3.activeKeyIndex) {
          setActiveKeyInfo({
            index: data3.activeKeyIndex,
            label: data3.activeKeyLabel || `Key #${data3.activeKeyIndex}`,
            charsUsed: data3.charCountUsed || 0,
            maxLimit: data3.maxCharsLimit || 19500,
          });
        }
        if (data3.hasPaidKey !== undefined) {
          setHasPaidKey(Boolean(data3.hasPaidKey));
        }
      }

      // 2. Fetch Model V4 Paid Key availability status
      const res4 = await fetch('/api/cartesia-voices?model=v4');
      if (res4.ok) {
        const data4 = await res4.json();
        if (data4.hasPaidKey !== undefined) {
          setHasPaidKey((prev) => prev || Boolean(data4.hasPaidKey));
        }
      }
    } catch (err) {
      console.warn('Error loading Cartesia voices:', err);
    }
  };

  // Sync Cartesia voices on initial mount
  useEffect(() => {
    loadCartesiaVoices();
  }, []);

  // History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<HistoryVoiceItem[]>([]);

  // Background music modal state
  const [isBgMusicOpen, setIsBgMusicOpen] = useState<boolean>(false);
  const [bgMusicVoice, setBgMusicVoice] = useState<{
    voiceAudioUrl: string;
    characterId: string;
    title?: string;
  } | null>(null);

  // Music usage & license guide modal state
  const [isMusicGuideOpen, setIsMusicGuideOpen] = useState<boolean>(false);

  // Subtitle usage guide modal state
  const [isSubtitleGuideOpen, setIsSubtitleGuideOpen] = useState<boolean>(false);

  // Double tap exit toast indicator
  const [showExitToast, setShowExitToast] = useState<boolean>(false);

  const prevAudioUrlRef = useRef<string | null>(null);
  const lastBackPressTimeRef = useRef<number>(0);
  const exitToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent browser pull-to-refresh on mobile swipe down
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        // If swiping downwards at the top of page or scroll container
        if (deltaY > 0 && window.scrollY <= 0) {
          // Check if target is a scrollable container that is scrolled down
          let el = e.target as HTMLElement | null;
          let canScrollUp = false;
          while (el && el !== document.body && el !== document.documentElement) {
            if (el.scrollTop > 0) {
              canScrollUp = true;
              break;
            }
            el = el.parentElement;
          }

          if (!canScrollUp) {
            // Prevent browser default pull-to-refresh
            if (e.cancelable) {
              e.preventDefault();
            }
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Load persistent history items from IndexedDB
  useEffect(() => {
    let mounted = true;
    getAllVoicesFromDevice()
      .then((items: HistoryVoiceItem[]) => {
        if (mounted) setHistoryItems(items);
      })
      .catch((err: unknown) => console.error('Error loading history from device storage:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Keep refs up to date so popstate listener never uses stale closures
  const isHistoryOpenRef = useRef<boolean>(isHistoryOpen);
  const isBgMusicOpenRef = useRef<boolean>(isBgMusicOpen);
  const isMusicGuideOpenRef = useRef<boolean>(isMusicGuideOpen);
  const isSubtitleGuideOpenRef = useRef<boolean>(isSubtitleGuideOpen);

  useEffect(() => {
    isHistoryOpenRef.current = isHistoryOpen;
  }, [isHistoryOpen]);

  useEffect(() => {
    isBgMusicOpenRef.current = isBgMusicOpen;
  }, [isBgMusicOpen]);

  useEffect(() => {
    isMusicGuideOpenRef.current = isMusicGuideOpen;
  }, [isMusicGuideOpen]);

  useEffect(() => {
    isSubtitleGuideOpenRef.current = isSubtitleGuideOpen;
  }, [isSubtitleGuideOpen]);

  // Sync browser/mobile history state for hardware back button interception
  useEffect(() => {
    // Push an initial state so back button can be intercepted
    window.history.replaceState({ appState: 'root' }, '');
    window.history.pushState({ appState: 'active' }, '');

    const handlePopState = () => {
      // Step 1: Check if any UI modals/menus/popups are open
      const isConfirmModalOpen = !!document.getElementById('clear-all-confirmation-modal');
      const isDropdownOpen = !!document.getElementById('character-dropdown-menu');
      const isMenuOpen = !!document.getElementById('header-options-dropdown');

      if (isConfirmModalOpen) {
        // Close clear confirm modal
        window.dispatchEvent(new CustomEvent('close-clear-confirm-modal'));
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      if (isSubtitleGuideOpenRef.current) {
        // Close subtitle guide modal
        setIsSubtitleGuideOpen(false);
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      if (isMusicGuideOpenRef.current) {
        // Close music guide modal
        setIsMusicGuideOpen(false);
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      if (isHistoryOpenRef.current) {
        // Close history modal
        setIsHistoryOpen(false);
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      if (isBgMusicOpenRef.current) {
        // Close background music modal
        setIsBgMusicOpen(false);
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      if (isDropdownOpen || isMenuOpen) {
        // Close open dropdowns/menus
        window.dispatchEvent(new CustomEvent('close-all-header-menus'));
        window.history.pushState({ appState: 'active' }, '');
        return;
      }

      // Step 2: At root screen - handle double-tap to exit
      const now = Date.now();
      const timeDiff = now - lastBackPressTimeRef.current;

      if (timeDiff < 2000) {
        // Double tap confirmed! Allow exit
        if (exitToastTimerRef.current) {
          clearTimeout(exitToastTimerRef.current);
        }
        setShowExitToast(false);
        // Allow actual back navigation / exit
        window.history.back();
      } else {
        // First tap: Intercept back, re-push state, and show toast
        lastBackPressTimeRef.current = now;
        window.history.pushState({ appState: 'active' }, '');

        setShowExitToast(true);
        if (exitToastTimerRef.current) {
          clearTimeout(exitToastTimerRef.current);
        }
        exitToastTimerRef.current = setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimerRef.current) {
        clearTimeout(exitToastTimerRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!script.trim()) {
      setErrorMessage('Please enter or paste your script text.');
      return;
    }

    // Automatically convert numeric digits, dates, currencies into natural Bengali spoken words
    const normalizedScript = convertNumbersAndDatesToBanglaWords(script.trim());
    if (normalizedScript !== script.trim()) {
      setScript(normalizedScript);
    }

    const maxCharsAllowed = engineMode === 'v3' ? 1000 : engineMode === 'v4' ? 5000 : 2500;
    if (script.trim().length > maxCharsAllowed) {
      setErrorMessage('Too long text');
      return;
    }
    if (engineMode === 'v2') {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Check 1: Device LocalStorage check
        const storageKey = `playvear_v2_usage_${todayStr}`;
        const countStr = localStorage.getItem(storageKey) || '0';
        const currentCount = parseInt(countStr, 10);

        if (currentCount >= 5) {
          setErrorMessage('Daily limit exceeded');
          return;
        }

        // Check 2: Google Account / Firebase UID check (if signed in)
        if (googleUser?.uid) {
          const isAccountExceeded = await checkUserV2Limit(googleUser.uid);
          if (isAccountExceeded) {
            setErrorMessage('Daily limit exceeded');
            return;
          }
        }
      } catch (e) {
        console.warn('V2 daily limit check warning:', e);
      }
    }

    // Model V3 Daily Limit Check (Max 1 generation per day)
    if (engineMode === 'v3') {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Check 1: Device LocalStorage check
        const storageKey = `playvear_v3_usage_${todayStr}`;
        const countStr = localStorage.getItem(storageKey) || '0';
        const currentCount = parseInt(countStr, 10);

        if (currentCount >= 1) {
          setErrorMessage('Daily limit exceeded');
          return;
        }

        // Check 2: Google Account / Firebase UID check (if signed in)
        if (googleUser?.uid) {
          const isAccountExceeded = await checkUserV3Limit(googleUser.uid);
          if (isAccountExceeded) {
            setErrorMessage('Daily limit exceeded');
            return;
          }
        }
      } catch (e) {
        console.warn('V3 daily limit check warning:', e);
      }
    }

    // In Model V4 (Paid Voice Cloning), ensure user has provided Paid Key
    if (engineMode === 'v4') {
      const hasKey = Boolean(cartesiaPaidApiKey) || hasPaidKey;
      if (!hasKey) {
        setErrorMessage('মডেল V4 (Model V4)-এ ভয়েস তৈরি করতে Cartesia পেইড সাবস্ক্রিপশন এপিআই কি (CARTESIA_PAID_API_KEY) প্রয়োজন। অনুগ্রহ করে আপনার পেইড কি ইনপুট দিন।');
        setShowCartesiaKeyModal(true);
        return;
      }
    }

    setErrorMessage(null);
    setIsGenerating(true);

    const isCartesiaEngine = engineMode === 'v3' || engineMode === 'v4';

    // Strict Commercial Guard: Halt if no cloned character exists on this active key
    if (isCartesiaEngine) {
      const activeVoiceList = engineMode === 'v4' ? clonedVoices : v3Voices;
      const targetVoice = activeVoiceList.find((v) => v.id === selectedClonedVoiceId) || activeVoiceList[0];
      if (!targetVoice || !targetVoice.id) {
        setErrorMessage(
          engineMode === 'v4'
            ? 'মডেল V4-এ আপনার নিজস্ব কোনো ক্লোন করা ক্যারেক্টার নেই। অনুগ্রহ করে প্রথমে আপনার নিজস্ব ভয়েস ক্লোন করুন।'
            : `বর্তমান API Key (#${activeKeyInfo.index})-তে Cartesia AI-এর কোনো প্রিসেট ক্যারেক্টার পাওয়া যায়নি। অনুগ্রহ করে থ্রি-ডট মেনু > অ্যাডমিন প্যানেল থেকে অন্য Key সিলেক্ট করুন (যেমন: Key #2)।`
        );
        setIsGenerating(false);
        return;
      }
    }

    // Get active voice details
    const activeClonedVoice = isCartesiaEngine
      ? (engineMode === 'v4' ? clonedVoices : v3Voices).find((v) => v.id === selectedClonedVoiceId) ||
        (engineMode === 'v4' ? clonedVoices[0] : v3Voices[0])
      : null;

    const activeVoiceName = activeClonedVoice?.name
      ? activeClonedVoice.name.replace(/^[💎\s]+/, '').split(' - ')[0].trim()
      : '';

    try {
      const endpoint = isCartesiaEngine ? '/api/cartesia-generate' : '/api/generate-voice';
      const bodyPayload = isCartesiaEngine
        ? {
            text: normalizedScript,
            character: engineMode === 'v4' && activeClonedVoice?.category ? activeClonedVoice.category : selectedCharacter,
            apiKey: cartesiaApiKey,
            voiceId: activeClonedVoice?.id || '',
            voiceName: activeVoiceName,
            emotion:
              activeClonedVoice?.emotion && activeClonedVoice.emotion !== 'neutral'
                ? activeClonedVoice.emotion
                : undefined,
            speed:
              activeClonedVoice?.speed && activeClonedVoice.speed !== '1.0x'
                ? activeClonedVoice.speed
                : undefined,
            isV4: engineMode === 'v4',
            paidApiKey: cartesiaPaidApiKey,
          }
        : {
            text: normalizedScript,
            character: selectedCharacter,
            voiceName: CHARACTERS.find((c) => c.id === selectedCharacter)?.name || selectedCharacter,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        throw new Error('সার্ভার থেকে সঠিক অডিও ডেটা পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }

      if (!response.ok || data?.error) {
        if (data?.isPaidKeyMissing || data?.isApiKeyMissing) {
          setShowCartesiaKeyModal(true);
        }
        throw new Error(data?.error || 'ভয়েস তৈরি করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }

      if (!data?.audioBase64) {
        throw new Error('অডিও ডেটা পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }

      // If Model V2 succeeded, increment daily device and user account usage count
      if (engineMode === 'v2') {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const storageKey = `playvear_v2_usage_${todayStr}`;
          const countStr = localStorage.getItem(storageKey) || '0';
          const newCount = parseInt(countStr, 10) + 1;
          localStorage.setItem(storageKey, String(newCount));

          if (googleUser?.uid) {
            await incrementUserV2Limit(googleUser.uid);
          }
        } catch (e) {
          console.warn('V2 usage increment warning:', e);
        }
      }

      // If Model V3 succeeded, increment daily device and user account usage count
      if (engineMode === 'v3') {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const storageKey = `playvear_v3_usage_${todayStr}`;
          const countStr = localStorage.getItem(storageKey) || '0';
          const newCount = parseInt(countStr, 10) + 1;
          localStorage.setItem(storageKey, String(newCount));

          if (googleUser?.uid) {
            await incrementUserV3Limit(googleUser.uid);
          }
        } catch (e) {
          console.warn('V3 usage increment warning:', e);
        }
      }

      // Convert base64 to Blob URL
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });

      // Clean up previous URL
      if (prevAudioUrlRef.current) {
        URL.revokeObjectURL(prevAudioUrlRef.current);
      }

      const newUrl = URL.createObjectURL(blob);
      prevAudioUrlRef.current = newUrl;
      setAudioUrl(newUrl);

      // Check if Cartesia rotator auto-rotated because key reached 19,500 characters
      if (data?.rotatedToNewKey) {
        const toastMsg = `Key #${data.prevKeyIndex || activeKeyInfo.index}-এর কোটা ১৯,৫০০ অক্ষরে পৌঁছেছে! স্বয়ংক্রিয়ভাবে Key #${data.newKeyIndex}-এ সুইচ করা হয়েছে এবং নতুন কী-এর ক্যারেক্টার লোড হয়েছে।`;
        setKeyRotationToast(toastMsg);
        setTimeout(() => setKeyRotationToast(null), 8000);
        await loadCartesiaVoices(data.newKeyIndex);
      } else if (data?.activeKeyIndex) {
        setActiveKeyInfo((prev) => ({
          ...prev,
          index: data.activeKeyIndex,
          charsUsed: typeof data.keyCharUsage === 'number' ? data.keyCharUsage : prev.charsUsed,
        }));
      }

      // Save to device local storage (IndexedDB persistent storage)
      saveVoiceToDevice({
        character: selectedCharacter,
        script: script.trim(),
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        format: data.format || (isCartesiaEngine ? 'wav' : 'mp3'),
      })
        .then((savedItem) => {
          setHistoryItems((prev) => [savedItem, ...prev]);
        })
        .catch((err) => {
          console.warn('Could not save to local device storage:', err);
        });
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err?.message || 'An error occurred while generating the voice.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${selectedCharacter}-voice.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetToNew = () => {
    if (prevAudioUrlRef.current) {
      URL.revokeObjectURL(prevAudioUrlRef.current);
      prevAudioUrlRef.current = null;
    }
    setAudioUrl(null);
    setScript('');
    setErrorMessage(null);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await deleteVoiceFromDevice(id);
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = async () => {
    await clearAllVoicesFromDevice();
    setHistoryItems([]);
  };

  const handleSelectHistoryScript = (historicScript: string) => {
    setScript(historicScript);
  };

  return (
    <div
      id="app-root"
      className="min-h-screen bg-[#090b0e] text-stone-100 flex flex-col font-['Plus_Jakarta_Sans','Hind_Siliguri',sans-serif] selection:bg-cyan-500 selection:text-stone-950 relative"
    >
      {/* Top Header with Dynamic Character Dropdown & 3-Dots Menu */}
      <Header
        engineMode={engineMode}
        selectedCharacter={selectedCharacter}
        onSelectCharacter={(char) => {
          setSelectedCharacter(char);
          setErrorMessage(null);
        }}
        selectedClonedVoiceId={selectedClonedVoiceId}
        onSelectClonedVoiceId={(id) => {
          setSelectedClonedVoiceId(id);
          setErrorMessage(null);
        }}
        v3Voices={v3Voices}
        v4Voices={clonedVoices}
        googleUser={googleUser}
        onOpenGoogleAuth={() => {
          authIntentRef.current = 'general';
          setShowGoogleAuthModal(true);
        }}
        onOpenVoiceCloneModal={() => {
          if (!googleUser) {
            authIntentRef.current = 'voice_clone';
            setShowGoogleAuthModal(true);
          } else {
            setShowVoiceCloneModal(true);
          }
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBgMusic={() => {
          if (audioUrl) {
            setBgMusicVoice({
              voiceAudioUrl: audioUrl,
              characterId: (engineMode === 'v3' || engineMode === 'v4') ? (selectedClonedVoiceId || 'cloned') : selectedCharacter,
              title: script ? script.slice(0, 40) + '...' : undefined,
            });
          } else {
            setBgMusicVoice(null);
          }
          setIsBgMusicOpen(true);
        }}
        onOpenMusicGuide={() => setIsMusicGuideOpen(true)}
        onOpenSubtitleGuide={() => setIsSubtitleGuideOpen(true)}
        onOpenCartesiaRotator={() => setShowCartesiaKeyModal(true)}
        onOpenAdminPanel={() => setShowCartesiaKeyModal(true)}
        historyCount={historyItems.length}
        activeKeyInfo={activeKeyInfo}
        hasPaidKey={hasPaidKey || Boolean(cartesiaPaidApiKey)}
        availableKeys={availableKeys}
        onSwitchKey={(keyIndex) => loadCartesiaVoices(keyIndex)}
        onLogout={() => {
          setGoogleUser(null);
          setClonedVoices([]);
          setSelectedClonedVoiceId(null);
          try {
            localStorage.removeItem('playvear_google_user');
          } catch {}
        }}
        userCredit={userCredit}
      />

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col w-full max-w-4xl mx-auto p-4 sm:p-6 pb-6 gap-5">
        {/* Model Engine Selector Switch (V2 vs V3 vs V4) */}
        <div id="model-engine-selector-bar" className="w-full flex items-center justify-between bg-[#10141d] border border-stone-800 rounded-2xl p-1.5 shadow-sm">
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {/* V2 Button */}
            <button
              id="engine-v2-tab-btn"
              type="button"
              onClick={() => {
                setEngineMode('v2');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all cursor-pointer text-center ${
                engineMode === 'v2'
                  ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.18)]'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 border border-transparent'
              }`}
            >
              V2
            </button>

            {/* V3 Button */}
            <button
              id="engine-v3-tab-btn"
              type="button"
              onClick={() => {
                setEngineMode('v3');
                setErrorMessage(null);
                loadCartesiaVoices();
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all cursor-pointer text-center ${
                engineMode === 'v3'
                  ? 'bg-purple-950/80 border border-purple-500/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.18)]'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 border border-transparent'
              }`}
            >
              V3
            </button>

            {/* V4 Button */}
            <button
              id="engine-v4-tab-btn"
              type="button"
              onClick={() => {
                setEngineMode('v4');
                setErrorMessage(null);
                loadCartesiaVoices();
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all cursor-pointer text-center ${
                engineMode === 'v4'
                  ? 'bg-cyan-950/80 border border-cyan-500/60 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.22)]'
                  : 'text-stone-400 hover:text-cyan-200 hover:bg-stone-800/40 border border-transparent'
              }`}
            >
              V4
            </button>
          </div>
        </div>

        {/* Auto-Rotation Notification Toast */}
        {keyRotationToast && (
          <div
            id="key-rotation-toast"
            className="w-full p-3 rounded-xl bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 border border-purple-500/60 text-purple-200 text-xs font-medium flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-bounce shrink-0" />
              <span>{keyRotationToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setKeyRotationToast(null)}
              className="text-stone-400 hover:text-stone-200 p-1 text-xs shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}





        {/* Script Text Box & Stats Bar */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full flex flex-col h-[220px] sm:h-[340px]">
            <textarea
              id="script-input-box"
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onBlur={() => {
                if (script.trim()) {
                  const converted = convertNumbersAndDatesToBanglaWords(script);
                  if (converted !== script) {
                    setScript(converted);
                  }
                }
              }}
              onPaste={(e) => {
                // If user pastes text containing numbers, auto convert after paste
                setTimeout(() => {
                  setScript((current) => {
                    if (!current.trim()) return current;
                    return convertNumbersAndDatesToBanglaWords(current);
                  });
                }, 50);
              }}
              placeholder=""
              className="w-full h-full bg-[#11141c] text-stone-100 placeholder-transparent text-base sm:text-lg leading-relaxed p-4 sm:p-5 rounded-2xl border border-stone-800 hover:border-cyan-500/40 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all resize-y shadow-sm focus:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            />
          </div>

          {/* Character counter & estimated voice length */}
          <div className="flex items-center justify-between px-2">
            <div>
              {script.length > (engineMode === 'v3' ? 1000 : engineMode === 'v4' ? 5000 : 1500) && (
                <span className="text-[11px] font-medium text-rose-400 animate-pulse">
                  ⚠️ Too long text
                </span>
              )}
            </div>
            <div
              id="script-counter-stats"
              className="flex items-center gap-3 text-stone-400 font-mono select-none tracking-wider uppercase text-[7px]"
              style={{ fontSize: '7px', lineHeight: '1.2' }}
            >
              <span id="script-character-count">
                Characters: {script.length}
              </span>
              <span className="text-stone-700">|</span>
              <span id="script-estimated-duration">
                Est. Voice Length: ~{(() => {
                  const clean = script.trim();
                  if (!clean) return '0s';
                  const totalSeconds = Math.max(1, Math.round(clean.length / 13));
                  const mins = Math.floor(totalSeconds / 60);
                  const secs = totalSeconds % 60;
                  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Inline error if script is missing or generation fails */}
        {errorMessage && (
          <div id="error-message" className="flex flex-col items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-fuchsia-300 text-xs font-medium text-center max-w-md mx-auto animate-in fade-in">
            <span>{errorMessage}</span>
            {!errorMessage.toLowerCase().includes('daily limit') && errorMessage !== 'Too long text' && !errorMessage.includes('Please enter') && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600/50 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                >
                  পুনরায় চেষ্টা করুন (Retry)
                </button>
                {engineMode === 'v4' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCartesiaKeyModal(true)}
                      className="px-3 py-1 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>💎 পেইড এপিআই কি দিন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEngineMode('v3');
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Model V3 (ফ্রি) ব্যবহার করুন
                    </button>
                  </>
                ) : engineMode === 'v3' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCartesiaKeyModal(true)}
                      className="px-3 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      কী রোটেটর পুল চেক করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEngineMode('v4');
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>💎 Model V4 পেইড মোড</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEngineMode('v2');
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Model V2 (Gemini) ব্যবহার করুন
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEngineMode('v4');
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/40 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Model V4 (পেইড ভয়েস ক্লোনিং) চেষ্টা করুন
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Button & Small "New" Option */}
        <div className="flex items-center justify-center gap-3 w-full relative">
          <button
            id="generate-voice-btn"
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0e1622] hover:bg-[#142338] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0e1622] text-cyan-300 hover:text-cyan-100 font-semibold text-sm rounded-xl border border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.12)] hover:shadow-[0_0_18px_rgba(6,182,212,0.28)] transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform duration-200" />
                <span className="tracking-wide">Generate</span>
              </>
            )}
          </button>

          {/* Small "New" text button on the right side of Generate button */}
          {audioUrl && (
            <button
              id="reset-new-screen-btn"
              type="button"
              onClick={handleResetToNew}
              className="text-[11px] font-normal text-stone-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0 select-none animate-in fade-in duration-200"
            >
              New
            </button>
          )}
        </div>

        {/* Voice Play Layout & Action Links */}
        {audioUrl && (
          <div id="result-audio-container" className="w-full mt-2">
            <AudioPlayer
              audioUrl={audioUrl}
              characterId={selectedCharacter}
              scriptText={script}
              onDownloadRaw={handleDownload}
              onOpenMixMusic={() => {
                setBgMusicVoice({
                  voiceAudioUrl: audioUrl,
                  characterId: selectedCharacter,
                  title: script ? script.slice(0, 40) + '...' : undefined,
                });
                setIsBgMusicOpen(true);
              }}
            />
          </div>
        )}
      </main>



      {/* Voice History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        onDeleteItem={handleDeleteHistoryItem}
        onClearAll={handleClearAllHistory}
        onSelectScript={handleSelectHistoryScript}
        onOpenMixMusic={(item) => {
          try {
            const byteCharacters = atob(item.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: item.mimeType || 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            setBgMusicVoice({
              voiceAudioUrl: url,
              characterId: item.character,
              title: item.characterName,
            });
            setIsBgMusicOpen(true);
          } catch (err) {
            console.error('Failed to prepare history voice for mixing:', err);
          }
        }}
      />

      {/* Copyright-Free Background Music Modal */}
      <BgMusicModal
        isOpen={isBgMusicOpen}
        onClose={() => setIsBgMusicOpen(false)}
        defaultCharacterId={bgMusicVoice?.characterId || selectedCharacter}
        voiceAudioUrl={bgMusicVoice?.voiceAudioUrl}
        voiceTitle={bgMusicVoice?.title}
        onOpenMusicGuide={() => setIsMusicGuideOpen(true)}
      />

      {/* Music Usage & License Guide Modal */}
      <MusicGuideModal
        isOpen={isMusicGuideOpen}
        onClose={() => setIsMusicGuideOpen(false)}
      />

      {/* Subtitle Usage Guide Modal */}
      <SubtitleGuideModal
        isOpen={isSubtitleGuideOpen}
        onClose={() => setIsSubtitleGuideOpen(false)}
      />

      {/* Admin Panel & Quota Tracker Modal */}
      <AdminPanelModal
        isOpen={showCartesiaKeyModal}
        onClose={() => setShowCartesiaKeyModal(false)}
        currentApiKey={cartesiaApiKey}
        paidApiKey={cartesiaPaidApiKey}
        onSaveApiKey={(key) => {
          setCartesiaApiKey(key);
          try {
            localStorage.setItem('playvear_cartesia_api_key', key);
          } catch (e) {
            console.warn('Could not save cartesia key to localStorage:', e);
          }
        }}
        onSavePaidApiKey={(key) => {
          setCartesiaPaidApiKey(key);
          try {
            localStorage.setItem('playvear_cartesia_paid_api_key', key);
          } catch (e) {
            console.warn('Could not save cartesia paid key to localStorage:', e);
          }
          loadCartesiaVoices();
        }}
        onKeySwitched={(newIndex) => {
          loadCartesiaVoices(newIndex);
        }}
      />

      {/* Voice Cloning Modal */}
      <VoiceCloningModal
        isOpen={showVoiceCloneModal}
        onClose={() => setShowVoiceCloneModal(false)}
        cartesiaApiKey={cartesiaApiKey}
        cartesiaPaidApiKey={cartesiaPaidApiKey}
        currentUser={googleUser}
        onSavePaidApiKey={(key: string) => {
          setCartesiaPaidApiKey(key);
          try {
            localStorage.setItem('playvear_cartesia_paid_api_key', key);
          } catch (e) {
            console.warn('Could not save cartesia paid key to localStorage:', e);
          }
          loadCartesiaVoices();
        }}
        clonedVoices={clonedVoices}
        activeKeyIndex={activeKeyInfo.index}
        onVoiceCloned={(newVoice) => {
          setClonedVoices((prev) => {
            const exists = prev.some((v) => v.id === newVoice.id);
            const updated = exists ? prev : [newVoice, ...prev];
            if (googleUser?.uid) {
              try {
                localStorage.setItem(`playvear_v4_voices_${googleUser.uid}`, JSON.stringify(updated));
              } catch (e) {
                console.warn('Could not save cloned voices:', e);
              }
            }
            return updated;
          });
          setSelectedClonedVoiceId(newVoice.id);
          setEngineMode('v4');
        }}
        onDeleteVoice={(id) => {
          setClonedVoices((prev) => {
            const updated = prev.filter((v) => v.id !== id);
            if (googleUser?.uid) {
              try {
                localStorage.setItem(`playvear_v4_voices_${googleUser.uid}`, JSON.stringify(updated));
              } catch (e) {
                console.warn('Could not save cloned voices:', e);
              }
            }
            return updated;
          });
          if (selectedClonedVoiceId === id) {
            setSelectedClonedVoiceId(null);
          }
        }}
        selectedClonedVoiceId={selectedClonedVoiceId}
        onSelectClonedVoice={(id) => setSelectedClonedVoiceId(id)}
      />

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={showGoogleAuthModal}
        onClose={() => setShowGoogleAuthModal(false)}
        currentUser={googleUser}
        onLoginSuccess={(user) => {
          setGoogleUser(user);
          setShowGoogleAuthModal(false);
          if (authIntentRef.current === 'voice_clone') {
            setShowVoiceCloneModal(true);
          }
          authIntentRef.current = null;
        }}
        onLogout={() => {
          setGoogleUser(null);
          setClonedVoices([]);
          setSelectedClonedVoiceId(null);
          try {
            localStorage.removeItem('playvear_google_user');
          } catch {}
        }}
      />

      {/* Double Tap Exit Toast Notification */}
      {showExitToast && (
        <div
          id="exit-toast-notification"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999999] bg-[#141a26]/95 border border-cyan-500/40 text-stone-200 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md text-xs font-medium tracking-wide animate-in fade-in slide-in-from-bottom-3 duration-150 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Press back again to exit</span>
        </div>
      )}
    </div>
  );
}
