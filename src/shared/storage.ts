import type { EmailData, AuthTokens } from './types';

// ============================================================================
// BASE STORAGE UTILITIES
// ============================================================================

async function storageGet<T = any>(keys: string | string[] | null = null): Promise<T> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result as T));
    });
}

async function storageSet(items: Record<string, any>): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set(items, () => resolve());
    });
}

async function storageRemove(keys: string | string[]): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(keys, () => resolve());
    });
}

async function storageRemoveByPrefix(prefix: string): Promise<number> {
    const all = await storageGet(null);
    const keysToRemove = Object.keys(all).filter(key => key.startsWith(prefix));

    if (keysToRemove.length > 0) {
        await storageRemove(keysToRemove);
    }

    return keysToRemove.length;
}

// ============================================================================
// AUTH STORAGE
// ============================================================================

const AUTH_KEYS = ['jwt', 'refreshToken', 'tokenExpiry', 'user']

export async function getAuthData(): Promise<AuthTokens | null> {
    const result = await storageGet<AuthTokens>(AUTH_KEYS);

    if (!result.jwt || !result.refreshToken) {
        return null;
    }

    return result;
}

export async function setAuthData(data: Partial<AuthTokens>): Promise<void> {
    await storageSet(data);
}

export async function clearAuthData(): Promise<void> {
    await storageRemove(AUTH_KEYS);
    console.log('[Storage] Auth data cleared');
}

export async function getJwtToken(): Promise<string | null> {
    const authData = await getAuthData();
    return authData?.jwt || null;
}

export async function getUserData(): Promise<any | null> {
    const result = await storageGet<{ user?: any }>(['user']);
    return result.user || null;
}

// ============================================================================
// EMAIL CACHE STORAGE
// ============================================================================

const CACHE_PREFIX = 'email_cache_';
const CACHE_CURRENT_KEY = 'email_cache_current';
const MAX_CACHE_AGE = 5 * 60 * 1000;

interface CachedEmail {
    emailData: EmailData;
    timestamp: number;
    url: string;
}

interface CurrentCacheEntry {
    key: string;
    url: string;
}

function generateCacheKey(url: string, emailId?: string): string {
    if (emailId) {
        return emailId;
    }

    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const hash = urlObj.hash;

        if (url.includes('mail.google.com')) {
            const messageMatch = hash.match(/[#\/]([a-zA-Z0-9]+)$/);
            if (messageMatch) {
                return `gmail_${messageMatch[1]}`;
            }
        }

        if (url.includes('outlook')) {
            const searchParams = new URLSearchParams(urlObj.search);
            const paramId = searchParams.get('ItemID') || searchParams.get('itemid') || searchParams.get('id');

            const normalizeId = (value: string) => {
                try {
                    return decodeURIComponent(value);
                } catch {
                    return value;
                }
            };

            if (paramId) {
                return `outlook_${normalizeId(paramId)}`;
            }

            const pathMatch = pathname.match(/\/mail\/[^/]+\/id\/([^/]+)/);
            if (pathMatch) {
                return `outlook_${normalizeId(pathMatch[1])}`;
            }

            const hashMatch = hash.match(/ItemID=([^&]+)/i) || hash.match(/\/id\/([^/]+)/i);
            if (hashMatch) {
                return `outlook_${normalizeId(hashMatch[1])}`;
            }

            const fingerprint = `${pathname}${hash}` || pathname;
            return `outlook_${hashString(fingerprint)}`;
        }

        return `email_${hashString(url)}`;
    } catch {
        return emailId || 'email_unknown';
    }
}

function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function getFullCacheKey(cacheKey: string): string {
    return `${CACHE_PREFIX}${cacheKey}`;
}

export async function cacheEmailData(url: string, emailData: EmailData): Promise<void> {
    if (emailData.attachments.length === 0) {
        console.log('[EmailCache] Skipping cache - no attachments');
        return;
    }

    if (!emailData.attachments.every(att => att.status === 'ready')) {
        console.log('[EmailCache] Skipping cache - attachments not ready');
        return;
    }

    const cacheKey = emailData.id;
    const cacheData: CachedEmail = {
        emailData,
        timestamp: Date.now(),
        url,
    };

    await storageSet({
        [getFullCacheKey(cacheKey)]: cacheData,
        [CACHE_CURRENT_KEY]: {
            key: cacheKey,
            url,
        } as CurrentCacheEntry,
    });

    console.log('[EmailCache] Cached email:', cacheKey, 'with', emailData.attachments.length, 'attachments');
}

export async function getCachedEmailData(url: string, currentEmailId?: string): Promise<EmailData | null> {
    try {
        const cacheKey = currentEmailId || generateCacheKey(url);
        const fullKey = getFullCacheKey(cacheKey);
        const result = await storageGet<Record<string, CachedEmail>>([fullKey]);
        const cached = result[fullKey];

        if (!cached) {
            console.log('[EmailCache] No cache found for:', cacheKey);
            return null;
        }

        const age = Date.now() - cached.timestamp;
        if (age > MAX_CACHE_AGE) {
            console.log('[EmailCache] Cache expired:', cacheKey, 'age:', Math.floor(age / 1000), 's');
            await clearEmailCache(cacheKey);
            return null;
        }

        const isOwaStatic = url.includes('outlook') && !url.includes('/id/');

        if (!isOwaStatic) {
            const cachedEmailId = generateCacheKey(cached.url);
            const currentUrlId = generateCacheKey(url);

            if (cachedEmailId !== currentUrlId) {
                console.log('[EmailCache] Email ID mismatch - cached:', cachedEmailId, 'current:', currentUrlId);
                return null;
            }
        }

        if (cached.emailData.attachments.length === 0) {
            console.log('[EmailCache] Cache has 0 attachments, ignoring');
            return null;
        }

        if (!cached.emailData.attachments.every(att => att.status === 'ready')) {
            console.log('[EmailCache] Cached attachments not ready, ignoring');
            return null;
        }

        console.log('[EmailCache] Using cached email:', cacheKey, 'with', cached.emailData.attachments.length, 'attachments');
        return cached.emailData;
    } catch (error) {
        console.error('[EmailCache] Error getting cache:', error);
        return null;
    }
}

export async function clearEmailCache(cacheKey: string): Promise<void> {
    await storageRemove(getFullCacheKey(cacheKey));
    console.log('[EmailCache] Cleared cache:', cacheKey);
}

export async function clearAllEmailCaches(): Promise<void> {
    const count = await storageRemoveByPrefix(CACHE_PREFIX);
    await storageRemove(CACHE_CURRENT_KEY);
    console.log('[EmailCache] Cleared all caches:', count);
}

function parseCurrentEntry(value: string | CurrentCacheEntry | undefined): CurrentCacheEntry | null {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return {
            key: value,
            url: '',
        };
    }

    if (value.key) {
        return value;
    }

    return null;
}

export function getCurrentEmailId(url: string): string | null {
    return generateCacheKey(url);
}

export async function isSameEmail(emailId: string): Promise<boolean> {
    const result = await storageGet<{ [CACHE_CURRENT_KEY]?: string | CurrentCacheEntry }>([CACHE_CURRENT_KEY]);
    const entry = parseCurrentEntry(result[CACHE_CURRENT_KEY]);

    if (!entry) return false;

    return entry.key === emailId;
}

export async function getCurrentCachedEmail(currentUrl?: string): Promise<EmailData | null> {
    try {
        const result = await storageGet<{ [CACHE_CURRENT_KEY]?: string | CurrentCacheEntry }>([CACHE_CURRENT_KEY]);
        const entry = parseCurrentEntry(result[CACHE_CURRENT_KEY]);

        if (!entry) {
            console.log('[EmailCache] No current email key');
            return null;
        }

        if (currentUrl) {
            const expectedKey = generateCacheKey(currentUrl);
            if (expectedKey !== entry.key) {
                console.log('[EmailCache] Active URL does not match cached email key');
                return null;
            }

            if (entry.url && entry.url !== currentUrl) {
                console.log('[EmailCache] Cached URL differs from active URL');
                return null;
            }
        } else if (entry.url) {
            console.log('[EmailCache] No URL provided for cached email validation');
        }

        const fullKey = getFullCacheKey(entry.key);
        const cacheResult = await storageGet<Record<string, CachedEmail>>([fullKey]);
        const cached = cacheResult[fullKey];

        if (!cached) {
            console.log('[EmailCache] No cached data for current key');
            return null;
        }

        // Check age
        const age = Date.now() - cached.timestamp;
        if (age > MAX_CACHE_AGE) {
            console.log('[EmailCache] Current cache expired');
            await clearEmailCache(entry.key);
            return null;
        }

        if (cached.emailData.attachments.length === 0) {
            console.log('[EmailCache] Current cache has no attachments');
            return null;
        }

        console.log('[EmailCache] Retrieved current cached email:', entry.key);
        return cached.emailData;
    } catch (error) {
        console.error('[EmailCache] Error getting current cached email:', error);
        return null;
    }
}
