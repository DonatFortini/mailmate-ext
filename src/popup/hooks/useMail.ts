import { useState, useCallback } from 'react';
import type { EmailData, FetchResult, ProcessResult } from '../../shared/types';
import { sendChromeMessage, getErrorMessage } from '../../shared/utils';

export function useMail() {
    const [emailData, setEmailData] = useState<EmailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    const fetchMail = useCallback(
        async (tabId: number, domain: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');

                console.log('[useMail] Fetching email from', domain);

                const result = await sendChromeMessage<FetchResult>({
                    action: 'FETCH_MAIL',
                    tabId,
                    domain,
                });

                if (result.success && result.emailData) {
                    setEmailData(result.emailData);
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
        []
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