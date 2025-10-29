import type { FetchResult, MessageAction, EmailData } from '../shared/types';
import { debounce } from '../shared/utils';
import { FetcherFactory } from '../fetchers/FetcherFactory';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[Content] Received message:', message.action);

    if (message.action === 'FETCH_MAIL') {
        const debouncedHandler = debounce(() => {
            handleFetchMail(message, sendResponse);
        }, 100);

        debouncedHandler();
        return true;
    }

    return false;
});

async function handleFetchMail(
    message: { action: MessageAction; domain: string },
    sendResponse: (response: FetchResult) => void
): Promise<void> {
    try {
        console.log('[Content] Fetching email data for domain:', message.domain);

        if (!message.domain) {
            throw new Error('Domain is required');
        }

        if (!FetcherFactory.isSupported(message.domain)) {
            throw new Error(`Unsupported domain: ${message.domain}`);
        }

        const fetcher = FetcherFactory.getFetcher(message.domain);

        const emailData: EmailData = await fetcher.fetchEmailData();

        console.log('[Content] Email data fetched:', {
            id: emailData.id,
            subject: emailData.subject,
            hasAttachments: emailData.attachments.length > 0,
            attachmentsCount: emailData.attachments.length,
        });

        console.log('[Content] Email data processed:', emailData);

        sendResponse({
            success: true,
            emailData: emailData,
        });

    } catch (error) {
        console.error('[Content] Error fetching email:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch email',
        });
    }
}

window.addEventListener('beforeunload', () => {
    console.log('[Content] Cleaning up');
    FetcherFactory.clearCache();
});

window.addEventListener('popstate', () => {
    console.log('[Content] Navigation detected');
    FetcherFactory.clearCache();
});

console.log('[Content] MailMate content script initialized');