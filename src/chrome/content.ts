import type { FetchResult, MessageAction, Attachment } from '../shared/types';
import { FileUtils, getSelectorForDomain, debounce } from '../shared/utils';
import { SUPPORTED_DOMAINS, type SupportedDomain } from '../shared/constants';

class AttachmentFetcher {
    private domain: SupportedDomain;
    private selector: string;
    private processedUrls = new Set<string>();

    constructor(domain: string) {
        if (!Object.values(SUPPORTED_DOMAINS).includes(domain as SupportedDomain)) {
            throw new Error(`Unsupported domain: ${domain}`);
        }

        this.domain = domain as SupportedDomain;
        this.selector = getSelectorForDomain(this.domain);
    }

    private getSourceUrlAndName(element: HTMLElement): [string, string] {
        let url = '';
        let name = '';

        if (element instanceof HTMLImageElement) {
            url = element.src;
            name = element.alt || element.title || 'image';
        } else {
            url = element.getAttribute('download_url') || '';
            const urlParts = url?.split('/');
            name = urlParts && urlParts.length > 1 ? urlParts[1].split(':')[1] || '' : '';
        }

        return [url, name];
    }

    private async fetchAsBlob(url: string): Promise<Blob> {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }
        return response.blob();
    }

    async fetchAttachments(): Promise<Attachment[]> {
        try {
            const attachments: Attachment[] = [];
            const elements = Array.from(document.querySelectorAll(this.selector));

            console.log(`[Content] Found ${elements.length} potential attachment elements`);

            const attachmentPromises = elements.map(async (element) => {
                try {
                    const [url, name] = this.getSourceUrlAndName(element as HTMLElement);

                    if (!url || this.processedUrls.has(url)) {
                        return null;
                    }

                    this.processedUrls.add(url);

                    const blob = await this.fetchAsBlob(url);
                    if (!blob) return null;

                    const mimeType = blob.type || element.getAttribute('type') || '';
                    const type = FileUtils.detectFileType(name, mimeType);
                    const id = FileUtils.generateId();

                    const base64Data = await FileUtils.blobToBase64(blob);

                    return {
                        id,
                        name: FileUtils.sanitizeFilename(name),
                        type,
                        base64Data,
                        metadata: {
                            size: blob.size,
                            mimeType,
                            sourceUrl: url,
                        },
                    } satisfies Attachment;
                } catch (error) {
                    console.error('[Content] Error processing attachment:', error);
                    return null;
                }
            });

            const results = await Promise.all(attachmentPromises);
            attachments.push(...(results.filter(Boolean) as Attachment[]));

            console.log(`[Content] Successfully processed ${attachments.length} attachments`);
            return attachments;
        } catch (error) {
            console.error('[Content] Error fetching attachments:', error);
            return [];
        }
    }

    clearProcessedUrls(): void {
        this.processedUrls.clear();
    }
}

const fetcherInstances = new Map<string, AttachmentFetcher>();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[Content] Received message:', message);

    if (message.action === 'GET_ATTACHMENTS') {
        console.log('[Content] Processing GET_ATTACHMENTS request');

        const debouncedHandler = debounce(() => {
            handleGetAttachments(message, sendResponse);
        }, 100);

        debouncedHandler();
        return true;
    }

    return false;
});

async function handleGetAttachments(
    message: { action: MessageAction; domain: string },
    sendResponse: (response: FetchResult) => void
): Promise<void> {
    try {
        console.log('[Content] Getting attachments for domain:', message.domain);

        if (!message.domain) {
            throw new Error('Domain is undefined');
        }

        if (!fetcherInstances.has(message.domain)) {
            fetcherInstances.set(message.domain, new AttachmentFetcher(message.domain));
        }

        const fetcher = fetcherInstances.get(message.domain)!;
        const attachments = await fetcher.fetchAttachments();

        sendResponse({ success: true, attachments });
    } catch (error) {
        console.error('[Content] Error getting attachments:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get attachments',
        });
    }
}

window.addEventListener('beforeunload', () => {
    fetcherInstances.forEach((fetcher) => fetcher.clearProcessedUrls());
    fetcherInstances.clear();
});

console.log('[Content] Mail Attachment Extension content script initialized');