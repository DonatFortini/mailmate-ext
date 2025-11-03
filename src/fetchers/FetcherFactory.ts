import { SUPPORTED_DOMAINS, type SupportedDomain } from "../shared/constants";
import type { MailFetcher } from "./MailFetcher";
import { GmailFetcher } from "./GmailFetcher";
import { OutlookLiveFetcher } from "./OutlookLiveFetcher";
import { OutlookOWAFetcher } from "./OutlookOWAFetcher";

export class FetcherFactory {
    private static fetcherInstances = new Map<SupportedDomain, MailFetcher>();

    static getFetcher(domain: string): MailFetcher {
        const normalizedDomain = this.normalizeDomain(domain);

        if (!normalizedDomain) {
            throw new Error(`Unsupported domain: ${domain}`);
        }

        if (this.fetcherInstances.has(normalizedDomain)) {
            return this.fetcherInstances.get(normalizedDomain)!;
        }

        const fetcher = this.createFetcher(normalizedDomain);
        this.fetcherInstances.set(normalizedDomain, fetcher);

        console.log(`[FetcherFactory] Created ${normalizedDomain} fetcher`);
        return fetcher;
    }

    private static createFetcher(domain: SupportedDomain): MailFetcher {
        switch (domain) {
            case SUPPORTED_DOMAINS.GMAIL:
                return new GmailFetcher();
            case SUPPORTED_DOMAINS.OUTLOOK_LIVE:
                return new OutlookLiveFetcher();
            case SUPPORTED_DOMAINS.OUTLOOK_OWA:
                return new OutlookOWAFetcher();
            default:
                throw new Error(`No fetcher implementation for: ${domain}`);
        }
    }

    private static normalizeDomain(domain: string): SupportedDomain | null {
        const hostname = this.extractHostname(domain);

        if (this.isGmailDomain(hostname)) {
            return SUPPORTED_DOMAINS.GMAIL;
        }

        if (this.isOutlookLiveDomain(hostname)) {
            return SUPPORTED_DOMAINS.OUTLOOK_LIVE;
        }

        if (this.isOutlookOwaDomain(hostname)) {
            return SUPPORTED_DOMAINS.OUTLOOK_OWA;
        }

        return null;
    }

    private static extractHostname(domain: string): string {
        if (!domain) {
            return '';
        }

        try {
            const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
            return url.hostname.toLowerCase();
        } catch {
            return domain.split('/')[0].toLowerCase();
        }
    }

    private static isGmailDomain(hostname: string): boolean {
        return hostname.includes('google') || hostname.includes('gmail');
    }

    private static isOutlookLiveDomain(hostname: string): boolean {
        return hostname === 'outlook.live.com' || hostname.endsWith('.outlook.live.com');
    }

    private static isOutlookOwaDomain(hostname: string): boolean {
        if (this.isOutlookLiveDomain(hostname)) {
            return false;
        }

        return hostname.startsWith('outlook.') ||
            hostname.includes('office365') ||
            hostname.includes('office.com');
    }

    static isSupported(domain: string): boolean {
        return this.normalizeDomain(domain) !== null;
    }

    static getDomainType(domain: string): SupportedDomain | null {
        return this.normalizeDomain(domain);
    }

    static clearCache(): void {
        this.fetcherInstances.clear();
        console.log('[FetcherFactory] Cache cleared');
    }

    static clearFetcher(domain: string): void {
        const normalizedDomain = this.normalizeDomain(domain);
        if (normalizedDomain && this.fetcherInstances.has(normalizedDomain)) {
            this.fetcherInstances.delete(normalizedDomain);
            console.log(`[FetcherFactory] Cleared ${normalizedDomain} fetcher`);
        }
    }
}
