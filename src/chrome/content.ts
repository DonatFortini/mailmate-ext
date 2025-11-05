import type {
    FetchResult,
    MessageAction,
    EmailData,
    FetchAttachmentContentResult
} from '../shared/types';
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

    if (message.action === 'FETCH_ATTACHMENT_CONTENT') {
        handleFetchAttachmentContent(message, sendResponse);
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

async function handleFetchAttachmentContent(
    message: { action: MessageAction; domain: string; attachmentId: string },
    sendResponse: (response: FetchAttachmentContentResult) => void
): Promise<void> {
    try {
        if (!message.domain) {
            throw new Error('Domain is required');
        }

        if (!message.attachmentId) {
            throw new Error('Attachment ID is required');
        }

        if (!FetcherFactory.isSupported(message.domain)) {
            throw new Error(`Unsupported domain: ${message.domain}`);
        }

        const fetcher = FetcherFactory.getFetcher(message.domain);
        const attachment = await fetcher.loadAttachmentContent(message.attachmentId);

        sendResponse({
            success: attachment.status === 'ready',
            attachment,
            error: attachment.status === 'error' ? attachment.error : undefined,
        });
    } catch (error) {
        console.error('[Content] Error fetching attachment content:', error);

        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch attachment',
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
