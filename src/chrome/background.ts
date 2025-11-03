import type {
    Message,
    BaseMessage,
    AuthResult,
    FetchResult,
    ProcessResult,
    EmailData,
    FetchMailMessage,
    ProcessMailMessage,
    LoginMessage,
} from '../shared/types';
import { MESSAGE_TIMEOUT } from '../shared/constants';
import {
    calculateTokenExpiry,
    isTokenExpired,
    getTimeUntilRefresh,
    validateAuthResponse,
    buildUserObject,
    isAuthError,
    getChromeErrorMessage,
    buildApiUrl,
    makeApiRequest,
} from '../shared/utils';
import {
    getAuthData,
    setAuthData,
    clearAuthData,
    getJwtToken,
    getUserData,
    clearAllEmailCaches,
} from '../shared/storage';

// ======================== CONFIGURATION ========================
const API_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '';

let refreshTimerId: number | null = null;

// ======================== TOKEN REFRESH MANAGEMENT ========================
function setupTokenRefresh(expiryTime: number): void {
    clearTokenRefresh();

    const timeUntilRefresh = getTimeUntilRefresh(expiryTime);

    if (timeUntilRefresh > 0) {
        console.log(`[Background] Scheduling token refresh in ${Math.floor(timeUntilRefresh / 60000)} minutes`);
        refreshTimerId = setTimeout(() => refreshToken(), timeUntilRefresh) as unknown as number;
    } else {
        refreshToken();
    }
}

function clearTokenRefresh(): void {
    if (refreshTimerId) {
        clearTimeout(refreshTimerId);
        refreshTimerId = null;
    }
}

// ======================== AUTH LOGIC ========================
async function storeAuthResponse(data: any, email?: string): Promise<any> {
    validateAuthResponse(data);

    const user = buildUserObject(data, email);
    const tokenExpiry = calculateTokenExpiry(data.expires_in || 3600);

    await setAuthData({
        jwt: data.token,
        refreshToken: data.refresh_token,
        tokenExpiry,
        user,
    });

    setupTokenRefresh(tokenExpiry);
    return user;
}

async function checkAuthStatus(): Promise<boolean> {
    const authData = await getAuthData();

    if (!authData) {
        console.log('[Background] No auth tokens found');
        return false;
    }

    if (isTokenExpired(authData.tokenExpiry)) {
        console.log('[Background] Token expired, attempting refresh');
        try {
            return await refreshToken();
        } catch {
            return false;
        }
    }

    const timeToExpiry = authData.tokenExpiry - Date.now();
    console.log(`[Background] Token valid for ${Math.floor(timeToExpiry / 60000)} minutes`);
    setupTokenRefresh(authData.tokenExpiry);
    return true;
}

async function refreshToken(): Promise<boolean> {
    const authData = await getAuthData();

    if (!authData?.refreshToken) {
        console.log('[Background] No refresh token found');
        return false;
    }

    try {
        console.log('[Background] Refreshing token');
        const url = buildApiUrl(API_URL, API_PREFIX, '/auth/refresh');
        const data = await makeApiRequest(url, {
            method: 'POST',
            body: JSON.stringify({ refresh_token: authData.refreshToken }),
        });

        const tokenExpiry = calculateTokenExpiry(data.expires_in);
        await setAuthData({
            jwt: data.token,
            refreshToken: data.refresh_token || authData.refreshToken,
            tokenExpiry,
            user: data.user,
        });

        console.log('[Background] Token refreshed successfully');
        setupTokenRefresh(tokenExpiry);
        return true;
    } catch (error) {
        console.error('[Background] Error refreshing token:', error);
        await clearAuthData();
        return false;
    }
}

function initAuthChecks(): void {
    const run = () => {
        console.log('[Background] Initial auth check');
        checkAuthStatus();
    };

    chrome.runtime.onStartup.addListener(run);
    chrome.runtime.onInstalled.addListener(run);
    run();
}

// ======================== API REQUESTS ========================
async function apiRequest(endpoint: string, options: RequestInit = {}, requireAuth = false): Promise<any> {
    const url = buildApiUrl(API_URL, API_PREFIX, endpoint);

    if (requireAuth) {
        const token = await getJwtToken();
        if (!token) {
            throw new Error('Not authenticated');
        }
        return makeApiRequest(url, options, token);
    }

    return makeApiRequest(url, options);
}

async function sendEmailToApi(emailData: EmailData): Promise<any> {
    console.log(`[Background] Sending email to API:`, {
        id: emailData.id,
        subject: emailData.subject,
        attachmentsCount: emailData.attachments.length,
    });

    const payload = {
        id: emailData.id,
        subject: emailData.subject,
        sender: emailData.sender,
        recipients: emailData.recipients,
        body: emailData.body,
        attachments: emailData.attachments.length > 0
            ? emailData.attachments.map((att) => ({
                id: att.id,
                name: att.name,
                type: att.type,
                base64Data: att.base64Data,
                metadata: {
                    size: att.metadata.size,
                    mimeType: att.metadata.mimeType,
                },
            }))
            : null,
    };

    return apiRequest('/services/mail', {
        method: 'POST',
        body: JSON.stringify(payload),
    }, true);
}

// ======================== MESSAGE HANDLERS ========================
async function handleFetchMail(
    message: FetchMailMessage,
    sendResponse: (response: FetchResult) => void
): Promise<void> {
    console.log(`[Background] Fetching mail from tab ${message.tabId}`);

    try {
        const isAuthenticated = await checkAuthStatus();
        if (!isAuthenticated) {
            sendResponse({ success: false, error: 'Authentication required' });
            return;
        }

        if (!message.tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        const messageTimeout = setTimeout(() => {
            console.error('[Background] Timeout waiting for content script');
            sendResponse({ success: false, error: 'Timeout waiting for content script' });
        }, MESSAGE_TIMEOUT);

        chrome.tabs.sendMessage(
            message.tabId,
            { action: 'FETCH_MAIL', domain: message.domain },
            (response: FetchResult) => {
                clearTimeout(messageTimeout);

                if (chrome.runtime.lastError) {
                    console.error('[Background] Chrome error:', chrome.runtime.lastError?.message);
                    const errorMsg = getChromeErrorMessage(chrome.runtime.lastError);
                    sendResponse({ success: false, error: errorMsg });
                    return;
                }

                sendResponse(response);
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendResponse({ success: false, error: message });
    }
}

async function handleProcessMail(
    message: ProcessMailMessage,
    sendResponse: (response: ProcessResult) => void
): Promise<void> {
    console.log(`[Background] Processing email: "${message.emailData.subject}"`);

    try {
        const response = await sendEmailToApi(message.emailData);
        console.log('[Background] API response:', response);
        clearAllEmailCaches().catch(() => {
            console.warn('[Background] Failed to clear email caches after processing');
        });
        sendResponse({ success: true, data: response });
    } catch (error: any) {
        console.error('[Background] API error:', error);

        if (isAuthError(error)) {
            refreshToken().catch(() => {
                console.log('[Background] Auth refresh failed');
            });
        }

        const message = error?.message || 'Failed to process email';
        sendResponse({ success: false, error: message });
    }
}

async function handleLogin(
    message: LoginMessage,
    sendResponse: (response: AuthResult) => void
): Promise<void> {
    console.log('[Background] Processing login request');

    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: message.email,
                password: message.password,
            }),
        });

        console.log('[Background] Login successful');
        const user = await storeAuthResponse(data, message.email);
        sendResponse({ success: true, user, token: data.token });
    } catch (error) {
        console.error('[Background] Login error:', error);
        const message = error instanceof Error ? error.message : String(error);
        sendResponse({ success: false, error: message });
    }
}

async function handleLogout(_message: BaseMessage, sendResponse: (response: AuthResult) => void): Promise<void> {
    console.log('[Background] Processing logout request');

    clearTokenRefresh();

    try {
        const token = await getJwtToken();

        await clearAuthData();

        if (token) {
            await apiRequest('/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log('[Background] Logout successful');
        }

        sendResponse({ success: true });
    } catch (error) {
        console.error('[Background] Logout error:', error);
        sendResponse({ success: true });
    }
}

async function handleCheckAuth(_message: BaseMessage, sendResponse: (response: AuthResult) => void): Promise<void> {
    console.log('[Background] Checking auth status');

    try {
        const isAuthenticated = await checkAuthStatus();

        if (!isAuthenticated) {
            if (typeof sendResponse === 'function') {
                sendResponse({ success: false, error: 'Not authenticated' });
            } else {
                console.warn('[Background] sendResponse is not a function for CHECK_AUTH');
            }
            return;
        }

        const user = await getUserData();
        if (typeof sendResponse === 'function') {
            sendResponse({ success: true, user });
        } else {
            console.warn('[Background] sendResponse is not a function for CHECK_AUTH');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (typeof sendResponse === 'function') {
            sendResponse({ success: false, error: message });
        } else {
            console.error('[Background] Error checking auth but sendResponse not available:', message);
        }
    }
}

async function handleRefreshToken(_message: BaseMessage, sendResponse: (response: AuthResult) => void): Promise<void> {
    console.log('[Background] Manual token refresh requested');

    try {
        const success = await refreshToken();

        if (!success) {
            sendResponse({ success: false, error: 'Refresh failed' });
            return;
        }

        const user = await getUserData();
        sendResponse({ success: true, user });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendResponse({ success: false, error: message });
    }
}

// ======================== MESSAGE ROUTING ========================
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('[Background] Received message:', message.action);

    const handlers: Record<string, (msg: any, res: any) => Promise<void>> = {
        FETCH_MAIL: handleFetchMail,
        PROCESS_MAIL: handleProcessMail,
        LOGIN: handleLogin,
        LOGOUT: handleLogout,
        CHECK_AUTH: handleCheckAuth,
        REFRESH_TOKEN: handleRefreshToken,
    };

    const handler = handlers[message.action];

    if (handler) {
        handler(message, sendResponse);
        return true;
    }

    console.log('[Background] Unknown action:', message.action);
    return false;
});

// ======================== INITIALIZATION ========================
initAuthChecks();
console.log('[Background] MailMate Extension background script initialized');
