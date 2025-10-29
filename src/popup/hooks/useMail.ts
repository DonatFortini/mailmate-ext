import { useState, useCallback, useEffect } from 'react';
import type { EmailData, FetchResult, ProcessResult } from '../../shared/types';
import { sendChromeMessage, getErrorMessage } from '../../shared/utils';
import {
    cacheEmailData,
    getCachedEmailData,
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

    useEffect(() => {
        async function loadCachedData() {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const tab = tabs[0];

                if (!tab?.url) return;

                setCurrentUrl(tab.url);

                const cached = await getCachedEmailData(tab.url);
                if (cached) {
                    console.log('[useMail] Restored from cache');
                    setEmailData(cached);
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

    const fetchMail = useCallback(
        async (tabId: number, domain: string, url?: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');

                console.log('[useMail] Fetching email from', domain);

                const effectiveUrl = url || currentUrl;
                if (effectiveUrl) {
                    const cached = await getCachedEmailData(effectiveUrl);
                    if (cached && cached.attachments.length > 0) {
                        console.log('[useMail] Using cached data');
                        setEmailData(cached);
                        setLoading(false);
                        return true;
                    }
                }

                const result = await fetchMailWithRetry(tabId, domain);

                if (result.success && result.emailData) {
                    setEmailData(result.emailData);

                    if (effectiveUrl) {
                        await cacheEmailData(effectiveUrl, result.emailData);
                    }

                    console.log('[useMail] Email fetched:', {
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
        [currentUrl]
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
    }, []);

    return {
        emailData,
        attachments: emailData?.attachments || [],
        loading,
        error,
        processing,
        fetchMail,
        processMail,
        clearMail,
    };
}
