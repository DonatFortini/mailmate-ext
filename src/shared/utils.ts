import { FileType } from './types';
import { FILE_TYPE_MAP, MAIL_SELECTORS, SUPPORTED_DOMAINS, type SupportedDomain } from './constants';

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

    static async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    static base64ToBlob(base64: string, mimeType?: string): Blob {
        try {
            let base64Data = base64;
            let contentType = mimeType;

            if (base64.includes(';base64,')) {
                const parts = base64.split(';base64,');
                contentType = contentType || parts[0].split(':')[1];
                base64Data = parts[1];
            }

            const raw = window.atob(base64Data);
            const rawLength = raw.length;
            const uint8Array = new Uint8Array(rawLength);

            for (let i = 0; i < rawLength; i++) {
                uint8Array[i] = raw.charCodeAt(i);
            }

            return new Blob([uint8Array], { type: contentType || 'application/octet-stream' });
        } catch (error) {
            console.error('[FileUtils] Error converting base64 to blob:', error);
            throw new Error('Failed to convert base64 to Blob');
        }
    }

    static async downloadBase64(base64Data: string, filename: string, mimeType?: string): Promise<void> {
        if (!base64Data) {
            throw new Error('Invalid base64 data provided for download');
        }

        const blob = this.base64ToBlob(base64Data, mimeType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

export function isDomainSupported(domain: string): boolean {
    return Object.values(SUPPORTED_DOMAINS).includes(domain as SupportedDomain);
}

export function getSelectorForDomain(domain: SupportedDomain): string {
    switch (domain) {
        case SUPPORTED_DOMAINS.GMAIL:
            return MAIL_SELECTORS.GMAIL;
        case SUPPORTED_DOMAINS.OUTLOOK:
            return MAIL_SELECTORS.OUTLOOK;
        default:
            return MAIL_SELECTORS.OUTLOOK;
    }
}

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