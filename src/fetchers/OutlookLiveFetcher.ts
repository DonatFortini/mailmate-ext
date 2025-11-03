import { SUPPORTED_DOMAINS } from "../shared/constants";
import { DEFAULT_OUTLOOK_SELECTORS, OutlookFetcherBase, type OutlookSelectors } from "./OutlookFetcher";

const LIVE_SELECTORS: OutlookSelectors = {
    readingPane: [
        ...DEFAULT_OUTLOOK_SELECTORS.readingPane,
        'div[data-app-section="MailReadingPaneContainerLive"]',
        'div[class*="ReadingPaneContainer"]',
    ],
    subject: [
        ...DEFAULT_OUTLOOK_SELECTORS.subject,
        'span[class*="subjectLine"]',
        'div[data-app-section="SubjectLine"] span',
    ],
    sender: [
        ...DEFAULT_OUTLOOK_SELECTORS.sender,
        'span[class*="SenderPersona"] span',
    ],
    recipients: [
        ...DEFAULT_OUTLOOK_SELECTORS.recipients,
        'div[data-app-section="RecipientsLine"] span[class*="name"]',
    ],
    body: [...DEFAULT_OUTLOOK_SELECTORS.body],
    attachmentContainer: [...DEFAULT_OUTLOOK_SELECTORS.attachmentContainer],
    attachmentElements: [
        ...DEFAULT_OUTLOOK_SELECTORS.attachmentElements,
        'div[data-automation-id*="AttachmentCard"]',
    ],
};

export class OutlookLiveFetcher extends OutlookFetcherBase {
    constructor() {
        super(SUPPORTED_DOMAINS.OUTLOOK_LIVE, LIVE_SELECTORS);
    }

    protected get emailIdPrefix(): string {
        return 'outlook_live';
    }

    protected get urlIdExtractors(): Array<(url: string) => string | null> {
        return [
            (url: string) => {
                const match = url.match(/\/mail\/id\/([^/?]+)/);
                return match ? match[1] : null;
            },
        ];
    }

    protected getEmailSubject(): string {
        const headerSubject = this.findHeaderSubject();
        if (headerSubject) {
            return headerSubject;
        }

        return super.getEmailSubject();
    }

    protected getEmailSender(): string {
        const headerSender = this.findHeaderSender();
        if (headerSender) {
            return headerSender;
        }

        return super.getEmailSender();
    }

    protected getEmailRecipients(): string[] {
        const baseRecipients = super.getEmailRecipients();
        const recipients = new Set<string>(baseRecipients);
        this.findHeaderRecipients().forEach(recipient => recipients.add(recipient));
        return Array.from(recipients);
    }

    private findHeaderSubject(): string | null {
        const selectors = [
            '[class*="Subject"]',
            '[aria-label*="Subject"]',
            'div[role="heading"]',
            'h1',
            'h2',
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of Array.from(elements)) {
                if (this.isInsideReadingPane(element)) continue;

                const text = element.textContent?.trim();
                if (!text) continue;
                if (text.length <= 3 || text.length >= 200) continue;
                if (text.toLowerCase().includes('forwarded message')) continue;
                if (text.includes('@')) continue;

                return text;
            }
        }

        return null;
    }

    private findHeaderSender(): string | null {
        const selectors = [
            'button[aria-label*="From"]',
            'button[class*="Persona"]',
            '[class*="sender"]',
            '[class*="Sender"]',
            '[aria-label*="De"]',
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of Array.from(elements)) {
                if (this.isInsideReadingPane(element)) continue;

                const htmlElement = element as HTMLElement;
                const ariaLabel = htmlElement.getAttribute('aria-label');
                const text = htmlElement.textContent?.trim();
                const content = ariaLabel || text;
                if (!content) continue;

                const emailMatch = content.match(/^([^<]+)</);
                if (emailMatch) {
                    return emailMatch[1].trim();
                }

                const parts = content.split('<');
                if (parts.length > 1) {
                    return parts[0].trim();
                }

                if (!content.includes('@') && content.length > 2 && content.length < 100) {
                    return content;
                }
            }
        }

        return null;
    }

    private findHeaderRecipients(): string[] {
        const selectors = [
            'button[aria-label*="To"]',
            '[aria-label*="À"]',
            '[class*="recipient"]',
            '[class*="Recipient"]',
        ];

        const results: string[] = [];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            for (const element of Array.from(elements)) {
                if (this.isInsideReadingPane(element)) continue;

                const htmlElement = element as HTMLElement;
                const ariaLabel = htmlElement.getAttribute('aria-label');
                const text = htmlElement.textContent?.trim();
                const content = ariaLabel || text;
                if (!content) continue;

                const cleaned = content.replace(/^(To|À):\s*/i, '').trim();
                const emails = cleaned
                    .split(/[;,]/)
                    .map(value => value.trim())
                    .filter(Boolean);

                emails.forEach(email => {
                    if (email.length > 2) {
                        results.push(email);
                    }
                });
            }
        });

        return results;
    }

    private isInsideReadingPane(element: Element): boolean {
        const pane = this.getReadingPane();
        return pane ? pane.contains(element) : false;
    }
}
