import { CharacterId } from '../types';

export interface BgmOption {
  id: string;
  name: string;
  url: string;
  defaultVolume: number;
  description: string;
  tag: string;
  moodKeywords: string[];
}

export const CHARACTER_BGM_COLLECTION: Partial<Record<CharacterId, BgmOption[]>> = {
  // 1. টিভি সংবাদ পাঠক (The TV News Anchor - Somoy TV / Ekattor TV / Channel 24 style)
  news_anchor: [
    {
      id: 'news_headline_pulse',
      name: 'টিভি সংবাদ শিরোনাম থিম (News Headline Pulse)',
      url: '/audio/news_headline_pulse.mp3',
      defaultVolume: 0.18,
      description: 'সময় টিভি ও চ্যানেল ২৪ স্টাইল দ্রুতগতির টিকিং নিউজ টিম্বার ও গম্ভীর বেজ থিম',
      tag: 'সংবাদ শিরোনাম',
      moodKeywords: ['সংবাদ', 'শিরোনাম', 'খবর', 'জাতীয়', 'আন্তর্জাতিক', 'রাজনীতি', 'অর্থনীতি', 'বুলিটিন', 'সরকার', 'মন্ত্রী', 'ঢাকা'],
    },
    {
      id: 'news_breaking_alert',
      name: 'ব্রেকিং নিউজ এলার্ট (Urgent Breaking News)',
      url: '/audio/news_breaking_alert.mp3',
      defaultVolume: 0.20,
      description: 'জরুরি ব্রেকিং নিউজ এলার্ট ও টানটান উত্তেজনাময় স্টুডিও পাল্স',
      tag: 'ব্রেকিং নিউজ',
      moodKeywords: ['ব্রেকিং', 'জরুরি', 'হঠাৎ', 'দুর্ঘটনা', 'নিহত', 'আহত', 'আটক', 'গ্রেপ্তার', 'আদালত', 'মামলা', 'রায়', 'বিশেষ সংবাদ'],
    },
    {
      id: 'news_bulletin_studio',
      name: 'স্টুডিও নিউজ প্যাড (Studio News Bed)',
      url: '/audio/news_bulletin_studio.mp3',
      defaultVolume: 0.15,
      description: 'শান্ত ও প্রফেশনাল স্টুডিও আবহ ও হালকা টিকিং ক্লক',
      tag: 'স্টুডিও আবহ',
      moodKeywords: ['আবহাওয়া', 'বাণিজ্য', 'খেলাধুলা', 'বিজ্ঞান', 'সাক্ষাৎকার', 'প্রতিবেদন', 'বিস্তারিত', 'অনুষ্ঠান'],
    },
  ],

  // 2. চিত্র মিডিয়া (The Nature Poet)
  nature_poet: [
    {
      id: 'bansuri_alap',
      name: 'আসল মেঠো বাঁশি (ভৈরবী আলাপ ও রাগ সঙ্গীত)',
      url: '/audio/nature_bansuri_alap.mp3',
      defaultVolume: 0.20,
      description: 'পল্লীবাংলার আসল বাঁশির মিষ্টি রাগ সঙ্গীত ও মনকাড়া সুর',
      tag: 'বাঁশি (Flute)',
      moodKeywords: ['বাঁশি', 'সুর', 'রাগ', 'গান', 'কবিতা', 'মেঠো', 'পাখি', 'নদী', 'মন', 'গ্রাম'],
    },
    {
      id: 'village_acoustic',
      name: 'গ্রামের শান্ত সকাল (অ্যাকোস্টিক লোকসুর ও মেলোডি)',
      url: '/audio/nature_village_acoustic.mp3',
      defaultVolume: 0.16,
      description: 'মন জুড়ানো মিষ্টি অ্যাকোস্টিক গিটার ও গ্রামীণ সুরের দোলা',
      tag: 'অ্যাকোস্টিক (Folk)',
      moodKeywords: ['সকাল', 'সূর্য', 'শান্ত', 'হৃদয়', 'ভোর', 'স্মৃতি', 'মাটি', 'আলো', 'সৌন্দর্য', 'সবুজ'],
    },
    {
      id: 'bansuri_megh',
      name: 'গম্ভীর বাঁশি ও মায়াবী নদী (Deep Flute Drone)',
      url: '/audio/nature_bansuri_megh.mp3',
      defaultVolume: 0.22,
      description: 'গম্ভীর পল্লী রাগ ও শান্ত নদীর মায়াবী আবহ',
      tag: 'গম্ভীর বাঁশি',
      moodKeywords: ['বৃষ্টি', 'মেঘ', 'কষ্ট', 'কান্না', 'উদাস', 'গভীর', 'নদী', 'রাত', 'বিরহ', 'অশ্রু'],
    },
    {
      id: 'chitra_afternoon',
      name: 'চিত্র মিডিয়া গোধূলি আবহ (Afternoon Calm)',
      url: '/audio/nature_chitra_afternoon.mp3',
      defaultVolume: 0.16,
      description: 'বিকেলের আলো-আঁধারি মেঠোপথ ও নির্মল প্রকৃতির রূপ',
      tag: 'গোধূলি লিরিক',
      moodKeywords: ['বিকেল', 'গোধূলি', 'সন্ধ্যা', 'হাওয়া', 'পথ', 'পাতা', 'বাতাস', 'ফুল', 'শাখা'],
    },
  ],

  // 3. মায়াজাল (The Mystery Teller)
  mystery_teller: [
    {
      id: 'mayajaal_pulse',
      name: 'মায়াজাল সিগনেচার পাল্স (Infados Dark Mystery)',
      url: '/audio/mystery_mayajaal_pulse.mp3',
      defaultVolume: 0.22,
      description: 'গা ছমছমে ডিপ সিনেমাটিক ড্রোন ও মেটালিক রহস্যময় টিকটিক পাল্স',
      tag: 'মায়াজাল থিম',
      moodKeywords: ['রহস্য', 'রহস্যময়', 'ঘটনা', 'আজব', 'অজানা', 'অদৃশ্য', 'সত্যি', 'গবেষণা', 'তথ্য', 'বিজ্ঞান'],
    },
    {
      id: 'dark_revelation',
      name: 'রহস্য উন্মোচন ও ডার্ক ক্লাইম্যাক্স (Dark Climax)',
      url: '/audio/mystery_dark_revelation.mp3',
      defaultVolume: 0.20,
      description: 'চরম উত্তেজনাপূর্ণ রহস্য, অদেখা সত্য ও গা ছমছমে ক্লাইম্যাক্স',
      tag: 'ক্লাইম্যাক্স',
      moodKeywords: ['ভয়ঙ্কর', 'ভয়', 'মৃত্যু', 'খুন', 'বিপদ', 'কঙ্কাল', 'আতঙ্ক', 'ভূত', 'ভুতুড়ে', 'চমক', 'অভিশাপ'],
    },
    {
      id: 'ancient_sitar',
      name: 'প্রাচীন বাউড সেতারের মায়াজাল (Haunting Bowed Sitar)',
      url: '/audio/mystery_ancient_sitar.mp3',
      defaultVolume: 0.18,
      description: 'হিমালয়ের গভীর প্রাচীন রহস্য ও সম্মোহনী সেতারের টান',
      tag: 'রহস্য সেতার',
      moodKeywords: ['প্রাচীন', 'ইতিহাস', 'মন্দির', 'হিমালয়', 'সাধু', 'অতীত', 'গুপ্তধন', 'মিশর', 'পিরামিড', 'শতাব্দী'],
    },
  ],

  // 4. নির্বাচনী মাইকিং (Election Campaigner)
  election_campaigner: [
    {
      id: 'rally_dholak',
      name: 'নির্বাচনী র‍্যালি ও ঢোলক উৎসব (Rally & Chime)',
      url: '/audio/election_rally_dholak.mp3',
      defaultVolume: 0.18,
      description: 'মিছিলের ঢোলকের ছন্দ ও রিকশার পিতলের বেলের টুংটাং রিং',
      tag: 'র‍্যালি ও ঢোলক',
      moodKeywords: ['ভোট', 'মার্কা', 'প্রার্থী', 'জয়', 'মিছিল', 'বিজয়', 'জনগণ', 'সালাম', 'নেতা', 'উন্নয়ন', 'মার্কায়'],
    },
    {
      id: 'rickshaw_pure',
      name: 'খাঁটি রিকশা মাইকিং বেল (Pure Chime Ambience)',
      url: '/audio/election_rickshaw_pure.mp3',
      defaultVolume: 0.16,
      description: 'গ্রামের মেঠোপথে রিকশায় মাইক বেঁধে ঘোরার আসল বেলের আওয়াজ',
      tag: 'রিকশা বেল',
      moodKeywords: ['শুনুন', 'ভাই', 'রিকশা', 'মেঠোপথ', 'ঘোষণা', 'এলাকা', 'গ্রামবাসী', 'মনোযোগ'],
    },
    {
      id: 'market_miking',
      name: 'গ্রামের হাটবাজার ও হালকা ধুন (Village Bazaar)',
      url: '/audio/election_miking_bgm.mp3',
      defaultVolume: 0.16,
      description: 'হাটের মৃদু কোলাহল ও পিতলের টুংটাং বেলের আবহ',
      tag: 'হাটবাজার',
      moodKeywords: ['বাজার', 'হাট', 'দোকান', 'পণ্য', 'অফার', 'মূল্য', 'ছাড়', 'বিজ্ঞাপন', 'সস্তা'],
    },
  ],

  // 5. Vear (TikTok & Shorts Fast Voice)
  vear: [
    {
      id: 'vear_monkeys',
      name: 'ভাইরাল টিকটক বিট (Viral TikTok Groove)',
      url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
      defaultVolume: 0.15,
      description: 'টিকটক, রিলস ও শর্টস ভিডিওর জন্য চরম জনপ্রিয় দ্রুতগতির ভাইরাল ব্যাকগ্রাউন্ড সুর',
      tag: 'ভাইরাল টিকটক',
      moodKeywords: ['টিকটক', 'রিলস', 'শর্টস', 'ভাইরাল', 'ফানি', 'হাসি', 'মজা', 'কমেডি', 'হিট'],
    },
    {
      id: 'vear_sneaky',
      name: 'সাসপেন্স শর্টস বিট (Shorts Mystery Groove)',
      url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3',
      defaultVolume: 0.16,
      description: 'টানটান উত্তেজনাময় শর্টস গল্প ও রহস্যময় ফ্যাক্টস বিজিএম',
      tag: 'শর্টস সাসপেন্স',
      moodKeywords: ['রহস্য', 'ফ্যাক্টস', 'চমক', 'গোপন', 'সত্যি', 'অবিশ্বাস্য', 'জানেন'],
    },
    {
      id: 'vear_carefree',
      name: 'আপবিট রিলস এনার্জি (Upbeat Reels Energy)',
      url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
      defaultVolume: 0.15,
      description: 'পজিটিভ ও প্রাণবন্ত এনার্জেটিক শর্ট ভিডিও ব্যাকগ্রাউন্ড মিউজিক',
      tag: 'রিলস এনার্জি',
      moodKeywords: ['লাইফস্টাইল', 'ভ্লগ', 'ট্রাভেল', 'খুশি', 'আনন্দ', 'পরামর্শ', 'টিপস'],
    },
  ],
};

/**
 * Returns available BGM tracks for a character
 */
export function getBgmOptionsForCharacter(characterId: CharacterId): BgmOption[] {
  return CHARACTER_BGM_COLLECTION[characterId] || [];
}

/**
 * Intelligently analyzes the script text and selects the best matching BGM track based on mood & keywords
 */
export function getSmartBgmForScript(characterId: CharacterId, scriptText: string): BgmOption | undefined {
  const options = getBgmOptionsForCharacter(characterId);
  if (options.length === 0) return undefined;
  if (!scriptText || !scriptText.trim()) return options[0];

  const lowerText = scriptText.toLowerCase();
  let bestTrack = options[0];
  let maxScore = -1;

  for (const track of options) {
    let score = 0;
    for (const kw of track.moodKeywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestTrack = track;
    }
  }

  return bestTrack;
}

/**
 * Helper to safely fetch and load audio ArrayBuffer from Blob, data URL, local path, or external URL via proxy
 */
async function loadAudioArrayBuffer(urlOrBlob: string | Blob): Promise<ArrayBuffer> {
  if (urlOrBlob instanceof Blob) {
    return await urlOrBlob.arrayBuffer();
  }

  if (typeof urlOrBlob !== 'string' || !urlOrBlob) {
    throw new Error('Invalid audio source provided to mixer');
  }

  // If it's a blob: or data: or local relative path starting with '/'
  if (urlOrBlob.startsWith('blob:') || urlOrBlob.startsWith('data:') || urlOrBlob.startsWith('/')) {
    const res = await fetch(urlOrBlob);
    if (!res.ok) {
      throw new Error(`Failed to load local audio (${res.status})`);
    }
    return await res.arrayBuffer();
  }

  // If it's an external HTTP/HTTPS URL, route through local proxy to bypass CORS
  try {
    const parsed = new URL(urlOrBlob);
    if (parsed.origin !== window.location.origin) {
      const proxyUrl = `/api/bgm-stream?url=${encodeURIComponent(urlOrBlob)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        return await res.arrayBuffer();
      }
      console.warn(`[Mixer] Proxy fetch returned ${res.status}, trying fallback.`);
    }
  } catch {
    // If URL parsing fails, continue to direct fetch
  }

  // Fallback to direct fetch
  const res = await fetch(urlOrBlob);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio stream (${res.status})`);
  }
  return await res.arrayBuffer();
}

/**
 * Mixes voice audio and selected BGM audio with smooth ducking into a single combined WAV Blob.
 */
export async function mixVoiceAndBgm(
  voiceAudioUrl: string | Blob,
  bgmAudioUrl: string | Blob,
  bgmVolume: number = 0.2,
  voiceVolume: number = 1.0
): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    // 1. Fetch & decode voice buffer
    const voiceArrayBuf = await loadAudioArrayBuffer(voiceAudioUrl);
    const voiceBuffer = await audioCtx.decodeAudioData(voiceArrayBuf.slice(0));

    // 2. Fetch & decode bgm buffer
    const bgmArrayBuf = await loadAudioArrayBuffer(bgmAudioUrl);
    const bgmBuffer = await audioCtx.decodeAudioData(bgmArrayBuf.slice(0));

    // 3. Setup OfflineAudioContext
    const sampleRate = voiceBuffer.sampleRate || 44100;
    const voiceDuration = voiceBuffer.duration;
    // 1.5 seconds tail so BGM fades out gracefully after voice finishes
    const totalDuration = voiceDuration + 1.5;
    const totalFrames = Math.ceil(totalDuration * sampleRate);

    const offlineCtx = new OfflineAudioContext(1, totalFrames, sampleRate);

    // Voice Node with Volume Gain
    const voiceSource = offlineCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.setValueAtTime(voiceVolume, 0);
    voiceSource.connect(voiceGain);
    voiceGain.connect(offlineCtx.destination);
    voiceSource.start(0);

    // BGM Node
    const bgmSource = offlineCtx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;

    // BGM Gain Node with Auto-Ducking & Fade-Out
    const bgmGain = offlineCtx.createGain();
    const now = 0;
    // Fade in
    bgmGain.gain.setValueAtTime(0, now);
    bgmGain.gain.linearRampToValueAtTime(bgmVolume, now + 0.3);
    // Keep at ducked volume while speaking
    bgmGain.gain.setValueAtTime(bgmVolume, voiceDuration);
    // Fade out over 1.5s after speech ends
    bgmGain.gain.linearRampToValueAtTime(0.0001, voiceDuration + 1.5);

    bgmSource.connect(bgmGain);
    bgmGain.connect(offlineCtx.destination);
    bgmSource.start(0);

    // Render mixed audio
    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV Blob
    const channelData = renderedBuffer.getChannelData(0);
    return audioBufferToWavBlob(channelData, sampleRate);
  } finally {
    audioCtx.close();
  }
}

/**
 * Encodes Float32Array channel data to standard 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count (mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
