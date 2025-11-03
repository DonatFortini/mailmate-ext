import type { SupportedDomain } from "../shared/constants";
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

    protected findElement(selectors: string[]): Element | null {
        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`[OutlookFetcher] Found element with selector: ${selector}`);
                    return element;
                }
            } catch (error) {
                console.warn(`[OutlookFetcher] Invalid selector skipped: ${selector}`, error);
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
                console.warn(`[OutlookFetcher] Invalid nested selector skipped: ${selector}`, error);
            }
        });
        return Array.from(found);
    }

    protected getReadingPane(): Element | null {
        const pane = this.findElement(this.selectors.readingPane);
        if (pane) {
            return pane;
        }

        const fallbackSelector = this.readingPaneFallbackSelector;
        if (!fallbackSelector) {
            return null;
        }

        console.warn('[OutlookFetcher] Reading pane not found, using fallback selector');
        return document.querySelector(fallbackSelector);
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
                console.warn('[OutlookFetcher] URL ID extractor error:', error);
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

    protected getEmailSubject(): string {
        const pane = this.getReadingPane();
        if (!pane) return 'No Subject';

        const strategies: Array<() => string | null> = [
            () => {
                const selector = this.selectors.subject.join(',');
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
                console.warn('[OutlookFetcher] Subject extraction strategy failed:', error);
            }
        }

        return 'No Subject';
    }

    protected getEmailSender(): string {
        const pane = this.getReadingPane();
        if (!pane) return 'Unknown Sender';

        const selector = this.selectors.sender.join(',');
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

        const selector = this.selectors.recipients.join(',');
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
                        console.log(`[OutlookFetcher] Found body with selector: ${selector}`);
                        return HtmlSanitizer.htmlToText(html);
                    }
                }
            } catch (error) {
                console.warn('[OutlookFetcher] Body selector failed:', selector, error);
            }
        }

        console.warn('[OutlookFetcher] Using fallback body extraction');
        const text = pane.textContent?.trim() || '';
        return text.substring(0, 5000);
    }

    protected getAttachmentElements(): HTMLElement[] {
        const pane = this.getReadingPane();
        if (!pane) {
            console.log('[OutlookFetcher] No reading pane found for attachments');
            return [];
        }

        console.log('[OutlookFetcher] DIAGNOSTIC: Searching for attachment indicators...');
        const diagnosticSelectors = [
            '[class*="attachment" i]',
            '[class*="file" i]',
            '[data-automation-id*="attachment" i]',
            '[aria-label*="attachment" i]',
            '[aria-label*="fichier" i]',
            'button[download]',
            'a[download]',
            'img[alt*="attachment" i]',
            '[role="attachment"]',
        ];

        diagnosticSelectors.forEach(selector => {
            try {
                const found = pane.querySelectorAll(selector);
                if (found.length > 0) {
                    console.log(`[OutlookFetcher] DIAGNOSTIC: Found ${found.length} elements matching: ${selector}`);
                    Array.from(found).slice(0, 2).forEach((el, idx) => {
                        const element = el as HTMLElement;
                        console.log(`[OutlookFetcher] DIAGNOSTIC: Element ${idx + 1}:`, {
                            tagName: element.tagName,
                            className: element.className,
                            id: element.id,
                            role: element.getAttribute('role'),
                            ariaLabel: element.getAttribute('aria-label'),
                            textContent: element.textContent?.substring(0, 50),
                            dataAttributes: Array.from(element.attributes)
                                .filter(attr => attr.name.startsWith('data-'))
                                .map(attr => `${attr.name}="${attr.value}"`)
                                .join(', '),
                        });
                    });
                }
            } catch (error) {
                console.warn('[OutlookFetcher] Diagnostic selector failed:', selector, error);
            }
        });

        const container = this.findElement(this.selectors.attachmentContainer);

        if (!container) {
            console.log('[OutlookFetcher] No attachment container found with standard selectors');
            console.log('[OutlookFetcher] Attempting fallback search IN reading pane...');

            const broadSelectors = [
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
                'button[class*="fileButton"]',
            ];

            const elements = this.findElementsInParent(pane, broadSelectors);
            console.log(`[OutlookFetcher] Found ${elements.length} potential attachment elements via fallback IN pane`);

            const filtered = elements.filter((el: Element) => {
                const text = el.textContent || '';
                const hasExtension = /\.(pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|zip|txt|ppt|pptx)/i.test(text);
                const hasSize = /\d+\s*(Ko|Mo|KB|MB|Go|GB)/i.test(text);
                const isNavigation = text.includes('Boîte de réception') ||
                    text.includes('Brouillons') ||
                    text.includes('Courrier indésirable') ||
                    text.includes('Éléments envoyés') ||
                    text.includes('Éléments supprimés') ||
                    text.includes('Archive') ||
                    text.includes('Historique');

                return (hasExtension || hasSize) && !isNavigation;
            });

            console.log(`[OutlookFetcher] After filtering: ${filtered.length} attachments`);

            if (filtered.length > 0) {
                console.log('[OutlookFetcher] Sample attachment element classes:',
                    filtered.slice(0, 3).map(el => (el as HTMLElement).className).join(' | ')
                );
            }

            return filtered as HTMLElement[];
        }

        const attachments = new Set<HTMLElement>();
        const enhancedSelectors = [
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
            '[download]',
        ];

        for (const selector of enhancedSelectors) {
            try {
                const elements = container.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`[OutlookFetcher] Found ${elements.length} elements in container with: ${selector}`);
                }
                elements.forEach(el => {
                    const element = el as HTMLElement;
                    const text = element.textContent || '';
                    const hasExtension = /\.(pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|zip|txt|ppt|pptx)/i.test(text);
                    const hasSize = /\d+\s*(Ko|Mo|KB|MB|Go|GB)/i.test(text);
                    const isNavigation = text.includes('Boîte de réception') ||
                        text.includes('Brouillons') ||
                        text.includes('Courrier indésirable') ||
                        text.includes('Éléments') ||
                        text.includes('Archive') ||
                        text.includes('Historique');

                    if ((hasExtension || hasSize) && !isNavigation) {
                        attachments.add(element);
                    }
                });
            } catch (error) {
                console.warn('[OutlookFetcher] Attachment selector failed:', selector, error);
            }
        }

        console.log(`[OutlookFetcher] Total unique attachment elements: ${attachments.size}`);

        if (attachments.size === 0) {
            console.warn('[OutlookFetcher] No attachments found in container, dumping container HTML structure:');
            console.log(container.innerHTML.substring(0, 500));
        }

        return Array.from(attachments);
    }

    protected getSourceUrlAndName(element: HTMLElement): [string, string] {
        console.log('[OutlookFetcher] Extracting URL and name from element:', {
            tagName: element.tagName,
            className: element.className.substring(0, 100),
            ariaLabel: element.getAttribute('aria-label'),
        });

        if (element.tagName === 'A' && element.className.includes('_ay_I')) {
            const anchor = element as HTMLAnchorElement;
            const ariaLabel = anchor.getAttribute('aria-label') || '';
            const text = anchor.textContent?.trim() || '';
            let name = ariaLabel || text;
            name = name.split(/\s+\d+\s*(Ko|Mo|KB|MB|Go|GB)/i)[0].trim();

            console.log('[OutlookFetcher] Method 1 (OWA anchor):', { url: anchor.href, name });
            return [anchor.href, name || 'attachment'];
        }

        if (element instanceof HTMLAnchorElement || element.tagName === 'A') {
            const anchor = element as HTMLAnchorElement;
            const name = anchor.getAttribute('download') ||
                anchor.getAttribute('aria-label') ||
                anchor.getAttribute('title') ||
                anchor.textContent?.trim() ||
                'attachment';
            console.log('[OutlookFetcher] Method 2 (anchor):', { url: anchor.href, name });
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
            console.log('[OutlookFetcher] Method 3 (data attrs):', { url: dataUrl, name: dataName });
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
            console.log('[OutlookFetcher] Method 4 (nested link):', { url, name });
            return [url, name];
        }

        const onclick = element.getAttribute('onclick') || '';
        const urlMatch = onclick.match(/https?:\/\/[^\s'\"]+/);
        if (urlMatch && fileName) {
            console.log('[OutlookFetcher] Method 5 (onclick):', { url: urlMatch[0], name: fileName });
            return [urlMatch[0], fileName];
        }

        const nestedImage = element.querySelector('img[src]') as HTMLImageElement | null;
        if (nestedImage && nestedImage.src.startsWith('http')) {
            const name = nestedImage.alt ||
                nestedImage.title ||
                fileName ||
                'image';
            console.log('[OutlookFetcher] Method 6 (image):', { url: nestedImage.src, name });
            return [nestedImage.src, name];
        }

        if (element instanceof HTMLImageElement) {
            console.log('[OutlookFetcher] Method 7 (direct image):', { url: element.src, name: element.alt || 'image' });
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
            console.log('[OutlookFetcher] Method 8 (any link):', { url, name });
            return [url, name];
        }

        const fallbackName = fileName ||
            element.getAttribute('aria-label') ||
            element.textContent?.trim() ||
            'attachment';
        console.warn('[OutlookFetcher] No URL found, using fallback name:', fallbackName);
        return ['', fallbackName];
    }
}
