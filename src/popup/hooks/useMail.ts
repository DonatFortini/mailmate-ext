import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
    EmailData,
    FetchResult,
    ProcessResult,
    Attachment,
    FetchAttachmentContentResult
} from '../../shared/types';
import { sendChromeMessage, getErrorMessage } from '../../shared/utils';
import {
    cacheEmailData,
    getCachedEmailData,
    getCurrentCachedEmail,
    clearAllEmailCaches
} from '../../shared/storage';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function useMail() {
    const [emailData, setEmailData] = useState<EmailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [currentUrl, setCurrentUrl] = useState<string>('');
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);

    useEffect(() => {
        async function loadCachedData() {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const tab = tabs[0];

                if (!tab?.url) return;

                setCurrentUrl(tab.url);

                const cached = await getCurrentCachedEmail(tab.url);
                if (cached) {
                    console.log('[useMail] Restored from cache');
                    setEmailData(cached);
                    setAttachmentsLoading(false);
                }
            } catch (err) {
                console.error('[useMail] Error loading cache:', err);
            }
        }

        loadCachedData();
    }, []);

    useEffect(() => {
        const cleanup = async () => {
            await clearAllEmailCaches();
        };

        return () => {
            cleanup();
        };
    }, []);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const fetchMailWithRetry = async (
        tabId: number,
        domain: string,
        retryCount = 0
    ): Promise<FetchResult> => {
        try {
            console.log(`[useMail] Fetch attempt ${retryCount + 1}/${MAX_RETRIES}`);

            const result = await sendChromeMessage<FetchResult>({
                action: 'FETCH_MAIL',
                tabId,
                domain,
            });

            return result;
        } catch (err) {
            if (retryCount < MAX_RETRIES - 1) {
                console.log(`[useMail] Retry ${retryCount + 1} after error:`, err);
                await sleep(RETRY_DELAY * (retryCount + 1));
                return fetchMailWithRetry(tabId, domain, retryCount + 1);
            }
            throw err;
        }
    };

    const loadAttachmentsContent = useCallback(
        async (tabId: number, domain: string, email: EmailData, effectiveUrl?: string): Promise<void> => {
            if (email.attachments.length === 0) {
                setAttachmentsLoading(false);
                return;
            }

            if (email.attachments.every(att => att.status === 'ready')) {
                setAttachmentsLoading(false);
                return;
            }

            console.log('[useMail] Loading attachment content asynchronously');
            setAttachmentsLoading(true);

            let latestEmailData: EmailData = email;
            let encounteredError: string | null = null;

            setEmailData(latestEmailData);

            const applyAttachment = (attachment: Attachment) => {
                const exists = latestEmailData.attachments.some(att => att.id === attachment.id);
                if (!exists) {
                    return;
                }

                latestEmailData = {
                    ...latestEmailData,
                    attachments: latestEmailData.attachments.map(att =>
                        att.id === attachment.id ? attachment : att
                    ),
                };
                setEmailData(latestEmailData);
            };

            for (const attachment of email.attachments) {
                applyAttachment({
                    ...attachment,
                    status: 'processing',
                    error: undefined,
                });

                try {
                    const result = await sendChromeMessage<FetchAttachmentContentResult>({
                        action: 'FETCH_ATTACHMENT_CONTENT',
                        tabId,
                        domain,
                        attachmentId: attachment.id,
                    });

                    if (result.attachment) {
                        applyAttachment(result.attachment);
                    }

                    if (!result.success) {
                        encounteredError = result.error || encounteredError;
                    }
                } catch (err) {
                    const errorMessage = getErrorMessage(err, 'Erreur lors du chargement des pièces jointes');
                    encounteredError = errorMessage;

                    applyAttachment({
                        ...attachment,
                        status: 'error',
                        base64Data: undefined,
                        error: errorMessage,
                    });
                }
            }

            const finalEmailData = latestEmailData;
            const allReady = finalEmailData.attachments.every(att => att.status === 'ready');

            if (allReady && effectiveUrl) {
                await cacheEmailData(effectiveUrl, finalEmailData);
            }

            if (encounteredError) {
                setError(encounteredError);
            }

            setAttachmentsLoading(false);
        },
        []
    );

    const fetchMail = useCallback(
        async (tabId: number, domain: string, url?: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');
                setAttachmentsLoading(false);

                console.log('[useMail] Fetching email from', domain);

                const effectiveUrl = url || currentUrl;
                const result = await fetchMailWithRetry(tabId, domain);

                if (result.success && result.emailData) {

                    const cached = effectiveUrl
                        ? await getCachedEmailData(effectiveUrl, result.emailData.id)
                        : null;

                    if (cached && cached.id === result.emailData.id && cached.attachments.length > 0) {
                        console.log('[useMail] Same email, using cached attachments');
                        setEmailData(cached);
                        setAttachmentsLoading(false);
                    } else {
                        console.log('[useMail] New email or no cache, using fresh data');
                        setEmailData(result.emailData);
                        await loadAttachmentsContent(tabId, domain, result.emailData, effectiveUrl);
                    }

                    console.log('[useMail] Email fetched:', {
                        id: result.emailData.id,
                        subject: result.emailData.subject,
                        attachments: result.emailData.attachments.length
                    });
                    return true;
                } else {
                    setError(result.error || 'Failed to fetch email');
                    setEmailData(null);
                    return false;
                }
            } catch (err) {
                const errorMessage = getErrorMessage(err, 'Failed to fetch email');
                setError(errorMessage);
                console.error('[useMail] Fetch error:', err);
                setEmailData(null);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [currentUrl, loadAttachmentsContent]
    );

    const processMail = useCallback(
        async (): Promise<boolean> => {
            if (!emailData) {
                setError('No email data to process');
                return false;
            }

            try {
                setProcessing(true);
                setError('');

                console.log('[useMail] Processing email');

                const result = await sendChromeMessage<ProcessResult>({
                    action: 'PROCESS_MAIL',
                    emailData: emailData,
                });

                if (result.success) {
                    console.log('[useMail] Email processed successfully');
                    return true;
                } else {
                    setError(result.error || 'Failed to process email');
                    return false;
                }
            } catch (err) {
                const errorMessage = getErrorMessage(err, 'Failed to process email');
                setError(errorMessage);
                console.error('[useMail] Process error:', err);
                return false;
            } finally {
                setProcessing(false);
            }
        },
        [emailData]
    );

    const clearMail = useCallback(() => {
        setEmailData(null);
        setError('');
        setAttachmentsLoading(false);
    }, []);

    const attachmentsReady = useMemo(() => {
        if (!emailData) return true;
        if (emailData.attachments.length === 0) return true;
        return emailData.attachments.every(att => att.status === 'ready');
    }, [emailData]);

    return {
        emailData,
        attachments: emailData?.attachments || [],
        loading,
        error,
        processing,
        attachmentsLoading,
        attachmentsReady,
        fetchMail,
        processMail,
        clearMail,
    };
}
