import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface KeyPoolInfo {
  id: string;
  index: number;
  label: string;
  maskedKey: string;
  source: 'env' | 'custom';
  charCountUsed: number;
  maxCharsLimit: number;
  status: 'active' | 'standby' | 'exhausted' | 'rate_limited' | 'error';
  lastUsedAt: string | null;
  errorMessage?: string;
  accountEmail?: string;
  accountDetails?: string;
  customVoicesCount?: number;
  adminKeyMasked?: string;
  cachedCredits?: any;
}

export interface RotatorStatusPayload {
  totalKeys: number;
  activeKeyIndex: number;
  totalCharsUsed: number;
  totalCapacity: number;
  remainingChars: number;
  hasPaidKey?: boolean;
  paidKey?: KeyPoolInfo | null;
  keys: KeyPoolInfo[];
}

export interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey?: string;
  onSaveApiKey?: (key: string) => void;
  paidApiKey?: string;
  onSavePaidApiKey?: (key: string) => void;
  onKeySwitched?: (newKeyIndex: number) => void;
}

function parseCredits(data: any): string {
  if (!data) return '';
  if (typeof data === 'number') return `${data.toLocaleString()} credits`;
  if (typeof data === 'string') return data;
  if (typeof data.credits === 'number') return `${data.credits.toLocaleString()} credits`;
  if (typeof data.remaining === 'number') return `$${data.remaining.toFixed(2)}`;
  if (typeof data.balance === 'number') return `$${data.balance.toFixed(2)}`;
  if (typeof data.amount === 'number') return `$${data.amount.toFixed(2)}`;
  if (data.credits) return String(data.credits);
  if (data.remaining) return String(data.remaining);
  if (data.total) return `${data.total} credits`;
  const firstVal = Object.values(data)[0];
  if (typeof firstVal === 'number' || typeof firstVal === 'string') {
    return String(firstVal);
  }
  return 'Active';
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentApiKey = '',
  onSaveApiKey,
  paidApiKey = '',
  onSavePaidApiKey,
  onKeySwitched,
}) => {
  const [poolData, setPoolData] = useState<RotatorStatusPayload | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [switchingIndex, setSwitchingIndex] = useState<number | null>(null);
  const [checkingCreditKey, setCheckingCreditKey] = useState<number | 'paid' | null>(null);

  // Per-key admin API key input states (sk_car_admin_...)
  const [adminKeys, setAdminKeys] = useState<{ [keyIndex: string]: string }>({});
  const [creditResults, setCreditResults] = useState<{ [keyIndex: string]: { text: string; isError?: boolean } }>({});

  // Paid key & custom key states
  const [paidKeyInput, setPaidKeyInput] = useState(paidApiKey);
  const [customKeyInput, setCustomKeyInput] = useState(currentApiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedPaidSuccess, setSavedPaidSuccess] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Load saved admin keys from localStorage
  const loadStoredAdminKeys = () => {
    const loaded: { [idx: string]: string } = {};
    for (let i = 0; i <= 20; i++) {
      try {
        const val = localStorage.getItem(`playvear_admin_key_${i}`);
        if (val) loaded[String(i)] = val;
      } catch (e) {
        // ignore
      }
    }
    try {
      const paidVal = localStorage.getItem(`playvear_admin_key_paid`);
      if (paidVal) loaded['paid'] = paidVal;
    } catch (e) {
      // ignore
    }
    setAdminKeys(loaded);
  };

  const fetchPoolStatus = async () => {
    setIsLoadingPool(true);
    try {
      const res = await fetch('/api/cartesia-rotator/status');
      if (res.ok) {
        const data: RotatorStatusPayload = await res.json();
        setPoolData(data);

        // Pre-populate any cached credits from backend
        const preloadedCredits: { [idx: string]: { text: string; isError?: boolean } } = {};
        if (data.keys) {
          data.keys.forEach((k) => {
            if (k.cachedCredits) {
              const parsed = parseCredits(k.cachedCredits);
              if (parsed) preloadedCredits[String(k.index)] = { text: parsed };
            }
          });
        }
        if (data.paidKey?.cachedCredits) {
          const parsedPaid = parseCredits(data.paidKey.cachedCredits);
          if (parsedPaid) preloadedCredits['paid'] = { text: parsedPaid };
        }
        setCreditResults((prev) => ({ ...preloadedCredits, ...prev }));
      }
    } catch (err) {
      console.warn('Failed to fetch admin pool status:', err);
    } finally {
      setIsLoadingPool(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStoredAdminKeys();
      fetchPoolStatus();
      setPaidKeyInput(paidApiKey);
      setCustomKeyInput(currentApiKey);
    }
  }, [isOpen, paidApiKey, currentApiKey]);

  if (!isOpen) return null;

  const handleAdminKeyChange = (indexKey: string, value: string) => {
    setAdminKeys((prev) => ({ ...prev, [indexKey]: value }));
    try {
      localStorage.setItem(`playvear_admin_key_${indexKey}`, value.trim());
    } catch (e) {
      // ignore
    }
  };

  const handleCheckCredits = async (keyIdentifier: number | 'paid') => {
    const stringKey = String(keyIdentifier);
    const adminKeyToUse = (adminKeys[stringKey] || '').trim();
    setCheckingCreditKey(keyIdentifier);

    try {
      const numericIndex = keyIdentifier === 'paid' ? 0 : keyIdentifier;
      const res = await fetch('/api/cartesia-rotator/check-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyIndex: numericIndex, adminKey: adminKeyToUse }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        const parsed = parseCredits(data.data);
        setCreditResults((prev) => ({
          ...prev,
          [stringKey]: { text: parsed || 'Active', isError: false },
        }));
        if (data.status) {
          setPoolData(data.status);
        }
      } else if (data.requiresAdminKey) {
        setCreditResults((prev) => ({
          ...prev,
          [stringKey]: { text: 'Admin Key Needed (sk_car_admin_...)', isError: true },
        }));
      } else {
        setCreditResults((prev) => ({
          ...prev,
          [stringKey]: { text: data.error || data.message || 'Error checking', isError: true },
        }));
      }
    } catch (err: any) {
      setCreditResults((prev) => ({
        ...prev,
        [stringKey]: { text: err?.message || 'Check failed', isError: true },
      }));
    } finally {
      setCheckingCreditKey(null);
    }
  };

  const handleManualSwitch = async (index: number) => {
    setSwitchingIndex(index);
    try {
      const res = await fetch('/api/cartesia-rotator/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });
      if (res.ok) {
        await fetchPoolStatus();
        onKeySwitched?.(index);
      }
    } catch (err) {
      console.warn('Switch key error:', err);
    } finally {
      setSwitchingIndex(null);
    }
  };

  const handleSavePaidKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = paidKeyInput.trim();
    onSavePaidApiKey?.(clean);
    try {
      await fetch('/api/cartesia-rotator/set-paid-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: clean }),
      });
      await fetchPoolStatus();
    } catch (e) {
      console.warn('Failed to save paid key:', e);
    }
    setSavedPaidSuccess(true);
    setTimeout(() => setSavedPaidSuccess(false), 1500);
  };

  const handleSaveCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey?.(customKeyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      fetchPoolStatus();
    }, 1200);
  };

  const sortedKeys = poolData?.keys
    ? [...poolData.keys].sort((a, b) => a.index - b.index)
    : [];

  return (
    <div
      id="admin-panel-modal-backdrop"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="admin-panel-modal"
        className="w-full max-w-2xl max-h-[90vh] bg-[#070b13] border border-cyan-500/50 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.22)] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sleek & Refined */}
        <div className="flex items-center justify-between border-b border-cyan-900/60 px-5 py-3.5 bg-[#0a101b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <ShieldCheck className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>ADMIN PANEL</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold">
                  {poolData?.totalKeys || 0} ENVS
                </span>
                {poolData?.hasPaidKey && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-950 border border-fuchsia-500 text-fuchsia-300 font-bold shadow-[0_0_8px_rgba(217,70,239,0.3)]">
                    💎 PAID READY
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchPoolStatus}
              disabled={isLoadingPool}
              className="px-2.5 py-1.5 rounded-lg text-cyan-300 hover:text-white hover:bg-cyan-950/70 border border-cyan-500/40 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              title="Refresh Environments"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPool ? 'animate-spin text-cyan-300' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-fuchsia-400 rounded-lg hover:bg-fuchsia-950/30 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - Refined, Clean, With Prominent PAID and ACTIVE Badges */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[76vh] scrollbar-thin">
          {/* 1. DEDICATED PAID API KEY CARD (With Glowing PAID Badge) */}
          {poolData?.paidKey && (
            <div className="p-3.5 rounded-xl border border-fuchsia-500/60 bg-gradient-to-r from-fuchsia-950/30 via-[#0a0d18] to-cyan-950/20 shadow-[0_0_20px_rgba(217,70,239,0.22)] flex flex-col gap-2.5">
              {/* Top Row: Paid Label, Masked Key, Characters Count, and Prominent PAID Badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.9)]" />
                  <span className="text-xs font-bold text-white font-mono tracking-wide">
                    PAID KEY
                  </span>
                  <span className="text-xs font-mono text-fuchsia-300 bg-fuchsia-950/80 px-2 py-0.5 rounded border border-fuchsia-500/40">
                    {poolData.paidKey.maskedKey}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/40 font-semibold shadow-[0_0_8px_rgba(217,70,239,0.2)]">
                    {poolData.paidKey.customVoicesCount ?? 0} Character{(poolData.paidKey.customVoicesCount ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* PROMINENT PAID BADGE */}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.6)] flex items-center gap-1">
                    💎 PAID
                  </span>
                </div>
              </div>

              {/* Middle Row: Remaining Credit & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-[#05080f] border border-fuchsia-950/80 flex items-center justify-between">
                  <span className="text-stone-400">Remaining Credit:</span>
                  <span
                    className={`font-bold ${
                      creditResults['paid']?.isError
                        ? 'text-fuchsia-400'
                        : creditResults['paid']?.text
                        ? 'text-cyan-300'
                        : 'text-stone-500'
                    }`}
                  >
                    {creditResults['paid']?.text || 'Enter Admin Key to Check'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#05080f] border border-fuchsia-950/80 flex items-center justify-between">
                  <span className="text-stone-400">Subscription Tier:</span>
                  <span className="text-fuchsia-300 font-semibold">
                    Cartesia Pro (Model V4 Enabled)
                  </span>
                </div>
              </div>

              {/* Bottom Row: Compact Admin API Key Input Option for Paid Key */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-stone-400 text-[11px] shrink-0">Admin Key:</span>
                <input
                  type="password"
                  value={adminKeys['paid'] || ''}
                  onChange={(e) => handleAdminKeyChange('paid', e.target.value)}
                  placeholder="sk_car_admin_..."
                  className="flex-1 bg-black/60 border border-fuchsia-900 focus:border-cyan-400 text-cyan-200 text-xs px-2.5 py-1 rounded outline-none font-mono placeholder:text-stone-700"
                />
                <button
                  type="button"
                  onClick={() => handleCheckCredits('paid')}
                  disabled={checkingCreditKey === 'paid'}
                  className="px-3 py-1 bg-fuchsia-500 hover:bg-fuchsia-400 active:scale-95 text-white font-bold text-xs rounded transition-all cursor-pointer shrink-0 flex items-center gap-1 shadow-[0_0_8px_rgba(217,70,239,0.3)]"
                >
                  <Zap className={`w-3 h-3 ${checkingCreditKey === 'paid' ? 'animate-spin' : ''}`} />
                  <span>{checkingCreditKey === 'paid' ? 'Checking...' : 'Check Credit'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. ENVIRONMENT ROTATOR CARDS (With Glowing ACTIVE Badge on Active Key) */}
          {sortedKeys.length > 0 ? (
            <div className="space-y-3">
              {sortedKeys.map((k) => {
                const isActive = k.index === poolData?.activeKeyIndex;
                const isPaidMatch = poolData?.paidKey && k.maskedKey === poolData.paidKey.maskedKey;
                const customCount = k.customVoicesCount ?? 0;
                const creditInfo = creditResults[String(k.index)];
                const adminKeyVal = adminKeys[String(k.index)] || '';

                return (
                  <div
                    key={k.id || k.index}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${
                      isActive
                        ? 'bg-[#09121f] border-cyan-400/80 shadow-[0_0_18px_rgba(6,182,212,0.2)]'
                        : isPaidMatch
                        ? 'bg-[#0e0a16] border-fuchsia-500/40 hover:border-fuchsia-400/60'
                        : 'bg-[#080d16] border-cyan-900/40 hover:border-cyan-500/40'
                    }`}
                  >
                    {/* Top Row: Env Number, API Key, Characters Count, Status & Switch */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive
                              ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                              : 'bg-stone-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-white font-mono tracking-wide">
                          ENV #{k.index}
                        </span>
                        <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                          {k.maskedKey}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-500/40 font-semibold shadow-[0_0_8px_rgba(217,70,239,0.2)]">
                          {customCount} Character{customCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* PROMINENT PAID BADGE (If key is Paid) */}
                        {isPaidMatch && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)] flex items-center gap-1">
                            💎 PAID
                          </span>
                        )}

                        {/* PROMINENT ACTIVE BADGE (If key is Currently Active) */}
                        {isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.7)] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.9)]" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-medium bg-stone-900 text-stone-500 border border-stone-800">
                            STANDBY
                          </span>
                        )}

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleManualSwitch(k.index)}
                            disabled={switchingIndex === k.index}
                            className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer"
                          >
                            {switchingIndex === k.index ? 'Switching...' : 'Set Active'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Remaining Credit & Capacity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-[#05080f] border border-cyan-950 flex items-center justify-between">
                        <span className="text-stone-400">Remaining Credit:</span>
                        <span
                          className={`font-bold ${
                            creditInfo?.isError
                              ? 'text-fuchsia-400'
                              : creditInfo?.text
                              ? 'text-cyan-300'
                              : 'text-stone-500'
                          }`}
                        >
                          {creditInfo?.text || 'Enter Admin Key to Check'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-[#05080f] border border-cyan-950 flex items-center justify-between">
                        <span className="text-stone-400">Safe Capacity:</span>
                        <span className="text-cyan-300 font-semibold">
                          {Math.max(0, k.maxCharsLimit - k.charCountUsed).toLocaleString()} / {k.maxCharsLimit.toLocaleString()} chars
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Compact Admin API Key Input Option */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-stone-400 text-[11px] shrink-0">Admin Key:</span>
                      <input
                        type="password"
                        value={adminKeyVal}
                        onChange={(e) => handleAdminKeyChange(String(k.index), e.target.value)}
                        placeholder="sk_car_admin_..."
                        className="flex-1 bg-black/60 border border-cyan-900 focus:border-cyan-400 text-cyan-200 text-xs px-2.5 py-1 rounded outline-none font-mono placeholder:text-stone-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleCheckCredits(k.index)}
                        disabled={checkingCreditKey === k.index}
                        className="px-3 py-1 bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-black font-bold text-xs rounded transition-all cursor-pointer shrink-0 flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                      >
                        <Zap className={`w-3 h-3 ${checkingCreditKey === k.index ? 'animate-spin' : ''}`} />
                        <span>{checkingCreditKey === k.index ? 'Checking...' : 'Check Credit'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-[#080d16] rounded-xl border border-cyan-900/50 text-xs text-cyan-400/80 text-center font-mono">
              No environment keys found. Set CARTESIA_API_KEY_1..4 in AI Studio Secrets.
            </div>
          )}

          {/* Toggle Compact Settings for Paid Key & Custom Key */}
          <div className="pt-2 border-t border-cyan-950">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              {showConfig ? 'Hide Additional Key Config' : '+ Additional Key Config (Paid Key / Custom Key)'}
            </button>

            {showConfig && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#080d16] border border-cyan-950 space-y-2.5">
                {/* Paid Key Row */}
                <form onSubmit={handleSavePaidKey} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-fuchsia-400 text-[11px] shrink-0 font-semibold">Paid Key:</span>
                  <input
                    type="password"
                    value={paidKeyInput}
                    onChange={(e) => setPaidKeyInput(e.target.value)}
                    placeholder="CARTESIA_PAID_API_KEY"
                    className="flex-1 bg-black/60 border border-fuchsia-900 focus:border-fuchsia-400 text-stone-200 text-xs px-2.5 py-1 rounded outline-none font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold text-xs rounded cursor-pointer shrink-0"
                  >
                    {savedPaidSuccess ? 'Saved!' : 'Save'}
                  </button>
                </form>

                {/* Custom Key Row */}
                <form onSubmit={handleSaveCustomKey} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-cyan-400 text-[11px] shrink-0 font-semibold">Custom Key:</span>
                  <input
                    type="password"
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    placeholder="sk_car_..."
                    className="flex-1 bg-black/60 border border-cyan-900 focus:border-cyan-400 text-cyan-200 text-xs px-2.5 py-1 rounded outline-none font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded cursor-pointer shrink-0"
                  >
                    {savedSuccess ? 'Saved!' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
