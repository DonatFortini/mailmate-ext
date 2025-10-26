import { useState, useCallback } from 'react';
import type { Attachment, FetchResult, ProcessResult } from '../../shared/types';
import { FileUtils } from '../../shared/utils';

export function useAttachments() {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    const sendMessage = useCallback(<T,>(message: any): Promise<T> => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response: T) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }, []);

    const fetchAttachments = useCallback(
        async (tabId: number, domain: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');

                console.log('[useAttachments] Fetching attachments from', domain);

                const result = await sendMessage<FetchResult>({
                    action: 'FETCH_ATTACHMENTS',
                    tabId,
                    domain,
                });

                if (result.success && result.attachments) {
                    const convertedAttachments = result.attachments.map((transferable) =>
                        FileUtils.transferableToAttachment(transferable)
                    );

                    setAttachments(convertedAttachments);
                    console.log(`[useAttachments] Fetched and converted ${convertedAttachments.length} attachments`);
                    return true;
                } else {
                    setError(result.error || 'Failed to fetch attachments');
                    setAttachments([]);
                    return false;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch attachments';
                setError(errorMessage);
                console.error('[useAttachments] Fetch error:', err);
                setAttachments([]);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [sendMessage]
    );

    const processAttachments = useCallback(
        async (attachmentsToProcess: Attachment[]): Promise<boolean> => {
            try {
                setProcessing(true);
                setError('');

                console.log('[useAttachments] Processing attachments');

                const result = await sendMessage<ProcessResult>({
                    action: 'PROCESS_ATTACHMENTS',
                    attachments: attachmentsToProcess,
                });

                if (result.success) {
                    console.log('[useAttachments] Attachments processed successfully');
                    return true;
                } else {
                    setError(result.error || 'Failed to process attachments');
                    return false;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to process attachments';
                setError(errorMessage);
                console.error('[useAttachments] Process error:', err);
                return false;
            } finally {
                setProcessing(false);
            }
        },
        [sendMessage]
    );

    const clearAttachments = useCallback(() => {
        setAttachments([]);
        setError('');
    }, []);

    return {
        attachments,
        loading,
        error,
        processing,
        fetchAttachments,
        processAttachments,
        clearAttachments,
    };
}
