import type { AuthTokens } from './types';

/**
 * Get authentication data from Chrome storage
 */
export async function getAuthData(): Promise<AuthTokens | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['jwt', 'refreshToken', 'tokenExpiry', 'user'], (result) => {
            if (!result.jwt || !result.refreshToken) {
                resolve(null);
                return;
            }
            resolve(result as AuthTokens);
        });
    });
}

/**
 * Save authentication data to Chrome storage
 */
export async function setAuthData(data: Partial<AuthTokens>): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => resolve());
    });
}

/**
 * Clear all authentication data from Chrome storage
 */
export async function clearAuthData(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['jwt', 'refreshToken', 'tokenExpiry', 'user'], () => {
            console.log('[Storage] Auth data cleared');
            resolve();
        });
    });
}

/**
 * Get only the JWT token
 */
export async function getJwtToken(): Promise<string | null> {
    const authData = await getAuthData();
    return authData?.jwt || null;
}

/**
 * Get only the user data
 */
export async function getUserData(): Promise<any | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['user'], (result) => {
            resolve(result.user || null);
        });
    });
}