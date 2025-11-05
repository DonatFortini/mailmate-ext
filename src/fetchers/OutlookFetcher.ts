import type { SupportedDomain } from "../shared/constants";
import type { EmailData } from "../shared/types";
import { MailFetcher } from "./MailFetcher";
import { FileUtils, HtmlSanitizer } from "../shared/utils";

type UrlExtractor = (url: string) => string | null;

export type OutlookSelectors = {
    readingPane: string[];
    subject: string[];
    sender: string[];
    recipients: string[];
    body: string[];
    attachmentContainer: string[];
    attachmentElements: string[];
};

export const DEFAULT_OUTLOOK_SELECTORS: OutlookSelectors = {
    readingPane: [
        'div[role="region"][aria-label*="eading"]',
        'div[role="document"]',
        'div[role="main"]',
        'div[class*="ReadingPane"]',
        'div[class*="MessageContainer"]',
        '[data-app-section="MailReadingPaneContainer"]',
    ],
    subject: [
        'div[role="heading"]',
        'span[class*="Subject"]',
        'div[class*="subject"]',
        '[aria-label*="Subject"]',
        'h1[class*="subject"]',
        'div[data-app-section="SubjectLine"]',
    ],
    sender: [
        'div[class*="From"] span',
        'button[aria-label*="From"]',
        'div[class*="PersonaCard"]',
        'div[class*="sender"]',
        'span[class*="senderName"]',
        '[data-app-section="SenderLine"]',
    ],
    recipients: [
        'div[class*="To"] span',
        'div[class*="Recipient"]',
        'span[class*="recipient"]',
        '[aria-label*="To:"]',
        '[data-app-section="RecipientsLine"]',
    ],
    body: [
        'div[aria-label*="Message body"]',
        'div[class*="MessageBody"]',
        'div[class*="ItemBody"]',
        'div[class*="bodyContent"]',
        '[data-app-section="MessageBody"]',
        'div[role="document"] div[dir="ltr"]',
    ],
    attachmentContainer: [
        'div.attachmentWell',
        'div[class*="_ay_"]',
        'div[data-automation-id="AttachmentList"]',
        'div[class*="AttachmentWell"]',
        'div[class*="attachmentContainer"]',
        'div[class*="Attachments"]',
        '[data-app-section="AttachmentWell"]',
        'div[role="group"][aria-label*="ttachment"]',
        'div[role="list"]',
    ],
    attachmentElements: [
        'a._ay_I.o365button',
        'a[class*="_ay_I"]',
        'div[draggable="true"]',
        'div[role="attachment"]',
        'div[role="listitem"][aria-label*="ttachment"]',
        'button[class*="AttachmentLink"]',
        'a[class*="AttachmentLink"]',
        'div[class*="FileAttachment"]',
        'button[data-automation-id*="FileAttachment"]',
    ],
};

export abstract class OutlookFetcherBase extends MailFetcher {
    protected selectors: OutlookSelectors;
    private readingPaneCache: Element | null | undefined;
    private selectorStringCache = new Map<keyof OutlookSelectors, string>();

    protected constructor(domain: SupportedDomain, selectors: OutlookSelectors = DEFAULT_OUTLOOK_SELECTORS) {
        super(domain);
        this.selectors = this.cloneSelectors(selectors);
    }

    protected get emailIdPrefix(): string {
        return 'outlook';
    }

    protected get urlIdExtractors(): UrlExtractor[] {
        return [];
    }

    protected get fallbackIdAttributes(): string[] {
        return ['data-convid', 'data-itemid', 'data-message-id'];
    }

    protected get readingPaneFallbackSelector(): string | null {
        return '[class*="reading" i], [class*="message" i][role]';
    }

    private cloneSelectors(source: OutlookSelectors): OutlookSelectors {
        return {
            readingPane: [...source.readingPane],
            subject: [...source.subject],
            sender: [...source.sender],
            recipients: [...source.recipients],
            body: [...source.body],
            attachmentContainer: [...source.attachmentContainer],
            attachmentElements: [...source.attachmentElements],
        };
    }

    protected invalidateCaches(): void {
        this.readingPaneCache = undefined;
        this.selectorStringCache.clear();
    }

    private getSelectorString(key: keyof OutlookSelectors): string {
        if (this.selectorStringCache.has(key)) {
            return this.selectorStringCache.get(key) as string;
        }

        const selectors = this.selectors[key];
        const value = selectors.length > 0 ? selectors.join(',') : '';
        this.selectorStringCache.set(key, value);
        return value;
    }

    protected findElement(selectors: string[]): Element | null {
        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    return element;
                }
            } catch (error) {
            }
        }
        return null;
    }

    protected findElementsInParent(parent: Element, selectors: string[]): Element[] {
        const found = new Set<Element>();
        selectors.forEach(selector => {
            try {
                parent.querySelectorAll(selector).forEach(el => found.add(el));
            } catch (error) {
            }
        });
        return Array.from(found);
    }

    protected getReadingPane(): Element | null {
        if (this.readingPaneCache && document.contains(this.readingPaneCache)) {
            return this.readingPaneCache;
        }

        const pane = this.findElement(this.selectors.readingPane);
        if (pane) {
            this.readingPaneCache = pane;
            return pane;
        }

        const fallbackSelector = this.readingPaneFallbackSelector;
        if (!fallbackSelector) {
            this.readingPaneCache = null;
            return null;
        }

        const fallbackPane = document.querySelector(fallbackSelector);
        this.readingPaneCache = fallbackPane;
        return fallbackPane;
    }

    protected getEmailId(): string {
        const url = window.location.href;

        for (const extract of this.urlIdExtractors) {
            try {
                const value = extract(url);
                if (value) {
                    return `${this.emailIdPrefix}_${value}`;
                }
            } catch (error) {
            }
        }

        const pane = this.getReadingPane();
        if (pane) {
            for (const attr of this.fallbackIdAttributes) {
                const container = pane.closest(`[${attr}]`);
                const value = container?.getAttribute(attr);
                if (value) {
                    return `${this.emailIdPrefix}_${value}`;
                }
            }
        }

        return FileUtils.generateIdWithPrefix(this.emailIdPrefix);
    }

    async fetchEmailData(): Promise<EmailData> {
        this.invalidateCaches();
        return super.fetchEmailData();
    }

    protected getEmailSubject(): string {
        const pane = this.getReadingPane();
        if (!pane) return 'No Subject';

        const strategies: Array<() => string | null> = [
            () => {
                const selector = this.getSelectorString('subject');
                const subject = selector ? pane.querySelector(selector) : null;
                return subject?.textContent?.trim() ?? null;
            },
            () => {
                const headings = pane.querySelectorAll('h1, h2, h3, [role="heading"]');
                for (const heading of Array.from(headings)) {
                    const text = heading.textContent?.trim();
                    if (text && text.length > 3 && text.length < 200) {
                        return text;
                    }
                }
                return null;
            },
            () => {
                const boldElements = pane.querySelectorAll('strong, b, [style*="font-weight"]');
                for (const el of Array.from(boldElements).slice(0, 5)) {
                    const text = el.textContent?.trim();
                    if (text && text.length > 3 && text.length < 200) {
                        return text;
                    }
                }
                return null;
            },
        ];

        for (const strategy of strategies) {
            try {
                const result = strategy();
                if (result) return result;
            } catch (error) {
            }
        }

        return 'No Subject';
    }

    protected getEmailSender(): string {
        const pane = this.getReadingPane();
        if (!pane) return 'Unknown Sender';

        const selector = this.getSelectorString('sender');
        const senderElement = selector ? pane.querySelector(selector) : null;
        if (senderElement) {
            const text = senderElement.textContent?.trim() ||
                senderElement.getAttribute('aria-label') ||
                senderElement.getAttribute('title');

            if (text) {
                const cleaned = text.replace(/^From:\s*/i, '').trim();
                const match = cleaned.match(/^([^<]+)</);
                if (match) {
                    return match[1].trim();
                }
                return cleaned;
            }
        }

        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const firstPart = pane.innerHTML.substring(0, 2000);
        const match = firstPart.match(emailRegex);
        if (match) return match[1];

        return 'Unknown Sender';
    }

    protected getEmailRecipients(): string[] {
        const recipients = new Set<string>();
        const pane = this.getReadingPane();
        if (!pane) {
            return [];
        }

        const selector = this.getSelectorString('recipients');
        const recipientElements = selector ? pane.querySelectorAll(selector) : [];
        recipientElements.forEach(element => {
            const text = element.textContent?.trim() ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title');

            if (text) {
                const cleaned = text.replace(/^(To|À):\s*/i, '').trim();
                cleaned.split(/[;,]/)
                    .map(value => value.trim())
                    .filter(Boolean)
                    .forEach(value => recipients.add(value));
            }
        });

        return Array.from(recipients);
    }

    protected getEmailBody(): string {
        const pane = this.getReadingPane();
        if (!pane) {
            return '';
        }

        for (const selector of this.selectors.body) {
            try {
                const bodyElement = pane.querySelector(selector);
                if (bodyElement) {
                    const html = bodyElement.innerHTML.trim();
                    if (html) {
                        return HtmlSanitizer.htmlToText(html);
                    }
                }
            } catch (error) {
            }
        }
        const text = pane.textContent?.trim() || '';
        return text.substring(0, 5000);
    }

    protected getAttachmentElements(): HTMLElement[] {
        const pane = this.getReadingPane();
        if (!pane) {
            return [];
        }

        const container = this.findElement(this.selectors.attachmentContainer);
        const selectors = container
            ? this.getContainerAttachmentSelectors()
            : this.getPaneAttachmentSelectors();

        const root = container ?? pane;
        return this.collectAttachments(root, selectors);
    }

    private collectAttachments(root: Element, selectors: string[]): HTMLElement[] {
        const results = new Set<HTMLElement>();

        selectors.forEach(selector => {
            try {
                root.querySelectorAll(selector).forEach(node => {
                    const element = node as HTMLElement;
                    if (this.isAttachmentCandidate(element)) {
                        results.add(element);
                    }
                });
            } catch (error) {
            }
        });

        return Array.from(results);
    }

    private getContainerAttachmentSelectors(): string[] {
        return [
            ...this.selectors.attachmentElements,
            '[class*="file" i]',
            '[class*="attachment" i]',
            'div[class*="AttachmentCard"]',
            'div[class*="FileCard"]',
            'div[class*="FileItem"]',
            'span[class*="AttachmentName"]',
            '[role="button"][aria-label*="file"]',
            '[role="button"][aria-label*="attachment"]',
            '[role="button"][aria-label*="fichier"]',
            'button[data-automation-id*="file"]',
            'a[href*="attachment"]',
            '[download]'
        ];
    }

    private getPaneAttachmentSelectors(): string[] {
        return [
            ...this.selectors.attachmentElements,
            '[class*="attachment" i]',
            '[class*="AttachmentCard" i]',
            '[class*="FilePreview" i]',
            '[class*="FileCard" i]',
            '[class*="FileItem" i]',
            'button[download]',
            'a[download]',
            '[role="button"][aria-label*="attachment" i]',
            '[role="button"][aria-label*="file" i]',
            '[role="button"][aria-label*="fichier" i]',
            'div[data-automation-id*="FileAttachment"]',
            'div[class*="FileContainer"]',
            'span[class*="fileName"]',
            'button[class*="fileButton"]'
        ];
    }

    private isAttachmentCandidate(element: HTMLElement): boolean {
        if (!element) {
            return false;
        }

        if (element.hasAttribute('download') || element.getAttribute('role') === 'attachment') {
            return true;
        }

        const text = element.textContent || '';
        if (!text) {
            return Boolean(element.getAttribute('href') || element.getAttribute('data-attachment-url'));
        }

        const hasExtension = /\.(pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|zip|txt|ppt|pptx)/i.test(text);
        const hasSize = /\d+\s*(Ko|Mo|KB|MB|Go|GB)/i.test(text);
        if (!hasExtension && !hasSize) {
            return Boolean(element.querySelector('[download], [data-attachment-url], [data-url], [href]'));
        }

        const navigationTerms = ['Boîte de réception', 'Brouillons', 'Courrier indésirable', 'Éléments envoyés', 'Éléments supprimés', 'Archive', 'Historique'];
        return !navigationTerms.some(term => text.includes(term));
    }
    protected getSourceUrlAndName(element: HTMLElement): [string, string] {

        if (element.tagName === 'A' && element.className.includes('_ay_I')) {
            const anchor = element as HTMLAnchorElement;
            const ariaLabel = anchor.getAttribute('aria-label') || '';
            const text = anchor.textContent?.trim() || '';
            let name = ariaLabel || text;
            name = name.split(/\s+\d+\s*(Ko|Mo|KB|MB|Go|GB)/i)[0].trim();
            return [anchor.href, name || 'attachment'];
        }

        if (element instanceof HTMLAnchorElement || element.tagName === 'A') {
            const anchor = element as HTMLAnchorElement;
            const name = anchor.getAttribute('download') ||
                anchor.getAttribute('aria-label') ||
                anchor.getAttribute('title') ||
                anchor.textContent?.trim() ||
                'attachment';
            return [anchor.href, name];
        }

        const dataUrl = element.getAttribute('data-attachment-url') ||
            element.getAttribute('data-url') ||
            element.getAttribute('data-src') ||
            element.getAttribute('href');

        const dataName = element.getAttribute('data-attachment-name') ||
            element.getAttribute('data-name') ||
            element.getAttribute('data-filename') ||
            element.getAttribute('aria-label') ||
            element.getAttribute('title');

        if (dataUrl && dataName) {
            return [dataUrl, dataName];
        }

        const fileNameElement = element.querySelector('[class*="fileName" i], [class*="AttachmentName" i], span[class*="name" i], span._ay_x');
        const fileName = fileNameElement?.textContent?.trim();

        const downloadLink = element.querySelector('a[href], a[download], button[download]');
        if (downloadLink) {
            const url = (downloadLink as HTMLAnchorElement).href ||
                downloadLink.getAttribute('data-url') ||
                downloadLink.getAttribute('data-attachment-url') ||
                '';
            const name = fileName ||
                downloadLink.getAttribute('download') ||
                downloadLink.getAttribute('aria-label') ||
                downloadLink.textContent?.trim() ||
                'attachment';
            return [url, name];
        }

        const onclick = element.getAttribute('onclick') || '';
        const urlMatch = onclick.match(/https?:\/\/[^\s'\"]+/);
        if (urlMatch && fileName) {
            return [urlMatch[0], fileName];
        }

        const nestedImage = element.querySelector('img[src]') as HTMLImageElement | null;
        if (nestedImage && nestedImage.src.startsWith('http')) {
            const name = nestedImage.alt ||
                nestedImage.title ||
                fileName ||
                'image';
            return [nestedImage.src, name];
        }

        if (element instanceof HTMLImageElement) {
            return [element.src, element.alt || element.title || 'image'];
        }

        const anyLink = element.querySelector('[href]');
        if (anyLink) {
            const url = (anyLink as HTMLAnchorElement).href ||
                anyLink.getAttribute('href') ||
                '';
            const name = fileName ||
                element.getAttribute('aria-label') ||
                element.textContent?.trim() ||
                'attachment';
            return [url, name];
        }

        const fallbackName = fileName ||
            element.getAttribute('aria-label') ||
            element.textContent?.trim() ||
            'attachment';
        return ['', fallbackName];
    }
}
