import type {
    Message,
    AuthResult,
    FetchResult,
    ProcessResult,
    AuthTokens,
    Attachment,
    ProcessAttachmentsMessage,
    FetchAttachmentsMessage,
    LoginMessage,
} from '../shared/types';
import { MESSAGE_TIMEOUT, TOKEN_REFRESH_BUFFER } from '../shared/constants';

// ======================== CONFIGURATION ========================
const API_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '';

let refreshTimerId: number | null = null;

// ======================== AUTH MANAGEMENT ========================
chrome.runtime.onStartup.addListener(() => {
    checkAuthStatus();
});

chrome.runtime.onInstalled.addListener(() => {
    checkAuthStatus();
});

function checkAuthStatus(): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['jwt', 'refreshToken', 'tokenExpiry', 'user'], (result) => {
            if (!result.jwt || !result.refreshToken) {
                console.log('[Background] No auth tokens found');
                resolve(false);
                return;
            }

            if (isTokenExpired(result.tokenExpiry)) {
                console.log('[Background] Token expired, attempting refresh');
                refreshToken()
                    .then((success) => resolve(success))
                    .catch(() => resolve(false));
                return;
            }

            const timeToExpiry = result.tokenExpiry - Date.now();
            console.log(`[Background] Token valid for ${Math.floor(timeToExpiry / 60000)} minutes`);
            setupTokenRefresh(result.tokenExpiry);
            resolve(true);
        });
    });
}

function isTokenExpired(expiryTime: number): boolean {
    return Date.now() + TOKEN_REFRESH_BUFFER > expiryTime;
}

function setupTokenRefresh(expiryTime: number): void {
    if (refreshTimerId) {
        clearTimeout(refreshTimerId);
    }
    const timeUntilRefresh = expiryTime - Date.now() - TOKEN_REFRESH_BUFFER;
    if (timeUntilRefresh > 0) {
        console.log(`[Background] Scheduling token refresh in ${Math.floor(timeUntilRefresh / 60000)} minutes`);
        refreshTimerId = setTimeout(() => refreshToken(), timeUntilRefresh) as unknown as number;
    } else {
        refreshToken();
    }
}

async function refreshToken(): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['refreshToken'], (result) => {
            if (!result.refreshToken) {
                console.log('[Background] No refresh token found');
                resolve(false);
                return;
            }

            console.log('[Background] Refreshing token');
            fetch(`${API_URL}${API_PREFIX}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: result.refreshToken }),
            })
                .then((response) => {
                    if (!response.ok) throw new Error('Token refresh failed');
                    return response.json();
                })
                .then((data) => {
                    const tokenExpiry = Date.now() + data.expires_in * 1000;
                    const tokenData: AuthTokens = {
                        jwt: data.token,
                        refreshToken: data.refresh_token || result.refreshToken,
                        tokenExpiry: tokenExpiry,
                        user: data.user,
                    };

                    chrome.storage.local.set(tokenData, () => {
                        console.log('[Background] Token refreshed successfully');
                        setupTokenRefresh(tokenExpiry);
                        resolve(true);
                    });
                })
                .catch((error) => {
                    console.error('[Background] Error refreshing token:', error);
                    chrome.storage.local.remove(['jwt', 'refreshToken', 'tokenExpiry', 'user'], () => {
                        console.log('[Background] Auth data cleared due to refresh failure');
                    });
                    resolve(false);
                });
        });
    });
}

// ======================== MESSAGE HANDLING ========================
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('[Background] Received message:', message.action);

    switch (message.action) {
        case 'FETCH_ATTACHMENTS':
            handleFetchAttachments(message as FetchAttachmentsMessage, sendResponse);
            return true;

        case 'PROCESS_ATTACHMENTS':
            handleProcessAttachments(message as ProcessAttachmentsMessage, sendResponse);
            return true;

        case 'LOGIN':
            handleLogin(message as LoginMessage, sendResponse);
            return true;

        case 'LOGOUT':
            handleLogout(sendResponse);
            return true;

        case 'CHECK_AUTH':
            handleCheckAuth(sendResponse);
            return true;

        case 'REFRESH_TOKEN':
            handleRefreshToken(sendResponse);
            return true;

        default:
            console.log('[Background] Unknown message action:', message.action);
            return false;
    }
});

// ======================== HANDLERS ========================
function handleFetchAttachments(message: FetchAttachmentsMessage, sendResponse: (response: FetchResult) => void): void {
    console.log(`[Background] Relaying fetch request to tab ${message.tabId}`);

    checkAuthStatus().then((isAuthenticated) => {
        if (!isAuthenticated) {
            sendResponse({ success: false, error: 'Authentication required' });
            return;
        }

        if (!message.tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        const messageTimeout = setTimeout(() => {
            console.error('[Background] Timeout waiting for content script response');
            sendResponse({ success: false, error: 'Timeout waiting for content script response' });
        }, MESSAGE_TIMEOUT);

        chrome.tabs.sendMessage(
            message.tabId,
            {
                action: 'GET_ATTACHMENTS',
                domain: message.domain,
            },
            (response: FetchResult) => {
                clearTimeout(messageTimeout);

                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
                    console.error('[Background] Chrome runtime error:', errorMsg);
                    sendResponse({
                        success: false,
                        error: errorMsg.includes('Receiving end does not exist')
                            ? 'Please refresh the page to activate the extension'
                            : errorMsg,
                    });
                    return;
                }

                sendResponse(response);
            }
        );
    });
}

function handleProcessAttachments(message: ProcessAttachmentsMessage, sendResponse: (response: ProcessResult) => void): void {
    console.log(`[Background] Processing ${message.attachments?.length || 0} attachments`);

    chrome.storage.local.get(['jwt'], (result) => {
        if (!result.jwt) {
            sendResponse({ success: false, error: 'Not authenticated' });
            return;
        }

        sendAttachmentsToApi(message.attachments, result.jwt)
            .then((apiResponse) => {
                console.log('[Background] API response:', apiResponse);
                sendResponse({ success: true, data: apiResponse });
            })
            .catch((error) => {
                console.error('[Background] API error:', error);

                if (error.status === 401 || error.status === 403) {
                    refreshToken().catch(() => {
                        console.log('[Background] Auth refresh failed after API error');
                    });
                }

                sendResponse({
                    success: false,
                    error: error.message || 'Failed to process attachments',
                });
            });
    });
}

// ======================== API COMMUNICATION ========================
async function sendAttachmentsToApi(attachments: Attachment[], token: string): Promise<any> {
    if (!API_URL) {
        throw new Error('API URL not configured');
    }

    console.log(`[Background] Sending ${attachments.length} attachments to API as base64`);

    try {
        const payload = {
            attachments: attachments.map(att => ({
                id: att.id,
                name: att.name,
                type: att.type,
                base64Data: att.base64Data,
                metadata: {
                    size: att.metadata.size,
                    mimeType: att.metadata.mimeType,
                },
            })),
        };

        const response = await fetch(`${API_URL}${API_PREFIX}/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                const errorMessage = errorData.message || errorData.error || `API error: ${response.status}`;
                const error: any = new Error(errorMessage);
                error.status = response.status;
                throw error;
            } else {
                const errorText = await response.text();
                const error: any = new Error(errorText || `API error: ${response.status}`);
                error.status = response.status;
                throw error;
            }
        }

        return await response.json();
    } catch (error) {
        console.error('[Background] API request failed:', error);
        throw error;
    }
}

function handleLogin(message: LoginMessage, sendResponse: (response: AuthResult) => void): void {
    console.log('[Background] Processing login request');

    fetch(`${API_URL}${API_PREFIX}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: message.email,
            password: message.password,
        }),
    })
        .then((response) => {
            if (!response.ok) throw new Error(`Login failed with status: ${response.status}`);
            return response.json();
        })
        .then((data) => {
            if (!data.token && !data.refresh_token) {
                throw new Error('Invalid authentication response');
            }

            console.log('[Background] Login successful');
            const user = data.user || {
                id: data.user_id || '',
                email: message.email,
                displayName: data.user?.name || message.email,
            };

            const tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
            chrome.storage.local.set(
                {
                    jwt: data.token,
                    refreshToken: data.refresh_token,
                    tokenExpiry: tokenExpiry,
                    user: user,
                },
                () => {
                    setupTokenRefresh(tokenExpiry);
                    sendResponse({ success: true, user: user, token: data.token });
                }
            );
        })
        .catch((error) => {
            console.error('[Background] Login error:', error);
            sendResponse({ success: false, error: error.message });
        });
}

function handleLogout(sendResponse: (response: AuthResult) => void): void {
    console.log('[Background] Processing logout request');

    if (refreshTimerId) {
        clearTimeout(refreshTimerId);
        refreshTimerId = null;
    }

    chrome.storage.local.get(['jwt'], (result) => {
        chrome.storage.local.remove(['jwt', 'refreshToken', 'tokenExpiry', 'user'], () => {
            console.log('[Background] Auth data cleared');

            if (result.jwt) {
                fetch(`${API_URL}${API_PREFIX}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${result.jwt}`,
                    },
                })
                    .then(() => {
                        console.log('[Background] Logout successful');
                        sendResponse({ success: true });
                    })
                    .catch((error) => {
                        console.error('[Background] Logout error:', error);
                        sendResponse({ success: false, error: error.message });
                    });
            } else {
                sendResponse({ success: true });
            }
        });
    });
}

function handleCheckAuth(sendResponse: (response: AuthResult) => void): void {
    console.log('[Background] Checking auth status');

    checkAuthStatus()
        .then((isAuthenticated) => {
            if (isAuthenticated) {
                chrome.storage.local.get(['user'], (result) => {
                    sendResponse({ success: true, user: result.user });
                });
            } else {
                sendResponse({ success: false, error: 'Not authenticated' });
            }
        })
        .catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
}

function handleRefreshToken(sendResponse: (response: AuthResult) => void): void {
    console.log('[Background] Manual token refresh requested');

    refreshToken()
        .then((success) => {
            if (success) {
                chrome.storage.local.get(['user'], (result) => {
                    sendResponse({ success: true, user: result.user });
                });
            } else {
                sendResponse({ success: false, error: 'Refresh failed' });
            }
        })
        .catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
}

console.log('[Background] MailMate Extension background script initialized');