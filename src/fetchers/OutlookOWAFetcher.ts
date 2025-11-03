import { SUPPORTED_DOMAINS } from "../shared/constants";
import { DEFAULT_OUTLOOK_SELECTORS, OutlookFetcherBase } from "./OutlookFetcher";

export class OutlookOWAFetcher extends OutlookFetcherBase {
    constructor() {
        super(SUPPORTED_DOMAINS.OUTLOOK_OWA, DEFAULT_OUTLOOK_SELECTORS);
    }

    protected get emailIdPrefix(): string {
        return 'outlook_owa';
    }

    protected get urlIdExtractors(): Array<(url: string) => string | null> {
        return [
            (url: string) => {
                const match = url.match(/ItemID=([^&]+)/);
                return match ? match[1] : null;
            },
        ];
    }
}
