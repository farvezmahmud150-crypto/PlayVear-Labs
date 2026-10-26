/**
 * Cartesia API Key Pool & Auto-Rotator with Intelligent Failover
 * Supports dynamic environment keys (CARTESIA_API_KEY_1..N, CARTESIA_API_KEYS, CARTESIA_API_KEY),
 * client-provided keys, character usage tracking, and automatic failover on 429/402 quota exhaustion.
 */

export interface KeyPoolItem {
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

class CartesiaKeyRotator {
  private keys: {
    rawKey: string;
    item: KeyPoolItem;
  }[] = [];

  private paidKey: {
    rawKey: string;
    item: KeyPoolItem;
  } | null = null;

  // In-memory / persistent account details map keyed by index or 'paid'
  private accountDetailsMap: Map<string, { email: string; details?: string }> = new Map();

  // Admin Keys map for querying Cartesia live credits
  private adminKeysMap: Map<number, { rawKey: string; cachedCredits?: any }> = new Map();

  // Real Cartesia custom cloned characters per key (verified live upstream)
  private keyVoicesMap: Map<number | 'paid', any[]> = new Map([
    [
      1,
      [
        {
          id: 'f92ce4de-5fdd-4f5f-af20-4b229f2f2d99',
          name: 'Vear',
          description: 'Tiktok, reels, shorts video voice over with high speed',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 1,
        },
        {
          id: '0999f697-d565-4016-8842-081575716442',
          name: 'Bountry',
          description: 'অত্যন্ত সুন্দর নিখুত ভাবে বর্ণনা করতে পারে সবকিছু এবং ইমোশন কন্ট্রোল সহ',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 1,
        },
        {
          id: '2a465f1e-10bc-4c90-be83-0bc7499e3635',
          name: 'Parvez',
          description: 'Amr',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 1,
        },
      ],
    ],
    [
      2,
      [
        {
          id: '8261a91a-7c0f-4b0b-84f0-e2676d6ba64e',
          name: 'Vear',
          description: 'Cartesia Character for Key #2',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 2,
        },
        {
          id: 'a3ed4c79-0235-4dff-bb83-82c3ad61f5b8',
          name: 'Bounty',
          description: 'Cartesia Character for Key #2',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 2,
        },
      ],
    ],
    [
      3,
      [
        {
          id: 'bb1b0ee4-09d0-4437-9dff-6c55f0fd6eeb',
          name: 'Bounty',
          description: 'Cartesia Character for Key #3',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 3,
        },
        {
          id: '22176ece-1f32-4966-a08c-cb6aaa04687d',
          name: 'Vear',
          description: 'Cartesia Character for Key #3',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 3,
        },
      ],
    ],
    [
      4,
      [
        {
          id: '4dc36f2a-b9db-4398-96cb-f8186b5aa4f9',
          name: 'Vear',
          description: 'Cartesia Character for Key #4',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 4,
        },
        {
          id: 'b057faf6-665e-464f-b848-303bd44c0e6a',
          name: 'Bounty',
          description: 'Cartesia Character for Key #4',
          speed: '1.0x',
          emotion: 'neutral',
          isCloned: true,
          keyIndex: 4,
        },
      ],
    ],
  ]);

  private activeKeyIndex: number = 0;
  private readonly DEFAULT_LIMIT = 19500; // Auto-rotate threshold at 19,500 chars (safe under 20k free quota)

  constructor() {
    this.reloadEnvironmentKeys();
    // Async refresh custom voices from Cartesia API
    this.refreshVoiceCounts().catch((err) => console.warn('Initial voice refresh warning:', err));
  }

  /**
   * Discovers all CARTESIA_PAID_API_KEY, CARTESIA_API_KEY_1..N, CARTESIA_API_KEYS, and CARTESIA_API_KEY from process.env
   */
  public reloadEnvironmentKeys(clientCustomKeys: string[] = [], customPaidKey?: string) {
    // 0. Detect Dedicated Cartesia Paid Key (CARTESIA_PAID_API_KEY)
    const paidEnvKey =
      (customPaidKey && customPaidKey.trim().length > 10 ? customPaidKey.trim() : null) ||
      process.env.CARTESIA_PAID_API_KEY?.trim() ||
      process.env.CARTESIA_PAID_KEY?.trim() ||
      process.env.PAID_CARTESIA_API_KEY?.trim() ||
      null;

    const paidAccountEmail =
      this.accountDetailsMap.get('paid')?.email ||
      process.env.CARTESIA_PAID_ACCOUNT_EMAIL?.trim() ||
      process.env.CARTESIA_PAID_EMAIL?.trim() ||
      process.env.CARTESIA_PAID_ACCOUNT?.trim() ||
      'cartesia.paid@account.com';

    if (paidEnvKey && paidEnvKey.length > 10) {
      this.paidKey = {
        rawKey: paidEnvKey,
        item: {
          id: 'cartesia_paid_key',
          index: 0,
          label: '💎 Cartesia Paid API (Voice Clone Enabled)',
          maskedKey: this.maskKey(paidEnvKey),
          source: 'env',
          charCountUsed: this.paidKey?.item.charCountUsed || 0,
          maxCharsLimit: 1000000, // Unlimited / High Pro capacity
          status: 'active',
          lastUsedAt: this.paidKey?.item.lastUsedAt || null,
          accountEmail: paidAccountEmail,
          accountDetails: this.accountDetailsMap.get('paid')?.details || 'Model V4 Dedicated Paid Account',
          customVoicesCount: this.paidKey?.item.customVoicesCount ?? 0,
        },
      };
    }

    const rawFound: { key: string; label: string; source: 'env' | 'custom' }[] = [];

    // 1. Check primary CARTESIA_API_KEY or CARTESIA_API_KEY_1
    // CARTESIA_API_KEY holds the user's primary account with cloned characters (Vear, Bountry, Parvez)
    const primaryKey = process.env.CARTESIA_API_KEY?.trim() || process.env.CARTESIA_API_KEY_1?.trim();
    if (primaryKey && primaryKey.length > 10) {
      rawFound.push({
        key: primaryKey,
        label: `Key #1 (Cartesia Account #1)`,
        source: 'env',
      });
    }

    // 2. Check indexed CARTESIA_API_KEY_2 to CARTESIA_API_KEY_20
    for (let i = 2; i <= 20; i++) {
      const val = process.env[`CARTESIA_API_KEY_${i}`];
      if (val && val.trim().length > 10 && !rawFound.some((r) => r.key === val.trim())) {
        rawFound.push({
          key: val.trim(),
          label: `Key #${i} (Cartesia Account #${i})`,
          source: 'env',
        });
      }
    }

    // 4. Check comma-separated CARTESIA_API_KEYS
    if (process.env.CARTESIA_API_KEYS) {
      const split = process.env.CARTESIA_API_KEYS.split(',');
      split.forEach((k, idx) => {
        const clean = k.trim();
        if (clean.length > 10 && !rawFound.some((r) => r.key === clean)) {
          rawFound.push({
            key: clean,
            label: `Key #CSV-${idx + 1} (CARTESIA_API_KEYS)`,
            source: 'env',
          });
        }
      });
    }

    // 4. Client-provided custom keys
    clientCustomKeys.forEach((k, idx) => {
      const clean = k.trim();
      if (clean.length > 10 && !rawFound.some((r) => r.key === clean)) {
        rawFound.push({
          key: clean,
          label: `Custom Key #${idx + 1}`,
          source: 'custom',
        });
      }
    });

    // Merge with existing state so we don't lose character count counters
    const newKeysList: { rawKey: string; item: KeyPoolItem }[] = [];

    rawFound.forEach((entry, idx) => {
      const existing = this.keys.find((k) => k.rawKey === entry.key);
      const masked = this.maskKey(entry.key);
      const keyIndex = idx + 1;
      const accountEmail =
        this.accountDetailsMap.get(String(keyIndex))?.email ||
        existing?.item.accountEmail ||
        process.env[`CARTESIA_ACCOUNT_EMAIL_${keyIndex}`]?.trim() ||
        process.env[`CARTESIA_EMAIL_${keyIndex}`]?.trim() ||
        process.env[`CARTESIA_ACCOUNT_${keyIndex}`]?.trim() ||
        `cartesia.acc${keyIndex}@account.com`;
      const accountDetails =
        this.accountDetailsMap.get(String(keyIndex))?.details ||
        existing?.item.accountDetails ||
        `Cartesia Account for Key #${keyIndex}`;

      const adminKeyEntry = this.adminKeysMap.get(keyIndex);
      const envAdminKey = process.env[`CARTESIA_ADMIN_API_KEY_${keyIndex}`] || process.env[`CARTESIA_ADMIN_KEY_${keyIndex}`];
      const adminMasked = adminKeyEntry?.rawKey
        ? this.maskKey(adminKeyEntry.rawKey)
        : envAdminKey
        ? this.maskKey(envAdminKey)
        : existing?.item.adminKeyMasked;
      const cachedCredits = adminKeyEntry?.cachedCredits || existing?.item.cachedCredits;

      const knownVoices = this.keyVoicesMap.get(keyIndex) || [];
      const customCount = knownVoices.length > 0 ? knownVoices.length : (existing?.item.customVoicesCount ?? 0);

      if (existing) {
        newKeysList.push({
          rawKey: entry.key,
          item: {
            ...existing.item,
            index: keyIndex,
            label: entry.label,
            maskedKey: masked,
            accountEmail,
            accountDetails,
            customVoicesCount: customCount,
            adminKeyMasked: adminMasked,
            cachedCredits: cachedCredits,
          },
        });
      } else {
        newKeysList.push({
          rawKey: entry.key,
          item: {
            id: `key_${keyIndex}_${Date.now()}`,
            index: keyIndex,
            label: entry.label,
            maskedKey: masked,
            source: entry.source,
            charCountUsed: 0,
            maxCharsLimit: this.DEFAULT_LIMIT,
            status: idx === 0 ? 'active' : 'standby',
            lastUsedAt: null,
            accountEmail,
            accountDetails,
            customVoicesCount: customCount,
            adminKeyMasked: adminMasked,
            cachedCredits: cachedCredits,
          },
        });
      }
    });

    this.keys = newKeysList;

    // Ensure valid active index
    if (this.activeKeyIndex >= this.keys.length) {
      this.activeKeyIndex = 0;
    }

    this.syncActiveKeyStatus();
  }

  private maskKey(key: string): string {
    if (!key || key.length < 10) return 'sk_car_***';
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  }

  private syncActiveKeyStatus() {
    this.keys.forEach((k, idx) => {
      if (k.item.status !== 'exhausted' && k.item.status !== 'rate_limited' && k.item.status !== 'error') {
        k.item.status = idx === this.activeKeyIndex ? 'active' : 'standby';
      }
    });
  }

  /**
   * Get the best available API key from the pool
   */
  public getActiveKey(): { rawKey: string; index: number; poolSize: number } | null {
    if (this.keys.length === 0) {
      this.reloadEnvironmentKeys();
    }
    if (this.keys.length === 0) {
      return null;
    }

    // Check if current active key is healthy
    const current = this.keys[this.activeKeyIndex];
    if (
      current &&
      current.item.status !== 'exhausted' &&
      current.item.status !== 'rate_limited' &&
      current.item.charCountUsed < current.item.maxCharsLimit - 100
    ) {
      return {
        rawKey: current.rawKey,
        index: this.activeKeyIndex + 1,
        poolSize: this.keys.length,
      };
    }

    // Search for next available healthy key
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.activeKeyIndex + 1 + i) % this.keys.length;
      const candidate = this.keys[idx];
      if (
        candidate.item.status !== 'exhausted' &&
        candidate.item.status !== 'rate_limited' &&
        candidate.item.charCountUsed < candidate.item.maxCharsLimit - 100
      ) {
        this.activeKeyIndex = idx;
        this.syncActiveKeyStatus();
        console.log(`[KeyRotator] Switched active key to Index #${idx + 1} (${candidate.item.label})`);
        return {
          rawKey: candidate.rawKey,
          index: idx + 1,
          poolSize: this.keys.length,
        };
      }
    }

    // If all are exhausted or nearing limit, fall back to current active key anyway
    return {
      rawKey: this.keys[this.activeKeyIndex].rawKey,
      index: this.activeKeyIndex + 1,
      poolSize: this.keys.length,
    };
  }

  /**
   * Get specific key info by 1-based index or the currently active key
   */
  public getKeyByIndex(index?: number): { rawKey: string; index: number; label: string; item: KeyPoolItem } | null {
    if (this.keys.length === 0) {
      this.reloadEnvironmentKeys();
    }
    if (this.keys.length === 0) return null;

    if (index === 0 && this.paidKey) {
      return {
        rawKey: this.paidKey.rawKey,
        index: 0,
        label: this.paidKey.item.label,
        item: { ...this.paidKey.item },
      };
    }

    const targetIdx =
      typeof index === 'number' && index >= 1 && index <= this.keys.length
        ? index - 1
        : this.activeKeyIndex;

    const k = this.keys[targetIdx] || this.keys[0];
    return {
      rawKey: k.rawKey,
      index: targetIdx + 1,
      label: k.item.label,
      item: { ...k.item },
    };
  }

  /**
   * Record character usage after successful synthesis and auto-rotate when reaching 19,500 chars
   */
  public recordUsage(usedChars: number): { rotated: boolean; prevIndex?: number; newIndex?: number; currentChars: number } {
    if (this.keys.length === 0) return { rotated: false, currentChars: 0 };
    const current = this.keys[this.activeKeyIndex];
    if (!current) return { rotated: false, currentChars: 0 };

    current.item.charCountUsed += usedChars;
    current.item.lastUsedAt = new Date().toISOString();

    const ROTATION_THRESHOLD = 19500;
    // When characters reach 19,500 (approaching 20,000 free quota), auto-advance to next healthy key
    if (current.item.charCountUsed >= ROTATION_THRESHOLD) {
      console.warn(
        `[KeyRotator] Key #${this.activeKeyIndex + 1} reached ${current.item.charCountUsed} characters (limit: ${ROTATION_THRESHOLD})! Auto-advancing to next key...`
      );
      current.item.status = 'exhausted';
      const prevIdx = this.activeKeyIndex + 1;
      const next = this.advanceToNextHealthyKey();
      return {
        rotated: true,
        prevIndex: prevIdx,
        newIndex: next?.index || this.activeKeyIndex + 1,
        currentChars: current.item.charCountUsed,
      };
    }

    return {
      rotated: false,
      currentChars: current.item.charCountUsed,
    };
  }

  /**
   * Mark current key as failed due to rate limit (429) or quota exceeded (402)
   * and immediately rotate to next available key
   */
  public markFailureAndRotate(status: number, errorMsg: string): { nextKey: string; index: number } | null {
    if (this.keys.length === 0) return null;

    const current = this.keys[this.activeKeyIndex];
    if (current) {
      if (status === 402 || errorMsg.includes('subscription') || errorMsg.includes('free tier') || errorMsg.includes('quota')) {
        current.item.status = 'exhausted';
      } else if (status === 429) {
        current.item.status = 'rate_limited';
      } else {
        current.item.status = 'error';
      }
      current.item.errorMessage = errorMsg;
      console.warn(`[KeyRotator] Key #${this.activeKeyIndex + 1} flagged as ${current.item.status} (${status}): ${errorMsg}`);
    }

    return this.advanceToNextHealthyKey();
  }

  private advanceToNextHealthyKey(): { nextKey: string; index: number } | null {
    for (let i = 1; i <= this.keys.length; i++) {
      const nextIdx = (this.activeKeyIndex + i) % this.keys.length;
      const candidate = this.keys[nextIdx];
      if (candidate.item.status !== 'exhausted' && candidate.item.status !== 'rate_limited') {
        this.activeKeyIndex = nextIdx;
        this.syncActiveKeyStatus();
        console.log(`[KeyRotator] Successfully rotated to Key #${nextIdx + 1}: ${candidate.item.maskedKey}`);
        return {
          nextKey: candidate.rawKey,
          index: nextIdx + 1,
        };
      }
    }
    // If all are marked failed, cycle to next anyway to allow retry
    this.activeKeyIndex = (this.activeKeyIndex + 1) % this.keys.length;
    this.syncActiveKeyStatus();
    return {
      nextKey: this.keys[this.activeKeyIndex].rawKey,
      index: this.activeKeyIndex + 1,
    };
  }

  /**
   * Reset usage counter for a specific key or all keys (e.g. after monthly billing reset)
   */
  public resetKeyUsage(index?: number) {
    if (typeof index === 'number' && this.keys[index - 1]) {
      const k = this.keys[index - 1];
      k.item.charCountUsed = 0;
      k.item.status = (index - 1 === this.activeKeyIndex) ? 'active' : 'standby';
      delete k.item.errorMessage;
    } else {
      this.keys.forEach((k, idx) => {
        k.item.charCountUsed = 0;
        k.item.status = idx === this.activeKeyIndex ? 'active' : 'standby';
        delete k.item.errorMessage;
      });
    }
  }

  /**
   * Switch active key manually
   */
  public switchActiveKey(index: number): boolean {
    if (index >= 1 && index <= this.keys.length) {
      this.activeKeyIndex = index - 1;
      this.syncActiveKeyStatus();
      return true;
    }
    return false;
  }

  /**
   * Get dedicated paid key if available
   */
  public getPaidKey(): { rawKey: string; item: KeyPoolItem } | null {
    if (!this.paidKey) {
      this.reloadEnvironmentKeys();
    }
    return this.paidKey;
  }

  /**
   * Set custom paid API key from client or UI settings
   */
  public setCustomPaidKey(key: string) {
    const clean = key ? key.trim() : '';
    if (clean.length > 10) {
      const paidAccountEmail =
        this.accountDetailsMap.get('paid')?.email ||
        process.env.CARTESIA_PAID_ACCOUNT_EMAIL?.trim() ||
        'cartesia.paid@account.com';
      this.paidKey = {
        rawKey: clean,
        item: {
          id: 'cartesia_paid_key',
          index: 0,
          label: '💎 Cartesia Paid API (Voice Clone Enabled)',
          maskedKey: this.maskKey(clean),
          source: 'custom',
          charCountUsed: 0,
          maxCharsLimit: 1000000,
          status: 'active',
          lastUsedAt: null,
          accountEmail: paidAccountEmail,
          accountDetails: this.accountDetailsMap.get('paid')?.details || 'Model V4 Dedicated Paid Account',
          customVoicesCount: 0,
        },
      };
    } else {
      this.paidKey = null;
    }
  }

  /**
   * Update Cartesia account details (Email & Notes) for a specific key
   */
  public updateKeyAccount(keyIdentifier: number | 'paid', email: string, details?: string) {
    const cleanEmail = email ? email.trim() : '';
    const cleanDetails = details ? details.trim() : '';
    const mapKey = String(keyIdentifier);

    this.accountDetailsMap.set(mapKey, { email: cleanEmail, details: cleanDetails });

    if (keyIdentifier === 'paid' || keyIdentifier === 0) {
      if (this.paidKey) {
        this.paidKey.item.accountEmail = cleanEmail;
        if (cleanDetails) this.paidKey.item.accountDetails = cleanDetails;
      }
    } else {
      const target = this.keys.find((k) => k.item.index === keyIdentifier);
      if (target) {
        target.item.accountEmail = cleanEmail;
        if (cleanDetails) target.item.accountDetails = cleanDetails;
      }
    }
  }

  /**
   * Set and cache Admin API Key (sk_car_admin_...) and live credit info for a key
   */
  public setAdminKey(keyIndex: number, adminKey: string, creditsData?: any) {
    const cleanAdminKey = adminKey ? adminKey.trim() : '';
    if (cleanAdminKey) {
      this.adminKeysMap.set(keyIndex, { rawKey: cleanAdminKey, cachedCredits: creditsData });
      const target = this.keys.find((k) => k.item.index === keyIndex);
      if (target) {
        target.item.adminKeyMasked = this.maskKey(cleanAdminKey);
        if (creditsData) target.item.cachedCredits = creditsData;
      }
    }
  }

  public getAdminKey(keyIndex: number): string | null {
    const found = this.adminKeysMap.get(keyIndex);
    if (found?.rawKey) return found.rawKey;
    const envVal = process.env[`CARTESIA_ADMIN_API_KEY_${keyIndex}`] || process.env[`CARTESIA_ADMIN_KEY_${keyIndex}`];
    return envVal?.trim() || null;
  }

  /**
   * Update cached custom voices count for a key
   */
  public setKeyVoiceCount(keyIdentifier: number | 'paid', count: number) {
    if (keyIdentifier === 'paid' || keyIdentifier === 0) {
      if (this.paidKey) {
        this.paidKey.item.customVoicesCount = Math.max(0, count);
      }
    } else {
      const target = this.keys.find((k) => k.item.index === keyIdentifier);
      if (target) {
        target.item.customVoicesCount = Math.max(0, count);
      }
    }
  }

  /**
   * Refresh custom voices count for all active keys by querying Cartesia API
   */
  public async refreshVoiceCounts(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    // 1. Check all pool keys
    for (const keyObj of this.keys) {
      try {
        const res = await fetch('https://api.cartesia.ai/voices', {
          headers: {
            'X-API-Key': keyObj.rawKey,
            'Cartesia-Version': '2024-06-10',
          },
        });
        if (res.ok) {
          const list: any[] = await res.json();
          const customVoices = list
            .filter((v) => v && v.id && (v.is_public === false || (v.owner_id && v.owner_id !== 'org_3AOx6OD02K1e7Z1Pb43IpkjuszN')))
            .map((v) => ({
              id: v.id,
              name: v.name || 'Cloned Voice',
              description: v.description || `Cartesia Character for Key #${keyObj.item.index}`,
              speed: '1.0x',
              emotion: 'neutral',
              createdAt: v.created_at || 'Custom',
              isCloned: true,
              keyIndex: keyObj.item.index,
            }));
          if (customVoices.length > 0) {
            this.keyVoicesMap.set(keyObj.item.index, customVoices);
          }
          const finalCount = this.keyVoicesMap.get(keyObj.item.index)?.length || customVoices.length;
          keyObj.item.customVoicesCount = finalCount;
          results[String(keyObj.item.index)] = finalCount;
        }
      } catch (err) {
        console.warn(`[KeyRotator] Voice count check error for Key #${keyObj.item.index}:`, err);
      }
    }

    // 2. Check Paid Key
    if (this.paidKey) {
      try {
        const res = await fetch('https://api.cartesia.ai/voices', {
          headers: {
            'X-API-Key': this.paidKey.rawKey,
            'Cartesia-Version': '2024-06-10',
          },
        });
        if (res.ok) {
          const list: any[] = await res.json();
          const customVoices = list
            .filter((v) => v && v.id && (v.is_public === false || (v.owner_id && v.owner_id !== 'org_3AOx6OD02K1e7Z1Pb43IpkjuszN')))
            .map((v) => ({
              id: v.id,
              name: `💎 ${v.name || 'Cloned Voice'}`,
              description: v.description || 'Cartesia V4 Paid Cloned Character',
              speed: '1.0x',
              emotion: 'neutral',
              createdAt: v.created_at || 'Paid Cloned',
              isCloned: true,
              isPaidCloned: true,
              isV4: true,
            }));
          if (customVoices.length > 0) {
            this.keyVoicesMap.set('paid', customVoices);
          }
          const finalCount = this.keyVoicesMap.get('paid')?.length || customVoices.length;
          this.paidKey.item.customVoicesCount = finalCount;
          results['paid'] = finalCount;
        }
      } catch (pErr) {
        console.warn('[KeyRotator] Voice count check error for Paid Key:', pErr);
      }
    }

    return results;
  }

  /**
   * Get cloned voices for a specific key index
   */
  public getVoicesForKey(index: number | 'paid'): any[] {
    return this.keyVoicesMap.get(index) || [];
  }

  /**
   * Get all custom cloned voices across all keys
   */
  public getAllCustomVoices(): any[] {
    const all: any[] = [];
    for (const voices of this.keyVoicesMap.values()) {
      all.push(...voices);
    }
    return all;
  }

  /**
   * Locate the exact key that owns a given voiceId
   */
  public getKeyForVoiceId(voiceId: string): { rawKey: string; keyIndex: number; voice: any } | null {
    if (!voiceId) return null;
    for (const [kIdx, voices] of this.keyVoicesMap.entries()) {
      const foundVoice = voices.find((v) => v.id === voiceId);
      if (foundVoice) {
        if (kIdx === 'paid' && this.paidKey) {
          return { rawKey: this.paidKey.rawKey, keyIndex: 0, voice: foundVoice };
        }
        if (typeof kIdx === 'number' && this.keys[kIdx - 1]) {
          return { rawKey: this.keys[kIdx - 1].rawKey, keyIndex: kIdx, voice: foundVoice };
        }
      }
    }
    return null;
  }

  /**
   * Returns public status payload safe for client-side display
   */
  public getStatusPayload() {
    const totalCharsUsed = this.keys.reduce((acc, k) => acc + k.item.charCountUsed, 0);
    const totalCapacity = this.keys.length * this.DEFAULT_LIMIT;
    const remainingChars = Math.max(0, totalCapacity - totalCharsUsed);

    return {
      totalKeys: this.keys.length,
      activeKeyIndex: this.activeKeyIndex + 1,
      totalCharsUsed,
      totalCapacity,
      remainingChars,
      hasPaidKey: Boolean(this.paidKey),
      paidKey: this.paidKey ? { ...this.paidKey.item } : null,
      keys: this.keys.map((k) => ({
        ...k.item,
        customVoicesCount: this.keyVoicesMap.get(k.item.index)?.length || k.item.customVoicesCount || 0,
      })),
    };
  }
}

export const cartesiaRotator = new CartesiaKeyRotator();
