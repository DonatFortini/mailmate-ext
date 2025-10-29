import { FileType } from './types';
import { FILE_TYPE_MAP, SUPPORTED_DOMAINS, TOKEN_REFRESH_BUFFER } from './constants';

// ======================== COMMON HELPERS ========================
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function normalizeWhitespace(text: string, preserveNewlines = false): string {
    if (preserveNewlines) {
        return text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s+\n/g, '\n\n')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            .trim();
    }
    return text.replace(/\s+/g, ' ').trim();
}

// ======================== FILE UTILITIES ========================
export class FileUtils {
    static detectFileType(filename: string, mimeType?: string): FileType {
        const extension = this.getExtension(filename).toLowerCase();
        if (extension && FILE_TYPE_MAP.extensions[extension as keyof typeof FILE_TYPE_MAP.extensions]) {
            return FILE_TYPE_MAP.extensions[extension as keyof typeof FILE_TYPE_MAP.extensions];
        }

        if (mimeType) {
            for (const [prefix, type] of Object.entries(FILE_TYPE_MAP.mimeTypePrefixes)) {
                if (mimeType.startsWith(prefix) || mimeType.includes(prefix.slice(0, -1))) {
                    return type;
                }
            }
        }

        return FileType.OTHER;
    }

    static getExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() || '' : '';
    }

    static generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    static generateIdWithPrefix(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    static sanitizeFilename(filename: string): string {
        return filename
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/\s+/g, '_')
            .trim();
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }

    static async downloadBase64(base64Data: string, filename: string): Promise<void> {
        if (!base64Data) {
            throw new Error('Invalid base64 data provided for download');
        }

        const a = document.createElement('a');
        a.href = base64Data;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// ======================== DOMAIN UTILITIES ========================
const DOMAIN_PATTERNS = {
    gmail: ['mail.google.com', 'gmail.com'],
    outlook: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.outlook.com'],
};

function matchesDomainPattern(hostname: string, patterns: string[]): boolean {
    return patterns.some(pattern =>
        hostname === pattern ||
        hostname.endsWith('.' + pattern) ||
        hostname.includes(pattern)
    );
}

export function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

export function isDomainSupported(domain: string): boolean {
    if (!domain) return false;
    const hostname = domain.toLowerCase();
    const allPatterns = [...DOMAIN_PATTERNS.gmail, ...DOMAIN_PATTERNS.outlook];
    return matchesDomainPattern(hostname, allPatterns);
}

export function getDomainType(domain: string): string {
    const hostname = domain.toLowerCase();

    if (matchesDomainPattern(hostname, DOMAIN_PATTERNS.gmail)) {
        return SUPPORTED_DOMAINS.GMAIL;
    }

    if (matchesDomainPattern(hostname, DOMAIN_PATTERNS.outlook)) {
        return SUPPORTED_DOMAINS.OUTLOOK;
    }

    return 'unknown';
}

// ======================== GENERAL UTILITIES ========================
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    ms = 300
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
}

export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return defaultMessage;
}

// ======================== CHROME MESSAGING UTILITIES ========================
export function sendChromeMessage<T>(message: any): Promise<T> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response: T) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

export function getChromeErrorMessage(error: chrome.runtime.LastError | undefined): string {
    if (!error) return 'Unknown error';

    const message = error.message || 'Unknown error';

    if (message.includes('Receiving end does not exist')) {
        return 'Please refresh the page to activate the extension';
    }

    return message;
}

// ======================== TOKEN UTILITIES ========================
export function calculateTokenExpiry(expiresIn: number): number {
    return Date.now() + expiresIn * 1000;
}

export function isTokenExpired(expiryTime: number): boolean {
    return Date.now() + TOKEN_REFRESH_BUFFER > expiryTime;
}

export function getTimeUntilRefresh(expiryTime: number): number {
    return expiryTime - Date.now() - TOKEN_REFRESH_BUFFER;
}

export function formatTimeRemaining(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hours ${minutes % 60} minutes`;
}

// ======================== API UTILITIES ========================
export function isAuthError(error: any): boolean {
    return error?.status === 401 || error?.status === 403;
}

export async function handleApiError(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let bodyMessage: string;
    try {
        if (isJson) {
            const data = await response.json();
            bodyMessage = data?.message || data?.error || JSON.stringify(data);
        } else {
            bodyMessage = await response.text();
        }
    } catch {
        bodyMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    const errorMessage = bodyMessage || `API error: ${response.status}`;
    const error: any = new Error(errorMessage);
    error.status = response.status;
    throw error;
}

export async function makeApiRequest(
    url: string,
    options: RequestInit = {},
    token?: string
): Promise<any> {
    console.log('[API] Request to:', url);

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    console.log('[API] Status:', response.status);

    if (!response.ok) {
        await handleApiError(response);
    }

    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? await response.json() : null;
}

export function buildApiUrl(baseUrl: string, prefix: string, endpoint: string): string {
    if (!baseUrl || baseUrl === 'undefined') {
        throw new Error('API URL not configured');
    }
    return `${baseUrl}${prefix}${endpoint}`;
}

// ======================== DATA VALIDATION ========================
export function validateAuthResponse(data: any): void {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid authentication response');
    }
    if (!data.token || !data.refresh_token) {
        throw new Error('Invalid authentication response: missing token');
    }
}

export function buildUserObject(data: any, fallbackEmail?: string): any {
    return data.user || {
        id: data.user_id || '',
        email: fallbackEmail || data.email || '',
        displayName: data.user?.name || fallbackEmail || '',
    };
}

// ======================== HTML SANITIZER ========================
export class HtmlSanitizer {
    private static readonly UNWANTED_SELECTORS = [
        'script', 'style', 'noscript', 'iframe',
        'img[width="1"]', 'img[height="1"]',
        '.adL', '.yj6qo',
    ];

    private static readonly BLOCK_ELEMENTS = 'p, div, br, h1, h2, h3, h4, h5, h6, li, tr';

    private static removeUnwantedElements(element: HTMLElement): void {
        this.UNWANTED_SELECTORS.forEach(selector => {
            element.querySelectorAll(selector).forEach(el => el.remove());
        });
    }

    private static processBlockElements(element: HTMLElement): void {
        element.querySelectorAll(this.BLOCK_ELEMENTS).forEach(el => {
            if (el.tagName === 'BR') {
                el.replaceWith('\n');
            } else if (el.tagName === 'LI') {
                el.prepend(document.createTextNode('\n• '));
            } else {
                el.append(document.createTextNode('\n'));
            }
        });
    }

    private static processLinks(element: HTMLElement): void {
        element.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent;
            if (href && href !== text && !href.startsWith('javascript:')) {
                link.textContent = `${text} (${href})`;
            }
        });
    }

    private static extractText(element: HTMLElement): string {
        return element.textContent || element.innerText || '';
    }

    static htmlToText(html: string): string {
        if (!html) return '';

        const temp = document.createElement('div');
        temp.innerHTML = html;

        this.removeUnwantedElements(temp);
        this.processBlockElements(temp);
        this.processLinks(temp);

        const text = this.extractText(temp);
        return normalizeWhitespace(decodeHtmlEntities(text), true);
    }

    static htmlToPlainText(html: string): string {
        if (!html) return '';

        const temp = document.createElement('div');
        temp.innerHTML = html;

        this.removeUnwantedElements(temp);

        const text = this.extractText(temp);
        return normalizeWhitespace(decodeHtmlEntities(text), false);
    }
}