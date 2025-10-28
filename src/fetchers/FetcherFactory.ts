import { SUPPORTED_DOMAINS, type SupportedDomain } from "../shared/constants";
import type { AttachmentFetcher } from "./AttachmentFetcher";
import { GmailFetcher } from "./GmailFetcher";
import { OutlookFetcher } from "./OutlookFetcher";

export class FetcherFactory {
    private static fetcherInstances = new Map<SupportedDomain, AttachmentFetcher>();

    /**
     * Create or get cached fetcher for domain
     */
    static getFetcher(domain: string): AttachmentFetcher {
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

    /**
     * Create fetcher instance based on domain
     */
    private static createFetcher(domain: SupportedDomain): AttachmentFetcher {
        switch (domain) {
            case SUPPORTED_DOMAINS.GMAIL:
                return new GmailFetcher();

            case SUPPORTED_DOMAINS.OUTLOOK:
                return new OutlookFetcher();

            default:
                throw new Error(`No fetcher implementation for: ${domain}`);
        }
    }

    /**
     * Normalize domain to supported domain constant
     */
    private static normalizeDomain(domain: string): SupportedDomain | null {
        const hostname = domain.toLowerCase();
        if (hostname.includes('google') || hostname.includes('gmail')) {
            return SUPPORTED_DOMAINS.GMAIL;
        }
        if (hostname.includes('outlook') ||
            hostname.includes('office365') ||
            hostname.includes('office.com')) {
            return SUPPORTED_DOMAINS.OUTLOOK;
        }

        return null;
    }

    /**
     * Check if domain is supported
     */
    static isSupported(domain: string): boolean {
        return this.normalizeDomain(domain) !== null;
    }

    /**
     * Get supported domain type
     */
    static getDomainType(domain: string): SupportedDomain | null {
        return this.normalizeDomain(domain);
    }

    /**
     * Clear all cached fetchers
     */
    static clearCache(): void {
        this.fetcherInstances.forEach(fetcher => fetcher.clearProcessedUrls());
        this.fetcherInstances.clear();
        console.log('[FetcherFactory] Cache cleared');
    }

    /**
     * Clear specific fetcher cache
     */
    static clearFetcher(domain: string): void {
        const normalizedDomain = this.normalizeDomain(domain);
        if (normalizedDomain && this.fetcherInstances.has(normalizedDomain)) {
            const fetcher = this.fetcherInstances.get(normalizedDomain)!;
            fetcher.clearProcessedUrls();
            this.fetcherInstances.delete(normalizedDomain);
            console.log(`[FetcherFactory] Cleared ${normalizedDomain} fetcher`);
        }
    }
}