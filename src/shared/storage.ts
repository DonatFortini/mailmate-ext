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

function generateCacheKey(url: string, emailId?: string): string {
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
            const itemMatch = pathname.match(/\/mail\/[^/]+\/id\/([^/]+)/);
            if (itemMatch) {
                return `outlook_${itemMatch[1]}`;
            }
        }

        if (emailId) {
            return emailId;
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
    // Don't cache if no attachments
    if (emailData.attachments.length === 0) {
        console.log('[EmailCache] Skipping cache - no attachments');
        return;
    }

    const cacheKey = generateCacheKey(url, emailData.id);
    const cacheData: CachedEmail = {
        emailData,
        timestamp: Date.now(),
        url,
    };

    await storageSet({
        [getFullCacheKey(cacheKey)]: cacheData,
        [CACHE_CURRENT_KEY]: cacheKey,
    });

    console.log('[EmailCache] Cached email:', cacheKey, 'with', emailData.attachments.length, 'attachments');
}

export async function getCachedEmailData(url: string): Promise<EmailData | null> {
    try {
        const cacheKey = generateCacheKey(url);
        const fullKey = getFullCacheKey(cacheKey);
        const result = await storageGet<Record<string, CachedEmail>>([fullKey]);
        const cached = result[fullKey];

        if (!cached) {
            console.log('[EmailCache] No cache found for:', cacheKey);
            return null;
        }

        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age > MAX_CACHE_AGE) {
            console.log('[EmailCache] Cache expired:', cacheKey, 'age:', Math.floor(age / 1000), 's');
            await clearEmailCache(cacheKey);
            return null;
        }

        // CRITICAL: Check if cached URL matches current URL  
        // Extract email ID from both URLs to compare
        const cachedEmailId = generateCacheKey(cached.url);
        const currentEmailId = generateCacheKey(url);

        if (cachedEmailId !== currentEmailId) {
            console.log('[EmailCache] Email ID mismatch - cached:', cachedEmailId, 'current:', currentEmailId);
            return null;
        }

        // Don't return cache with 0 attachments
        if (cached.emailData.attachments.length === 0) {
            console.log('[EmailCache] Cache has 0 attachments, ignoring');
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
    console.log('[EmailCache] Cleared all caches:', count);
}

export function getCurrentEmailId(url: string): string | null {
    return generateCacheKey(url);
}

export async function isSameEmail(url: string): Promise<boolean> {
    const result = await storageGet<{ [CACHE_CURRENT_KEY]?: string }>([CACHE_CURRENT_KEY]);
    const currentKey = result[CACHE_CURRENT_KEY];

    if (!currentKey) return false;

    const newKey = generateCacheKey(url);
    return currentKey === newKey;
}