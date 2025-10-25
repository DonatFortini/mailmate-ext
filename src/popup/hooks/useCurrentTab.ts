// src/popup/hooks/useCurrentTab.ts

import { useState, useEffect } from 'react';
import { extractDomain, isDomainSupported } from '../../shared/utils';

export interface TabInfo {
    id: number;
    url: string;
    domain: string;
    isSupported: boolean;
}

export function useCurrentTab() {
    const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getCurrentTab() {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const tab = tabs[0];

                if (!tab?.url || !tab.id) {
                    setTabInfo(null);
                    return;
                }

                const domain = extractDomain(tab.url);
                const isSupported = isDomainSupported(domain);

                setTabInfo({
                    id: tab.id,
                    url: tab.url,
                    domain,
                    isSupported,
                });
            } catch (error) {
                console.error('[useCurrentTab] Error getting current tab:', error);
                setTabInfo(null);
            } finally {
                setLoading(false);
            }
        }

        getCurrentTab();
    }, []);

    return { tabInfo, loading };
}