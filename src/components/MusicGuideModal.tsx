import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Music, ShieldCheck, Youtube, Video, Info, Sparkles, CheckCircle2 } from 'lucide-react';

interface MusicGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicGuideModal: React.FC<MusicGuideModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-[#131722] border border-stone-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-800 bg-[#171c2b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                ব্যাকগ্রাউন্ড মিউজিক ও লাইসেন্স নির্দেশিকা
              </h2>
              <p className="text-xs text-stone-400">
                YouTube, Facebook, TikTok ও Reels-এ ১০০% কপিরাইট-ফ্রি ব্যবহার গাইড
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-300">
          {/* Safe Badge */}
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-emerald-300">কপিরাইট মুক্ত ও নিরাপদ (Royalty-Free)</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                অ্যাপের সকল ব্যাকগ্রাউন্ড মিউজিক Creative Commons (CC-BY) এবং রয়্যালটি-ফ্রি লাইসেন্সের অন্তর্ভুক্ত। আপনি বাণিজ্যিক (Commercial) এবং ব্যক্তিগত যেকোনো ভিডিওতে কোনো স্ট্রাইক বা ক্লেম ছাড়াই ব্যবহার করতে পারবেন।
              </p>
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> কোন কোন প্ল্যাটফর্মে ব্যবহার করতে পারবেন?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#1a2030] border border-stone-800 flex items-center gap-3">
                <Youtube className="w-5 h-5 text-red-400" />
                <div>
                  <div className="font-medium text-white text-xs">YouTube & Shorts</div>
                  <div className="text-[11px] text-stone-400">মনিটাইজেশন সহ ১০০% নিরাপদ</div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#1a2030] border border-stone-800 flex items-center gap-3">
                <Video className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="font-medium text-white text-xs">Facebook & Reels</div>
                  <div className="text-[11px] text-stone-400">কোনো মিউজিক মিউট হবে না</div>
                </div>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> প্রো-টিপস ও ভলিউম ব্যালেন্স
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>অটো-ডাকিং সুবিধা:</strong> মিউজিক মিক্স করার সময় ভয়েসের সাথে বিজিএম স্বয়ংক্রিয়ভাবে ব্যালেন্সড হয়ে যায় যাতে কণ্ঠ স্পষ্ট শোনা যায়।
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>ডেসক্রিপশনে ক্রেডিট (ঐচ্ছিক কিন্তু প্রশংসনীয়):</strong> ইউটিউব ভিডিওর ডেসক্রিপশনে <em>"Music by Kevin MacLeod (incompetech.com)"</em> দিলে ক্রিয়েটিভ কমন্স কমপ্লায়েন্স নিশ্চিত থাকে।
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-[#171c2b] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            বুঝেছি (Close)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
