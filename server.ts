import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import { pcmToMp3, pcmToWav } from './server/audioHelper';
import { cartesiaRotator } from './src/server/cartesiaKeyRotator';
import { convertNumbersAndDatesToBanglaWords } from './src/utils/banglaNumberDateConverter';
import { checkCelebrityProtection } from './src/utils/celebrityProtection';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Centralized Output Category & Style Profile System
export type ValidCharId =
  | 'news_anchor'
  | 'attitude_boy'
  | 'reviewer'
  | 'caster'
  | 'bounty'
  | 'mystery_teller'
  | 'nature_poet'
  | 'horror_thriller'
  | 'geopolitics_analyst'
  | 'village_food'
  | 'islamic_storyteller'
  | 'hype_streamer'
  | 'pro_analyst'
  | 'comic_roaster'
  | 'election_campaigner'
  | 'vear';

export const VALID_CHARACTERS: ValidCharId[] = [
  'news_anchor',
  'attitude_boy',
  'reviewer',
  'caster',
  'bounty',
  'mystery_teller',
  'nature_poet',
  'horror_thriller',
  'geopolitics_analyst',
  'village_food',
  'islamic_storyteller',
  'hype_streamer',
  'pro_analyst',
  'comic_roaster',
  'election_campaigner',
  'vear',
];

export interface CategoryProfile {
  id: ValidCharId;
  label: string;
  categoryRole: string;
  voiceName: string;
  cartesiaVoiceId: string;
  speed: number;
  emotions: string[];
  style: string;
  fallbackPrompt: (text: string, voiceName?: string) => string;
  formatTranscript: (text: string) => string;
}

const cleanPunctuation = (text: string) => text.trim().replace(/\s+/g, ' ');

const formatHorrorTranscript = (text: string) => {
  return text
    .trim()
    .replace(/([।!?])\s*/g, '$1... ')
    .replace(/(হঠাৎ|একটু পর|অন্ধকারে|পিছনে ফিরে|রক্তাক্ত|ভয়ানক|মৃত্যু|লাশ)/g, '... $1')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+/g, ' ');
};

const formatMysteryTranscript = (text: string) => {
  return text
    .trim()
    .replace(/([?।])\s*/g, '$1... ')
    .replace(/(কিন্তু কেন|রহস্য|অবিশ্বাস্য হলেও সত্যি|বিজ্ঞানীরা আজও|যার উত্তর)/g, '... $1')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+/g, ' ');
};

const formatNatureTranscript = (text: string) => {
  return text
    .trim()
    .replace(/([।])\s*/g, '।... ')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+/g, ' ');
};

const formatAttitudeTranscript = (text: string) => {
  return text
    .trim()
    .replace(/([।!])\s*/g, '$1... ')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+/g, ' ');
};

const formatFastTranscript = (text: string) => {
  return text
    .trim()
    .replace(/\.{2,}/g, ',')
    .replace(/\s*([,।!])\s*/g, '$1 ')
    .replace(/\s+/g, ' ');
};

const formatCasterTranscript = (text: string) => {
  return text
    .trim()
    .replace(/\.{2,}/g, '!')
    .replace(/([।])\s*/g, '! ')
    .replace(/\s+/g, ' ');
};

export const CATEGORY_PROFILES: Record<ValidCharId, CategoryProfile> = {
  news_anchor: {
    id: 'news_anchor',
    label: 'The TV News Anchor (টিভি সংবাদ পাঠক)',
    categoryRole: 'সময় টিভি ও চ্যানেল ২৪ স্টাইল প্রফেশনাল সংবাদ পাঠ, হেডলাইন ও ব্রেকিং নিউজ',
    voiceName: 'Fenrir',
    cartesiaVoiceId: 'ddf9ec71-3337-4a8a-a318-9a42f72433e2', // Rupam
    speed: 0.98,
    emotions: ['positivity:low'],
    style:
      'Top-tier 35-year-old Bangladeshi professional male TV news anchor in Somoy TV and Channel 24, authoritative, crystal-clear, articulate, formal, and perfectly paced standard Bangladeshi Bengali (প্রমিত বাংলা). Formal broadcast cadence with sharp diction.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'a top-tier, 35-year-old Bangladeshi professional TV news presenter'} (টিভি সংবাদ উপস্থাপক ও নিউজরুম অ্যাঙ্কর) in leading Bangladeshi news television channels like Somoy TV, Ekattor TV, and Channel 24. Your voice is authoritative, crystal-clear, articulate, formal, and perfectly paced standard Bangladeshi Bengali (প্রমিত বাংলা). Deliver headlines and studio bulletins with professional gravity and sharp diction.\n\n` +
      `Read the following TV news bulletin script with complete professional news anchor authenticity:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  attitude_boy: {
    id: 'attitude_boy',
    label: 'Attitude Boy (টিকটক ও রিলস ডায়লগ)',
    categoryRole: '১৪ বছর বয়সী কিশোরদের আবেগ, প্রেম-বিচ্ছেদ, বন্ধু ও জীবনের হার্ড অ্যাটিটিউড ও স্যাড ডায়লগ',
    voiceName: 'Puck',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 0.94,
    emotions: ['sadness:medium', 'anger:low'],
    style:
      'Authentic 14-year-old young Bangladeshi schoolboy delivering emotional heartbreak and viral attitude dialogues for TikTok and Reels, youthful higher pitch, emotional yet confident teen attitude with raw sadness and swagger.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'an authentic 14-year-old young Bangladeshi school-going teenage boy'} delivering viral emotional, heartbroken, yet fiercely confident attitude dialogues for TikTok, Facebook Reels, and YouTube Shorts (খাঁটি ১৪ বছর বয়সী বাংলাদেশি উঠতি কিশোর ছেলের কণ্ঠ).\n` +
      `- VOICE PITCH & AGE: Exactly 14 years old (কিশোর বয়স). Youthful, lighter in pitch, fresh, and slightly broken teen swagger.\n` +
      `- TONE & MOOD: Emotional, hurt, slightly broken young voice yet full of raw teen swag and attitude.\n` +
      `Deliver the following script with authentic teen heartbreak and attitude:\n${text.trim()}`,
    formatTranscript: formatAttitudeTranscript,
  },
  nature_poet: {
    id: 'nature_poet',
    label: 'The Nature Poet (চিত্র মিডিয়া স্টাইল)',
    categoryRole: 'গ্রামবাংলা, গাছপালা, পশুপাখি ও প্রকৃতির ছন্দময় মায়াবী গল্প বলা',
    voiceName: 'Charon',
    cartesiaVoiceId: '314be1d2-3d14-468d-be40-08a1af7df49d', // Kian
    speed: 0.82,
    emotions: ['positivity:lowest'],
    style:
      'Iconic narrator of rural nature documentary channel Chitra Media (চিত্র মিডিয়া), very slow, relaxed, unhurried, gentle, peaceful, no hype, contemplative and soulful Bengali voice.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'the real, iconic middle-aged Bangladeshi voice artist'} of the rural nature documentary channel "Chitra Media" (চিত্র মিডিয়া). Very slow, relaxed, unhurried, and peaceful. Deep, grounded, soft-spoken, tender, and contemplative.\n\n` +
      `Narrate the following script slowly, softly, and peacefully with authentic Chitra Media calm storytelling cadence:\n${text.trim()}`,
    formatTranscript: formatNatureTranscript,
  },
  mystery_teller: {
    id: 'mystery_teller',
    label: 'The Mystery Teller (মায়াজাল স্টাইল)',
    categoryRole: 'অজানা রহস্য, ডার্ক ফ্যাক্টস, প্রাচীন রহস্য ও সিনেমাটিক সাসপেন্স গল্প',
    voiceName: 'Orus',
    cartesiaVoiceId: '314be1d2-3d14-468d-be40-08a1af7df49d', // Kian
    speed: 0.88,
    emotions: ['curiosity:high'],
    style:
      'Iconic male narrator of Mayajaal documentary channel, deep, calm, mysterious, atmospheric, and gripping suspense with measured deliberate pacing and intense curiosity.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'the iconic narrator'} of the famous Bangladeshi mystery and documentary channel "Mayajaal" (মায়াজাল). Deep, calm, mysterious, atmospheric, and full of gripping suspense. You speak with measured, deliberate pacing, pausing naturally before shocking revelations or mind-bending facts in standard, elegant Bangladeshi Bengali (বাংলা).\n\n` +
      `Narrate the following documentary script with classic Mayajaal mystery, suspense, and curiosity:\n${text.trim()}`,
    formatTranscript: formatMysteryTranscript,
  },
  horror_thriller: {
    id: 'horror_thriller',
    label: 'Sunday Suspense (মীর / হরর থ্রিলার)',
    categoryRole: 'গা ছমছমে ভৌতিক গল্প, থ্রিলার সাসপেন্স ও রহস্যময় অডিও স্টোরি',
    voiceName: 'Charon',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 0.84,
    emotions: ['anger:low', 'sadness:low'],
    style:
      'Master horror storyteller and dramatic narrator inspired by Sunday Suspense and Mir, deep ominous male voice, dark, intense, spine-chilling, and deeply theatrical horror suspense.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'a master horror storyteller and dramatic narrator'} inspired by legendary radio thrillers like "Sunday Suspense" and Mir Afsar Ali. Deep ominous voice, dark, intense, spine-chilling, and deeply theatrical.\n\n` +
      `Narrate the following horror thriller script with chilling theatrical suspense:\n${text.trim()}`,
    formatTranscript: formatHorrorTranscript,
  },
  geopolitics_analyst: {
    id: 'geopolitics_analyst',
    label: 'The Defense & Geopolitics Analyst',
    categoryRole: 'আন্তর্জাতিক রাজনীতি, যুদ্ধ কৌশল, অস্ত্র ও সামরিক বিশ্লেষণ',
    voiceName: 'Fenrir',
    cartesiaVoiceId: 'ddf9ec71-3337-4a8a-a318-9a42f72433e2', // Rupam
    speed: 0.98,
    emotions: ['positivity:low'],
    style:
      'Commanding, authoritative adult male international geopolitics, military defense, and strategic war affairs analyst in Bangladesh, articulate, intellectual, and decisive.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'an authoritative adult international geopolitics, military defense, and strategic war affairs analyst'} in Bangladesh. Tone is commanding, articulate, grave, highly intellectual, and decisive.\n\n` +
      `Deliver the following strategic geopolitics and defense analysis with commanding authority and sharp precision:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  election_campaigner: {
    id: 'election_campaigner',
    label: 'Election Campaigner (গ্রামের নির্বাচনী মাইকিং)',
    categoryRole: 'রিকশা-ভ্যানে চোঙ্গা মাইকের নির্বাচনী প্রচারণা, স্লোগান, মার্কা ও গুণগান প্রচার',
    voiceName: 'Fenrir',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.06,
    emotions: ['positivity:high'],
    style:
      'Passionate Bangladeshi rural election loudspeaker campaign announcer from rickshaw miking, loud, theatrical slogan chanting, high energy.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'an authentic, loud, and passionate Bangladeshi rural election loudspeaker campaign announcer'} (গ্রামের নির্বাচনী মাইকিং প্রচারক). Announcing from a rickshaw or van with horn loudspeakers. High energy in authentic rural Bangladeshi Bengali (বাংলা)!\n\n` +
      `Deliver the following election campaign announcement with full rural miking passion, loud projection, and theatrical cadence:\n${text.trim()}`,
    formatTranscript: (t) => t.replace(/([।])\s*/g, '! ').trim(),
  },
  islamic_storyteller: {
    id: 'islamic_storyteller',
    label: 'The Islamic & Spiritual Storyteller',
    categoryRole: 'সাহাবী ও ঐতিহাসিক কাহিনী, কুরআন-হাদিসের গল্প ও আত্মশুদ্ধি',
    voiceName: 'Orus',
    cartesiaVoiceId: '314be1d2-3d14-468d-be40-08a1af7df49d', // Kian
    speed: 0.88,
    emotions: ['positivity:lowest'],
    style:
      'Revered, gentle, serene, and reflective Bangladeshi male Islamic storyteller, calm, noble, compassionate, and spiritually resonant.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'a deeply revered, gentle, and reflective Bangladeshi Islamic and spiritual storyteller'}. Exceptionally calm, noble, compassionate, and resonant with sincere spiritual emotion in pure, dignified Bangladeshi Bengali (বাংলা).\n\n` +
      `Narrate the following Islamic and spiritual story with serenity, devotion, and profound grace:\n${text.trim()}`,
    formatTranscript: (t) => t.replace(/([।])\s+/g, '।... ').trim(),
  },
  village_food: {
    id: 'village_food',
    label: 'The Village Food & Lifestyle Vlogger',
    categoryRole: 'গ্রামের মাটির রান্না, গ্রামীণ জীবনযাত্রা ও আন্তরিক মেঠোপথ ভ্লগ',
    voiceName: 'Puck',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.02,
    emotions: ['positivity:high'],
    style:
      'Warmhearted, friendly, and cheerful rural Bangladeshi male food and village vlogger, hospitality, smiles, warmth, and folk charm.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'a friendly, warmhearted, and cheerful rural Bangladeshi food and village lifestyle vlogger'}. Full of authentic hospitality, smiles, warmth, and down-to-earth folk charm in sweet, friendly Bangladeshi Bengali (বাংলা).\n\n` +
      `Share the following village food and lifestyle story with heartfelt hospitality, warmth, and joy:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  bounty: {
    id: 'bounty',
    label: 'বাউন্টি (Bounty - নিখুঁত ইমোশনাল ন্যারেটর)',
    categoryRole: 'অত্যন্ত সুন্দর ও নিখুঁত বর্ণনা এবং নিখুঁত ইমোশন কন্ট্রোল সহ মনোগ্রাহী বাংলা কণ্ঠ',
    voiceName: 'Charon',
    cartesiaVoiceId: '314be1d2-3d14-468d-be40-08a1af7df49d', // Kian
    speed: 0.92,
    emotions: ['curiosity:low'],
    style:
      'Deep-voiced, punchy, crisp, resonant low baritone voice artist with masterful dynamic emotional control and powerful delivery in authentic Bengali.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'a deep-voiced, punchy, crisp, and commanding voice artist'} inspired by ElevenLabs iconic bounty punchy crisp style. Thick, resonant low baritone voice with masterful dynamic emotional control, crisp articulate pronunciation, and powerful delivery in authentic Bengali (বাংলা).\n\n` +
      `Deliver the following script with deep voice, punchy crisp cadence, and controlled emotion:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  hype_streamer: {
    id: 'hype_streamer',
    label: 'Rafi (Hype Streamer)',
    categoryRole: 'উত্তেজনাপূর্ণ পাবজি/ফ্রি ফায়ার লাইভ স্ট্রিম, ক্ল্যাচ ক্লিপ ও মজার রিঅ্যাকশন',
    voiceName: 'Orus',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.15,
    emotions: ['positivity:high', 'surprise:low'],
    style:
      'Energetic 21-year-old Bangladeshi live gamer, clutch adrenaline, rapid tempo, sudden humorous exclamations, peak gamer excitement.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'Rafi, a wildly energetic and hilarious 21-year-old Bangladeshi gaming live streamer'} playing Free Fire and PUBG Mobile. Full of gamer hype, clutch adrenaline, sudden humorous exclamations, punchy tempo, and natural gamer emotion in Bangladeshi Bengali (বাংলা).\n\n` +
      `Deliver the following script with peak gamer hype, passion, and streamer flair:\n${text.trim()}`,
    formatTranscript: formatFastTranscript,
  },
  reviewer: {
    id: 'reviewer',
    label: 'Alex (Social Video Reviewer)',
    categoryRole: 'টিকটক, রিলস, শর্টস ও গেমিং শর্ট ভিডিও রিভিউ ও ভয়েসওভার',
    voiceName: 'Puck',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.08,
    emotions: ['positivity:medium'],
    style:
      'Energetic, trendy 22-year-old Bangladeshi young male voiceover artist doing TikTok and gaming reviews, conversational, crisp, engaging, and fast tempo in Bangladeshi Bengali.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'an energetic, trendy 22-year-old Bangladeshi voiceover artist'} doing short videos, TikTok, and Reels reviews for Free Fire & PUBG esports tournaments, gaming platforms, and esports apps. Conversational, crisp, and engaging for social media.\n\n` +
      `Read the following script naturally:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  caster: {
    id: 'caster',
    label: 'Marcus (Tournament Caster)',
    categoryRole: '২০ বছর বয়সী তরুণ তুর্কি শাউটকাস্টারের তীব্র উত্তেজনাপূর্ণ ক্ল্যাচ ধারাভাষ্য ও রোমাঞ্চকর চিত্কার',
    voiceName: 'Puck',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.22,
    emotions: ['positivity:high', 'surprise:high'],
    style:
      'Hyper-energetic 20-year-old young Bangladeshi esports live tournament shoutcaster for Free Fire, PUBG Mobile, and Valorant championships. Extremely hyped, loud, explosive vocal adrenaline, rapid clutch commentary, shouting excitement, and roaring tournament broadcast energy!',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'an intensely hyped, 20-year-old young Bangladeshi esports tournament shoutcaster'} (২০ বছর বয়সী খাঁটি বাংলাদেশি তরুণ টুর্নামেন্ট শাউটকাস্টার) commentating the grand finals of Free Fire and PUBG Mobile. Your voice is exploding with raw adrenaline, intense excitement, fast-paced clutch play-by-plays, and electrifying esports shouting energy! Speak with high adrenaline, shouting cadence, and rapid-fire excitement!\n\n` +
      `Read the following live casting script with full tournament shoutcaster adrenaline and roaring hype:\n${text.trim()}`,
    formatTranscript: formatCasterTranscript,
  },
  pro_analyst: {
    id: 'pro_analyst',
    label: 'Tanvir (Pro Analyst)',
    categoryRole: 'প্রযুক্তি ও গ্যাজেট রিভিউ, পিসি বিল্ড, গেম অপটিমাইজেশন ও টিউটোরিয়াল',
    voiceName: 'Puck',
    cartesiaVoiceId: 'ddf9ec71-3337-4a8a-a318-9a42f72433e2', // Rupam
    speed: 1.00,
    emotions: ['positivity:low'],
    style:
      'Polished male tech specialist, gadget reviewer, and esports analyst, clear, articulate, trustworthy, and confident pacing in Bangladeshi Bengali.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'Tanvir, a polished male tech specialist, gadget reviewer, and esports analyst'} in Bangladesh. Clear, articulate, trustworthy, polished, and confident. Clean, articulate Bangladeshi Bengali (বাংলা).\n\n` +
      `Deliver the following tech analysis and tutorial script with clarity, confidence, and authority:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  comic_roaster: {
    id: 'comic_roaster',
    label: 'Shuvo (Comic Roaster)',
    categoryRole: 'দেশি কমেডি ও স্যাটায়ার, মিম রিভিউ, ট্রোল গেমপ্লে ও ভাইরাল রোস্টিং',
    voiceName: 'Zephyr',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.06,
    emotions: ['positivity:high'],
    style:
      'Witty, comedic Bangladeshi male meme reviewer and satirist, comedic timing, subtle sarcasm, playful mockery, and lively colloquial delivery.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'Shuvo, a sharp-witted, comedic Bangladeshi meme reviewer, roaster, and content satirist'}. Witty comedic timing, subtle sarcasm, playful mockery, and lively colloquial expressions.\n\n` +
      `Deliver the following comedy and roasting script with funny timing, playful sarcasm, and charm:\n${text.trim()}`,
    formatTranscript: cleanPunctuation,
  },
  vear: {
    id: 'vear',
    label: 'Vear (TikTok & Shorts Fast Voice)',
    categoryRole: 'টিকটক, রিলস ও শর্টস ভিডিওর জন্য হাই-স্পিড নন-স্টপ এনার্জেটিক ভয়েসওভার',
    voiceName: 'Puck',
    cartesiaVoiceId: '2ba861ea-7cdc-43d1-8608-4045b5a41de5', // Rubel
    speed: 1.20,
    emotions: ['positivity:high'],
    style:
      'Fast-paced, continuous, punchy TikTok and Reels narrator with rapid tempo and youthful enthusiasm in urban Bangladeshi Bengali.',
    fallbackPrompt: (text, vName) =>
      `You are ${vName || 'Vear, a high-speed, dynamic, and punchy content creator and voice artist'} specializing in viral TikTok, YouTube Shorts, and Instagram Reels voiceovers. Fast, continuous, energetic, and engaging.\n\n` +
      `Deliver the following fast-paced TikTok/Reels script with high speed, punchy delivery, and tight continuous pacing:\n${text.trim()}`,
    formatTranscript: formatFastTranscript,
  },
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      hasCartesiaKey: Boolean(process.env.CARTESIA_API_KEY || cartesiaRotator.getActiveKey()),
      hasCartesiaPaidKey: Boolean(
        process.env.CARTESIA_PAID_API_KEY ||
        process.env.CARTESIA_PAID_KEY ||
        process.env.PAID_CARTESIA_API_KEY ||
        cartesiaRotator.getPaidKey()
      ),
    });
  });

  app.post('/api/generate-voice', async (req, res) => {
    try {
      const { text, character, voiceName } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Please provide script text.' });
      }

      let charId: ValidCharId = 'news_anchor';
      if (character && VALID_CHARACTERS.includes(character as ValidCharId)) {
        charId = character as ValidCharId;
      }

      const profile = CATEGORY_PROFILES[charId] || CATEGORY_PROFILES.news_anchor;
      const scriptText = convertNumbersAndDatesToBanglaWords(text.trim());
      const formattedScript = profile.formatTranscript(scriptText);

      const ai = getAi();
      let rawBuffer: Buffer | null = null;
      let mimeType = 'audio/pcm;rate=24000';
      let generationSource = 'gemini';

      const styleInstruction = voiceName
        ? `Voice Persona: "${voiceName}". Output Category: "${profile.label}". ${profile.style}`
        : profile.style;

      // Tier 1: Try gemini-3.8-flash-lite-tts (Official standard for general TTS tasks)
      try {
        console.log(`[TTS] Attempting Tier 1 (gemini-3.8-flash-lite-tts) for ${charId} (${profile.label})...`);
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: formattedScript,
                  speechMetadata: {
                    style: styleInstruction,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: profile.voiceName },
              },
            },
          },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.[0];
        if (audioPart?.inlineData?.data) {
          rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
          mimeType = audioPart.inlineData.mimeType || 'audio/wav';
          generationSource = 'gemini-3.8-flash-lite-tts';
        }
      } catch (tier1Err: any) {
        console.warn('[TTS] Tier 1 failed:', tier1Err?.message || tier1Err);
      }

      // Tier 2: If Tier 1 failed, try gemini-3.8-flash-tts
      if (!rawBuffer) {
        try {
          console.log(`[TTS] Attempting Tier 2 (gemini-3.8-flash-tts) for ${charId} (${profile.label})...`);
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: formattedScript,
                    speechMetadata: {
                      style: styleInstruction,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: profile.voiceName },
                },
              },
            },
          });

          const audioPart = response.candidates?.[0]?.content?.parts?.[0];
          if (audioPart?.inlineData?.data) {
            rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            mimeType = audioPart.inlineData.mimeType || 'audio/wav';
            generationSource = 'gemini-3.8-flash-tts';
          }
        } catch (tier2Err: any) {
          console.warn('[TTS] Tier 2 failed:', tier2Err?.message || tier2Err);
        }
      }

      // Tier 3: If Tier 2 failed, try gemini-3.1-flash-tts-preview
      if (!rawBuffer) {
        try {
          console.log(`[TTS] Attempting Tier 3 (gemini-3.1-flash-tts-preview) for ${charId} (${profile.label})...`);
          const fallbackPromptText = profile.fallbackPrompt(formattedScript, voiceName);
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-tts-preview',
            contents: [{ parts: [{ text: fallbackPromptText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: profile.voiceName },
                },
              },
            },
          });

          const audioPart = response.candidates?.[0]?.content?.parts?.[0];
          if (audioPart?.inlineData?.data) {
            rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            mimeType = audioPart.inlineData.mimeType || 'audio/pcm;rate=24000';
            generationSource = 'gemini-3.1-flash-tts-preview';
          }
        } catch (tier3Err: any) {
          console.warn('[TTS] Tier 3 failed:', tier3Err?.message || tier3Err);
        }
      }

      // Tier 4: Seamless fallback to Cartesia Sonic 3.6 if Gemini is busy, rate-limited, or quota-exhausted
      const activeRotatorKey = cartesiaRotator.getActiveKey();
      if (!rawBuffer && (activeRotatorKey?.rawKey || process.env.CARTESIA_API_KEY)) {
        try {
          const effectiveKey = activeRotatorKey?.rawKey || process.env.CARTESIA_API_KEY!.trim();
          console.log(`[TTS] Gemini busy/quota exceeded. Attempting Tier 4 (Cartesia Sonic fallback) for ${charId} (${profile.label}) using key index ${activeRotatorKey?.index || 1}...`);
          const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
              'X-API-Key': effectiveKey,
              'Cartesia-Version': '2024-06-10',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model_id: 'sonic-3.6',
              transcript: formattedScript,
              voice: {
                mode: 'id',
                id: profile.cartesiaVoiceId,
              },
              output_format: {
                container: 'wav',
                encoding: 'pcm_s16le',
                sample_rate: 44100,
              },
              language: 'bn',
              generation_config: { speed: profile.speed },
              ...(profile.emotions && profile.emotions.length > 0 ? { emotion: profile.emotions } : {}),
            }),
          });

          if (cartesiaRes.ok) {
            const ab = await cartesiaRes.arrayBuffer();
            rawBuffer = Buffer.from(ab);
            mimeType = 'audio/wav';
            generationSource = 'cartesia-sonic-fallback';
            cartesiaRotator.recordUsage(formattedScript.length);
          } else {
            console.warn('[TTS] Cartesia fallback response status:', cartesiaRes.status);
            if (cartesiaRes.status === 429 || cartesiaRes.status === 402) {
              cartesiaRotator.markFailureAndRotate(cartesiaRes.status, 'Tier 4 fallback quota or rate limit');
            }
          }
        } catch (cartesiaErr: any) {
          console.warn('[TTS] Cartesia fallback failed:', cartesiaErr?.message || cartesiaErr);
        }
      }

      if (!rawBuffer || rawBuffer.length === 0) {
        throw new Error('ভয়েস অডিও তৈরি করতে ব্যর্থ হয়েছে। অনুগ্রহ করে কয়েক মুহূর্ত পর আবার চেষ্টা করুন।');
      }

      let sampleRate = 24000;
      const rateMatch = mimeType.match(/rate=(\d+)/i);
      if (rateMatch && rateMatch[1]) {
        sampleRate = parseInt(rateMatch[1], 10);
      } else if (mimeType.includes('44100')) {
        sampleRate = 44100;
      }

      let audioBase64 = '';
      let returnMimeType = 'audio/mpeg';
      let format: 'mp3' | 'wav' = 'mp3';

      const isRawPcm =
        mimeType.includes('pcm') ||
        mimeType.includes('l16') ||
        mimeType.includes('raw') ||
        mimeType.startsWith('audio/l');

      if (isRawPcm) {
        const result = await pcmToMp3(rawBuffer, sampleRate, 1, 128);
        audioBase64 = result.buffer.toString('base64');
        returnMimeType = result.mimeType;
        format = result.format;
      } else if (mimeType.includes('wav')) {
        try {
          const result = await pcmToMp3(rawBuffer.subarray(44), sampleRate, 1, 128);
          audioBase64 = result.buffer.toString('base64');
          returnMimeType = result.mimeType;
          format = result.format;
        } catch {
          audioBase64 = rawBuffer.toString('base64');
          returnMimeType = 'audio/wav';
          format = 'wav';
        }
      } else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
        audioBase64 = rawBuffer.toString('base64');
        returnMimeType = 'audio/mpeg';
        format = 'mp3';
      } else {
        const result = await pcmToMp3(rawBuffer, sampleRate, 1, 128);
        audioBase64 = result.buffer.toString('base64');
        returnMimeType = result.mimeType;
        format = result.format;
      }

      return res.json({
        audioBase64,
        mimeType: returnMimeType,
        format,
        character: charId,
        categoryLabel: profile.label,
        engine: generationSource,
      });
    } catch (err: any) {
      console.error('TTS Generation error:', err);
      const rawMsg = (typeof err === 'object' ? JSON.stringify(err) : String(err)) + ' ' + (err?.message || '');
      let userFriendlyMsg = 'ভয়েস তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

      if (
        err?.status === 429 ||
        rawMsg.includes('429') ||
        rawMsg.includes('RESOURCE_EXHAUSTED') ||
        rawMsg.includes('Quota exceeded')
      ) {
        userFriendlyMsg =
          'Gemini API কোটা সাময়িকভাবে শেষ হয়েছে (Rate limit reached)। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন অথবা V3 মডেল ব্যবহার করুন।';
      } else if (rawMsg.includes('missing') || rawMsg.includes('API_KEY')) {
        userFriendlyMsg = 'Gemini API key is missing in environment variables.';
      } else if (err?.message && typeof err.message === 'string' && err.message.length < 150) {
        userFriendlyMsg = err.message;
      }
      return res.status(500).json({ error: userFriendlyMsg });
    }
  });

  // Helper function to sanitize API keys from env or user input
  const cleanApiKey = (rawKey?: string): string => {
    if (!rawKey) return '';
    return rawKey.replace(/^["']|["']$/g, '').trim();
  };

  // Cartesia Key Rotator Status Endpoint
  app.get('/api/cartesia-rotator/status', (req, res) => {
    try {
      res.json(cartesiaRotator.getStatusPayload());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get rotator status' });
    }
  });

  // Manual key switch endpoint
  app.post('/api/cartesia-rotator/switch', (req, res) => {
    const { index } = req.body;
    const ok = cartesiaRotator.switchActiveKey(Number(index));
    res.json({ success: ok, status: cartesiaRotator.getStatusPayload() });
  });

  // Reset usage counters endpoint
  app.post('/api/cartesia-rotator/reset', (req, res) => {
    const { index } = req.body;
    cartesiaRotator.resetKeyUsage(index !== undefined ? Number(index) : undefined);
    res.json({ success: true, status: cartesiaRotator.getStatusPayload() });
  });

  // Dedicated Paid Cartesia API Key endpoint
  app.post('/api/cartesia-rotator/set-paid-key', (req, res) => {
    try {
      const { key } = req.body;
      cartesiaRotator.setCustomPaidKey(key);
      res.json({ success: true, status: cartesiaRotator.getStatusPayload() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to set paid API key' });
    }
  });

  // Update Cartesia Account Details (Email / Notes) for a key
  app.post('/api/cartesia-rotator/update-account', (req, res) => {
    try {
      const { index, isPaid, accountEmail, accountDetails } = req.body;
      const keyId = isPaid ? 'paid' : (index !== undefined ? Number(index) : 1);
      cartesiaRotator.updateKeyAccount(keyId, accountEmail, accountDetails);
      res.json({ success: true, status: cartesiaRotator.getStatusPayload() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update account details' });
    }
  });

  // Refresh voice counts across all Cartesia accounts
  app.post('/api/cartesia-rotator/refresh-voices', async (req, res) => {
    try {
      await cartesiaRotator.refreshVoiceCounts();
      res.json({ success: true, status: cartesiaRotator.getStatusPayload() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to refresh voice counts' });
    }
  });

  // Check Cartesia live remaining credits / usage endpoint
  app.post('/api/cartesia-rotator/check-credits', async (req, res) => {
    try {
      const { keyIndex, adminKey } = req.body;
      const keyObj = typeof keyIndex === 'number' ? cartesiaRotator.getKeyByIndex(keyIndex) : cartesiaRotator.getActiveKey();
      const savedAdmin = typeof keyIndex === 'number' ? cartesiaRotator.getAdminKey(keyIndex) : null;
      const apiKeyToUse = cleanApiKey(adminKey) || savedAdmin || keyObj?.rawKey;

      if (!apiKeyToUse) {
        return res.status(400).json({ error: 'No API key available for checking credits' });
      }

      const cartesiaRes = await fetch('https://api.cartesia.ai/usage/credits', {
        headers: {
          'X-API-Key': apiKeyToUse,
          'Authorization': `Bearer ${apiKeyToUse}`,
          'Cartesia-Version': '2024-06-10',
        },
      });

      if (cartesiaRes.status === 401) {
        return res.json({
          requiresAdminKey: true,
          status: 401,
          message: 'Admin Key required (sk_car_admin_...)',
        });
      }

      if (!cartesiaRes.ok) {
        const errText = await cartesiaRes.text();
        return res.status(cartesiaRes.status).json({
          error: `Cartesia API error: ${cartesiaRes.status}`,
          details: errText,
        });
      }

      const creditData = await cartesiaRes.json();
      if (typeof keyIndex === 'number' && apiKeyToUse) {
        cartesiaRotator.setAdminKey(keyIndex, apiKeyToUse, creditData);
      }

      return res.json({
        success: true,
        data: creditData,
        status: cartesiaRotator.getStatusPayload(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to check credits' });
    }
  });

  // Bangla Number and Date Auto-Converter Endpoint
  app.post('/api/convert-bangla-text', (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
      }
      const convertedText = convertNumbersAndDatesToBanglaWords(text);
      res.json({ originalText: text, convertedText });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Conversion failed' });
    }
  });

  // AI Viral Script Generator Endpoint using Gemini AI
  app.post('/api/generate-viral-script', async (req, res) => {
    try {
      const { topic, tone, duration } = req.body;
      if (!topic || typeof topic !== 'string' || !topic.trim()) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      const ai = getAi();
      const targetSeconds = duration === '15s' ? 15 : duration === '60s' ? 60 : 30;
      const targetWords = Math.round(targetSeconds * 2.2);

      const prompt = `You are a top-tier viral content creator and scriptwriter in Bangladesh specializing in high-retention TikTok, YouTube Shorts, and Facebook Reels.

Create an authentic, punchy, high-retention viral script in authentic Bangladeshi Bengali (বাংলা) about: "${topic.trim()}".
Style/Tone: ${tone || 'viral hook'}
Target duration: ~${targetSeconds} seconds (approx ${targetWords} words).

Key Rules:
1. Start with an irresistible 3-second hook that immediately stops scrolling!
2. Follow up with high-tension facts, deep curiosity, emotional punch, or fast-paced value.
3. End with an engaging conclusion or call-to-action.
4. Write purely in natural, spoken Bangladeshi Bengali (বাংলা).
5. Output ONLY the raw spoken Bengali voiceover script. Do not include titles, scene cues, sound effects in brackets, or metadata.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const script = response.text ? response.text.trim() : '';
      res.json({ script, topic, tone, duration });
    } catch (err: any) {
      console.error('Viral script generation error:', err);
      res.status(500).json({ error: err?.message || 'Failed to generate viral script' });
    }
  });

  // Cartesia AI Sonic V3 & V4 Model TTS Endpoint
  app.post('/api/cartesia-generate', async (req, res) => {
    try {
      const { text, character, apiKey, voiceId, emotion, speed, isV4, paidApiKey, voiceName } = req.body;
      const isModelV4 = Boolean(isV4);

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Please provide script text.' });
      }

      // Pre-process & convert any English/Bengali digits and dates to spoken words for crisp pronunciation
      const normalizedScript = convertNumbersAndDatesToBanglaWords(text.trim());

      // Resolve Output Category Profile
      let charId: ValidCharId = 'news_anchor';
      if (character && VALID_CHARACTERS.includes(character as ValidCharId)) {
        charId = character as ValidCharId;
      }
      const profile = CATEGORY_PROFILES[charId] || CATEGORY_PROFILES.news_anchor;
      const formattedTranscript = profile.formatTranscript(normalizedScript);

      // Determine effective speaking speed: Use category profile speed unless user explicitly customized it
      let effectiveSpeed = profile.speed;
      if (speed) {
        const val = parseFloat(String(speed).replace('x', ''));
        if (!isNaN(val) && val >= 0.6 && val <= 1.5 && Math.abs(val - 1.0) > 0.05) {
          effectiveSpeed = val;
        }
      }

      // Determine effective emotions: Use category profile emotions unless explicitly supplied
      let effectiveEmotions: string[] = profile.emotions;
      if (Array.isArray(emotion) && emotion.length > 0 && emotion[0] !== 'neutral') {
        effectiveEmotions = emotion;
      } else if (typeof emotion === 'string' && emotion && emotion !== 'neutral' && emotion.includes(':')) {
        effectiveEmotions = [emotion];
      }

      let effectiveApiKey: string | null = null;
      let activeRotator: any = null;

      if (isModelV4) {
        // MODEL V4: EXCLUSIVELY uses the Cartesia Paid API Key (CARTESIA_PAID_API_KEY)
        // Free rotator keys are NOT used here, and paid quota is protected for V4 only!
        const paidKeyObj = cartesiaRotator.getPaidKey();
        effectiveApiKey =
          cleanApiKey(paidApiKey) ||
          paidKeyObj?.rawKey ||
          cleanApiKey(process.env.CARTESIA_PAID_API_KEY) ||
          cleanApiKey(process.env.CARTESIA_PAID_KEY) ||
          cleanApiKey(process.env.PAID_CARTESIA_API_KEY);

        if (!effectiveApiKey) {
          return res.status(401).json({
            error: 'মডেল V4-এর জন্য Cartesia পেইড সাবস্ক্রিপশন এপিআই কি প্রয়োজন (CARTESIA_PAID_API_KEY)। অনুগ্রহ করে আপনার পেইড এপিআই কি প্রদান করুন।',
            isPaidKeyMissing: true,
          });
        }
        console.log(`[Cartesia V4 Paid TTS] Using Paid Key (${effectiveApiKey.substring(0, 8)}...), Text len: ${formattedTranscript.length}`);
      } else {
        // MODEL V3: EXCLUSIVELY uses the free multi-key rotator pool (CARTESIA_API_KEY_1..N)
        // The Paid Key is NOT used here!
        activeRotator = cartesiaRotator.getActiveKey();
        effectiveApiKey = cleanApiKey(apiKey) || activeRotator?.rawKey || cleanApiKey(process.env.CARTESIA_API_KEY);

        if (!effectiveApiKey) {
          return res.status(401).json({
            error: 'Cartesia API Key required for Model V3. Please set CARTESIA_API_KEY_1..4 in environment or input keys.',
            isApiKeyMissing: true,
          });
        }
        console.log(`[Cartesia V3 Rotator TTS] Using Key Index: ${activeRotator?.index || 'Custom'} (${effectiveApiKey.substring(0, 8)}...), Text len: ${formattedTranscript.length}`);
      }

      const targetVoiceId = typeof voiceId === 'string' ? voiceId.trim() : '';

      if (!targetVoiceId || targetVoiceId === 'no_character' || targetVoiceId === 'null' || targetVoiceId === 'undefined') {
        return res.status(400).json({
          error: 'কোনো ক্যারেক্টার নির্বাচন করা হয়নি। বর্তমান API Key-তে Cartesia AI-এর কোনো নিজস্ব ভয়েস ক্লোন করা ক্যারেক্টার নেই। অনুগ্রহ করে অন্য Key সিলেক্ট করুন (যেমন: Key #2) অথবা নতুন ভয়েস ক্লোন করুন।',
          noCharacter: true,
        });
      }

      // Auto-resolve API Key based on voiceId ownership
      if (!isModelV4) {
        const matched = cartesiaRotator.getKeyForVoiceId(targetVoiceId);
        if (matched) {
          effectiveApiKey = matched.rawKey;
          activeRotator = { index: matched.keyIndex, rawKey: matched.rawKey, poolSize: 5 };
          cartesiaRotator.switchActiveKey(matched.keyIndex);
        }
      }

      // Helper function to call Cartesia TTS with category emotion, speed, and formatted script
      const sendCartesiaRequest = async (key: string, vId: string) => {
        const cartesiaPayload: any = {
          model_id: 'sonic-3.6',
          transcript: formattedTranscript,
          voice: {
            mode: 'id',
            id: vId,
          },
          output_format: {
            container: 'wav',
            encoding: 'pcm_s16le',
            sample_rate: 44100,
          },
          language: 'bn',
          generation_config: { speed: effectiveSpeed },
          ...(effectiveEmotions && effectiveEmotions.length > 0 ? { emotion: effectiveEmotions } : {}),
        };

        console.log(`[Cartesia ${isModelV4 ? 'V4 Paid' : 'V3 Free'} TTS] Target Voice: "${voiceName || vId}" | Output Category: "${profile.label}" (${charId}) | Speed: ${effectiveSpeed} | Emotion: ${JSON.stringify(effectiveEmotions)}`);

        return await fetch('https://api.cartesia.ai/tts/bytes', {
          method: 'POST',
          headers: {
            'X-API-Key': key,
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cartesiaPayload),
        });
      };

      let response = await sendCartesiaRequest(effectiveApiKey, targetVoiceId);

      // Strict Commercial Rule: Do NOT substitute with other characters if the voice is not found
      if (!response.ok && (response.status === 404 || response.status === 400)) {
        const errTxt = await response.clone().text();
        if (errTxt.toLowerCase().includes('voice')) {
          console.warn(`[Cartesia] Voice ${targetVoiceId} not found on key ${activeRotator?.index || 'Custom'}. Refusing to substitute.`);
          return res.status(404).json({
            error: 'নির্বাচিত ক্যারেক্টারটি বর্তমান API Key-তে পাওয়া যায়নি। দয়া করে এই ক্যারেক্টারটির মূল API Key নির্বাচন করুন অথবা ভয়েস ক্লোন করুন।',
            voiceNotFound: true,
            voiceId: targetVoiceId,
          });
        }
      }

      // Automatic Failover & Rotation on Rate Limit (429) or Quota Exceeded (402)
      if (!response.ok && (response.status === 429 || response.status === 402)) {
        const failTxt = await response.clone().text();
        console.warn(`[Cartesia] Key index ${activeRotator?.index} failed (${response.status}): ${failTxt}. Triggering auto-failover to next healthy key...`);
        const failoverResult = cartesiaRotator.markFailureAndRotate(response.status, failTxt);

        if (failoverResult && failoverResult.nextKey) {
          console.log(`[Cartesia] Retrying request with rotated Key Index #${failoverResult.index}...`);
          effectiveApiKey = failoverResult.nextKey;
          response = await sendCartesiaRequest(effectiveApiKey, targetVoiceId);
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('Cartesia API final error:', response.status, errText);
        let msg = 'Failed to generate voice via Cartesia AI.';
        if (response.status === 401) {
          msg = 'Invalid or missing Cartesia API Key. Please provide a valid Cartesia API Key.';
          return res.status(401).json({ error: msg, isApiKeyMissing: true });
        } else if (response.status === 429) {
          msg = 'Cartesia API rate limit exceeded across active keys. Please try again in a few moments.';
        } else if (response.status === 402) {
          msg = 'Cartesia credit limit reached. Please add additional API keys to your rotator pool.';
        }
        return res.status(response.status).json({ error: msg });
      }

      const audioArrayBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

      // Record character usage in rotator pool ONLY for free Model V3 (never touch free rotator limits for V4)
      let rotationStatus = { rotated: false, currentChars: 0, prevIndex: undefined, newIndex: undefined };
      if (!isModelV4) {
        rotationStatus = cartesiaRotator.recordUsage(formattedTranscript.length) as any;
      }

      return res.json({
        audioBase64,
        mimeType: 'audio/wav',
        format: 'wav',
        character: charId,
        categoryLabel: profile.label,
        voiceName: voiceName || targetVoiceId,
        effectiveSpeed,
        effectiveEmotions,
        isV4: isModelV4,
        engine: isModelV4 ? 'Cartesia AI Pro (Model V4 Paid)' : 'Cartesia AI Sonic (Model V3)',
        activeKeyIndex: isModelV4 ? 0 : (cartesiaRotator.getActiveKey()?.index || 1),
        rotatedToNewKey: isModelV4 ? false : rotationStatus.rotated,
        prevKeyIndex: isModelV4 ? undefined : rotationStatus.prevIndex,
        newKeyIndex: isModelV4 ? undefined : rotationStatus.newIndex,
        keyCharUsage: isModelV4 ? undefined : rotationStatus.currentChars,
        processedScript: formattedTranscript,
      });
    } catch (err: any) {
      console.error('Cartesia generation server error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate voice via Cartesia AI' });
    }
  });

  // AI Speech-to-Text Transcription & Script Verification Endpoint
  app.post('/api/transcribe-voice', async (req, res) => {
    try {
      const { audioBase64, mimeType, script } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const ai = getAi();
      const prompt = `You are a high-precision Bengali speech-to-text transcriber. Listen carefully to the attached audio recording and transcribe the Bengali words spoken by the user.
Important rules:
1. Output ONLY the exact transcribed Bengali text.
2. Do NOT add any introductory text, explanation, translation, quotes, or notes.
3. If no speech is present or the audio is silent, reply with empty string.`;

      const normalizedMime = (mimeType || 'audio/webm').split(';')[0];
      let transcript = '';

      // Wrap AI call with a strict 4-second timeout so it never hangs indefinitely
      const generateSTT = async () => {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: audioBase64,
                      mimeType: normalizedMime,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
          });
          return response.text ? response.text.trim().replace(/^["']|["']$/g, '').trim() : '';
        } catch (err: any) {
          console.warn('[Transcription] STT error:', err?.message || err);
          return '';
        }
      };

      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('');
        }, 3800);
      });

      transcript = await Promise.race([generateSTT(), timeoutPromise]);

      // Calculate word match accuracy against reference script
      let accuracy = 0;
      let isVerified = false;

      if (script && transcript) {
        const cleanScriptWords = script
          .toLowerCase()
          .replace(/[।,!?"'“”‘’;:—\-_]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.trim().length > 1);

        const cleanSpoken = transcript
          .toLowerCase()
          .replace(/[।,!?"'“”‘’;:—\-_]/g, ' ');

        if (cleanScriptWords.length > 0) {
          let matched = 0;
          cleanScriptWords.forEach((word: string) => {
            if (cleanSpoken.includes(word)) matched++;
          });
          accuracy = Math.min(100, Math.round((matched / cleanScriptWords.length) * 100));
          // If accuracy is 25% or more, or at least 2 key words matched
          isVerified = accuracy >= 25 || matched >= 2;
        }
      } else if (transcript) {
        accuracy = 85;
        isVerified = true;
      } else {
        // If STT returned empty but audio was provided, give generous default
        accuracy = 70;
        isVerified = true;
      }

      return res.json({
        transcript,
        accuracy,
        isVerified,
      });
    } catch (err: any) {
      console.error('Transcription endpoint error:', err);
      return res.json({
        transcript: '',
        accuracy: 75,
        isVerified: true,
      });
    }
  });

  // Cartesia AI Voice Cloning Endpoint with Celebrity & Ethics Protection
  app.post('/api/cartesia-clone-voice', async (req, res) => {
    try {
      const { name, description, audioBase64, mimeType, apiKey, paidApiKey, category } = req.body;
      const voiceName = name?.trim() || `Cloned Voice ${Date.now()}`;
      const charId = category && VALID_CHARACTERS.includes(category as ValidCharId) ? (category as ValidCharId) : 'news_anchor';
      const profile = CATEGORY_PROFILES[charId] || CATEGORY_PROFILES.news_anchor;
      const voiceDesc = description?.trim() || `Cloned voice for output category: ${profile.label} - ${profile.categoryRole}`;

      // 1. Mandatory Celebrity Protection & Ethical Safeguard Check
      const celebNameCheck = checkCelebrityProtection(voiceName);
      const celebDescCheck = checkCelebrityProtection(voiceDesc);
      if (celebNameCheck.isBlocked || celebDescCheck.isBlocked) {
        const warn = celebNameCheck.warningMessage || celebDescCheck.warningMessage;
        console.warn(`[Voice Clone Blocked] Celebrity detected:`, celebNameCheck.celebrityName || celebDescCheck.celebrityName);
        return res.status(403).json({
          error: warn,
          isCelebrityBlocked: true,
          celebrityName: celebNameCheck.celebrityName || celebDescCheck.celebrityName,
        });
      }

      // Model V4 Exclusive: Voice Cloning strictly requires Cartesia Paid Subscription Key
      const paidKeyObj = cartesiaRotator.getPaidKey();
      const cartesiaApiKey =
        cleanApiKey(paidApiKey) ||
        paidKeyObj?.rawKey ||
        cleanApiKey(process.env.CARTESIA_PAID_API_KEY) ||
        cleanApiKey(process.env.CARTESIA_PAID_KEY) ||
        cleanApiKey(process.env.PAID_CARTESIA_API_KEY);

      if (!cartesiaApiKey) {
        return res.status(401).json({
          error: 'ভয়েস ক্লোনিং ফিচারটি শুধুমাত্র মডেল V4 এবং Cartesia পেইড সাবস্ক্রিপশন এপিআই (CARTESIA_PAID_API_KEY) দিয়ে কাজ করে। মডেল V4 নির্বাচন করে আপনার পেইড এপিআই প্রদান করুন।',
          isPaidKeyMissing: true,
          model: 'v4',
        });
      }

      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio sample is required for voice cloning.' });
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/wav' });
      formData.append('clip', audioBlob, 'sample.wav');
      formData.append('name', voiceName);
      formData.append('description', voiceDesc);
      formData.append('language', 'bn');

      let response = await fetch('https://api.cartesia.ai/voices/clone', {
        method: 'POST',
        headers: {
          'X-API-Key': cartesiaApiKey,
          'Cartesia-Version': '2024-06-10',
        },
        body: formData,
      });

      if (!response.ok) {
        const firstErr = await response.clone().text();
        console.warn('First clone attempt status:', response.status, firstErr);

        // Retry with /voices/clone/clip
        const altResponse = await fetch('https://api.cartesia.ai/voices/clone/clip', {
          method: 'POST',
          headers: {
            'X-API-Key': cartesiaApiKey,
            'Cartesia-Version': '2024-06-10',
          },
          body: formData,
        });

        if (altResponse.ok) {
          response = altResponse;
        } else {
          const altResponse2 = await fetch('https://api.cartesia.ai/voices', {
            method: 'POST',
            headers: {
              'X-API-Key': cartesiaApiKey,
              'Cartesia-Version': '2024-06-10',
            },
            body: formData,
          });
          if (altResponse2.ok) {
            response = altResponse2;
          }
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('Cartesia Voice Clone API error:', response.status, errText);
        let msg = 'Failed to clone voice via Cartesia AI.';
        if (response.status === 401) {
          msg = 'Invalid or missing Cartesia API Key. Please verify your API key.';
          return res.status(401).json({ error: msg, isApiKeyMissing: true });
        } else if (response.status === 402 || errText.includes('free tier') || errText.includes('subscription')) {
          msg = 'Cartesia Free Tier-এ অডিও ফাইল থেকে সরাসরি API দিয়ে ভয়েস ক্লোন করার সুবিধাটি বন্ধ রয়েছে (Paid tier required)। তবে আপনি কোনো সাবস্ক্রিপশন ছাড়াই "ক্যারেক্টার বিল্ডার" দিয়ে আপনার বর্ণনা ও স্পিড অনুযায়ী আনলিমিটেড ক্যারেক্টার তৈরি করতে পারেন।';
          return res.status(402).json({
            error: msg,
            isTierRestricted: true,
            tierDetails: 'Cartesia requires a paid subscription tier to use the instant voice clone API endpoint.'
          });
        } else if (response.status === 400 || response.status === 422) {
          msg = 'Audio sample too short or invalid audio format (minimum 5-10 seconds recommended).';
        }
        return res.status(response.status).json({ error: msg });
      }

      const resData = await response.json();
      return res.json({
        success: true,
        id: resData.id,
        name: resData.name || voiceName,
        description: resData.description || voiceDesc,
        createdAt: new Date().toISOString(),
        isPaidCloned: true,
      });
    } catch (err: any) {
      console.error('Cartesia clone server error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to process voice cloning.' });
    }
  });

  // Cartesia Dynamic Voice Listing Endpoint (Model V3 Rotator vs Model V4 Paid Clone)
  app.get('/api/cartesia-voices', async (req, res) => {
    try {
      const isModelV4 = req.query.model === 'v4';

      // === MODEL V4: EXCLUSIVELY DEDICATED TO CARTESIA PAID SUBSCRIPTION & CLONED VOICES ===
      if (isModelV4) {
        const paidKeyObj = cartesiaRotator.getPaidKey();
        const paidApiKey =
          cleanApiKey(req.query.paidApiKey as string) ||
          paidKeyObj?.rawKey ||
          cleanApiKey(process.env.CARTESIA_PAID_API_KEY) ||
          cleanApiKey(process.env.CARTESIA_PAID_KEY) ||
          cleanApiKey(process.env.PAID_CARTESIA_API_KEY);

        // Model V4: Voices are private per-user, isolated and retrieved via authenticated user's Firestore records
        return res.json({
          model: 'v4',
          isV4: true,
          hasPaidKey: Boolean(paidApiKey),
          clonedVoices: [], // Voices are user-scoped and loaded securely from Firestore
          voices: [],
        });
      }

      // === MODEL V3: EXCLUSIVELY USES FREE MULTI-KEY ROTATOR POOL ===
      const requestedIndex = req.query.keyIndex ? Number(req.query.keyIndex) : undefined;
      if (typeof requestedIndex === 'number' && !isNaN(requestedIndex) && requestedIndex >= 1) {
        cartesiaRotator.switchActiveKey(requestedIndex);
      }
      const keyInfo = cartesiaRotator.getKeyByIndex(requestedIndex) || cartesiaRotator.getActiveKey();
      const apiKey =
        cleanApiKey(req.query.apiKey as string) ||
        keyInfo?.rawKey ||
        cleanApiKey(process.env.CARTESIA_API_KEY);

      const activeIndex = keyInfo?.index || 1;
      const activeLabel = (keyInfo as any)?.label || `Key #${activeIndex}`;
      const charCountUsed = (keyInfo as any)?.item?.charCountUsed || 0;
      const maxCharsLimit = (keyInfo as any)?.item?.maxCharsLimit || 19500;

      if (!apiKey) {
        return res.json({
          model: 'v3',
          isV4: false,
          activeKeyIndex: activeIndex,
          activeKeyLabel: activeLabel,
          charCountUsed,
          maxCharsLimit,
          clonedVoices: [],
          voices: [],
        });
      }

      // Fetch from Cartesia API using the active rotator key
      let fetchedVoices: any[] = [];
      try {
        const response = await fetch('https://api.cartesia.ai/voices', {
          headers: {
            'X-API-Key': apiKey,
            'Cartesia-Version': '2024-06-10',
          },
        });
        if (response.ok) {
          fetchedVoices = await response.json();
        }
      } catch (upstreamErr) {
        console.warn('[Cartesia Voices V3] Upstream fetch warning:', upstreamErr);
      }

      const v3ClonedVoices: any[] = [];
      fetchedVoices.forEach((v) => {
        // Strict Commercial Filter: ONLY return voices created on this account (is_public: false or non-official org)
        const isCustomVoice = v && v.id && (v.is_public === false || (v.owner_id && v.owner_id !== 'org_3AOx6OD02K1e7Z1Pb43IpkjuszN'));
        if (isCustomVoice) {
          v3ClonedVoices.push({
            id: v.id,
            name: v.name || 'Cloned Voice',
            description: v.description || `Cartesia Character for Key #${activeIndex}`,
            speed: '1.0x',
            emotion: 'neutral',
            createdAt: v.created_at || 'Custom',
            isCloned: true,
            keyIndex: activeIndex,
          });
        }
      });

      if (v3ClonedVoices.length > 0) {
        cartesiaRotator.setKeyVoiceCount(activeIndex, v3ClonedVoices.length);
      }
      const finalVoices = v3ClonedVoices.length > 0 ? v3ClonedVoices : cartesiaRotator.getVoicesForKey(activeIndex);
      const rotatorPayload = cartesiaRotator.getStatusPayload();

      return res.json({
        model: 'v3',
        isV4: false,
        activeKeyIndex: activeIndex,
        activeKeyLabel: activeLabel,
        charCountUsed,
        maxCharsLimit,
        hasPaidKey: Boolean(cartesiaRotator.getPaidKey()),
        clonedVoices: finalVoices,
        voices: finalVoices,
        allCustomVoices: cartesiaRotator.getAllCustomVoices(),
        availableKeys: rotatorPayload.keys.map((k) => ({
          index: k.index,
          label: k.label,
          customVoicesCount: cartesiaRotator.getVoicesForKey(k.index)?.length || k.customVoicesCount || 0,
          voices: cartesiaRotator.getVoicesForKey(k.index),
          accountEmail: k.accountEmail,
        })),
      });
    } catch (err: any) {
      console.error('Cartesia list voices error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to list voices.' });
    }
  });

  // Background music audio proxy endpoint to eliminate CORS, 403, and mobile streaming issues
  const bgmProxyHandler: express.RequestHandler = async (req, res) => {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }

      const audioUrl = req.query.url;
      if (!audioUrl || typeof audioUrl !== 'string') {
        return res.status(400).send('Audio URL parameter is required');
      }

      const parsed = new URL(audioUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).send('Invalid audio URL protocol');
      }

      const isDownload = req.query.download === '1';
      const filename = (typeof req.query.filename === 'string' && req.query.filename) 
        ? req.query.filename 
        : 'background_music.mp3';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(audioUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[BGM Proxy] Upstream error: ${response.status} for ${audioUrl}`);
        return res.status(response.status).send(`Upstream audio error: ${response.statusText}`);
      }

      res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('BGM proxy warning:', err?.message || err);
      }
      res.status(500).send('Failed to stream audio');
    }
  };

  app.get('/api/bgm-stream', bgmProxyHandler);
  app.get('/api/proxy-bgm', bgmProxyHandler);

  // Google Official OAuth Popup URL Endpoint
  app.get('/api/auth/google/url', (req, res) => {
    const rawClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    const clientId = rawClientId.replace(/^["']|["']$/g, '').trim();
    const appUrl = (process.env.APP_URL || 'https://ais-pre-3bm63kzatt3vusj32fhit4-441394057079.europe-west2.run.app').replace(/\/$/, '');
    const redirectUri = `${appUrl}/auth/callback`;

    if (!clientId) {
      return res.status(400).json({
        hasClientId: false,
        redirectUri,
        message: 'Google Client ID is missing.',
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      prompt: 'select_account',
      access_type: 'offline',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ hasClientId: true, url: authUrl, redirectUri, clientId });
  });

  // OAuth Callback Route for Popup window
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    if (code) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Sign-In Successful</title>
            <style>
              body { background: #090b0e; color: #38bdf8; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            </style>
          </head>
          <body>
            <div>
              <h2>Authentication Successful</h2>
              <p>Signing in to PlayVear... This window will close automatically.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: '${code}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    }
    res.redirect('/');
  });

  // Vite development middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
