import { SUPPORTED_DOMAINS } from "../shared/constants";
import { MailFetcher } from "./MailFetcher";
import { FileUtils, HtmlSanitizer } from "../shared/utils";

export class GmailFetcher extends MailFetcher {
    private selectors = {
        // Header info
        subject: 'div.ha h2.hP',
        sender: 'span.gD', // Sender name
        senderEmail: 'span.go', // Sender email
        recipients: 'span.g2', // All recipients

        // Active email container
        activeEmail: 'div.adn.ads',
        // Body and attachments (within active email)
        contentDiv: 'div.a3s.aiL',
        attachmentDiv: 'div.hq.gt',
        attachmentElements: 'span[class*="aZo"], img.CToWUd.a6T',
    };

    constructor() {
        super(SUPPORTED_DOMAINS.GMAIL);
    }

    private getActiveEmail(): Element | null {
        return document.querySelector(this.selectors.activeEmail);
    }

    protected getEmailId(): string {
        const href = window.location.href;

        try {
            const url = new URL(href);
            const params = url.searchParams;
            const paramId = params.get('permmsgid') || params.get('msgid') || params.get('th');
            if (paramId) {
                return `gmail_${paramId}`;
            }
        } catch {
            // Ignore URL parsing errors
        }

        const hash = window.location.hash || '';
        if (hash) {
            const segments = hash.split('/').filter(Boolean);
            const lastSegment = segments[segments.length - 1];
            if (lastSegment && /^[A-Za-z0-9]+$/.test(lastSegment)) {
                return `gmail_${lastSegment}`;
            }
        }

        const activeEmail = this.getActiveEmail();
        if (activeEmail) {
            const attributes = [
                'data-legacy-message-id',
                'data-message-id',
                'data-legacy-thread-id',
                'data-thread-id',
            ];

            for (const attr of attributes) {
                const value = activeEmail.getAttribute(attr);
                if (value) {
                    return `gmail_${value}`;
                }
            }

            const hiddenInput = activeEmail.querySelector('input[name="th"]') as HTMLInputElement | null;
            if (hiddenInput?.value) {
                return `gmail_${hiddenInput.value}`;
            }
        }

        return FileUtils.generateIdWithPrefix('gmail');
    }

    protected getEmailSubject(): string {
        const subjectElement = document.querySelector(this.selectors.subject);
        return subjectElement?.textContent?.trim() || 'No Subject';
    }

    protected getEmailSender(): string {
        const activeEmail = this.getActiveEmail();
        const senderNameElement = activeEmail?.querySelector(this.selectors.sender);
        const senderEmailElement = activeEmail?.querySelector(this.selectors.senderEmail);

        const name = senderNameElement?.textContent?.trim() || '';
        const email = senderEmailElement?.textContent?.trim() || '';

        if (name && email) {
            return `${name} <${email}>`;
        }
        return email || name || 'Unknown Sender';
    }

    protected getEmailRecipients(): string[] {
        const activeEmail = this.getActiveEmail();
        const recipientElements = activeEmail?.querySelectorAll(this.selectors.recipients);

        if (!recipientElements) return [];

        const recipients: string[] = [];
        recipientElements.forEach((element) => {
            const recipientText = element.textContent?.trim();
            if (recipientText) {
                const emails = recipientText.split(',').map(e => e.trim()).filter(Boolean);
                recipients.push(...emails);
            }
        });

        return [...new Set(recipients)];
    }

    protected getEmailBody(): string {
        const activeEmail = this.getActiveEmail();
        const contentDiv = activeEmail?.querySelector(this.selectors.contentDiv);
        const html = contentDiv?.innerHTML.trim() || '';
        return HtmlSanitizer.htmlToText(html);
    }

    protected getAttachmentElements(): HTMLElement[] {
        const activeEmail = this.getActiveEmail();

        const attachmentDiv = activeEmail?.querySelector(this.selectors.attachmentDiv);
        if (!attachmentDiv) {
            return [];
        }

        const baseElements = Array.from(
            attachmentDiv.querySelectorAll(this.selectors.attachmentElements)
        ) as HTMLElement[];
        const downloadNodes = Array.from(
            attachmentDiv.querySelectorAll('[download_url], [data-download-url], a[download]')
        ) as HTMLElement[];
        const elements = Array.from(new Set([...baseElements, ...downloadNodes]));

        return elements;
    }

    protected getSourceUrlAndName(element: HTMLElement): [string, string] {
        const downloadValue = this.findDownloadAttribute(element);
        if (downloadValue) {
            const parsed = this.parseDownloadValue(downloadValue);
            if (parsed.url) {
                const name =
                    parsed.name ||
                    this.extractFileNameFromText(element.getAttribute('aria-label')) ||
                    this.extractFileNameFromText(element.textContent) ||
                    'attachment';
                return [parsed.url, name];
            }
        }

        const link = this.findAttachmentLink(element);
        if (link?.href) {
            const name =
                link.getAttribute('download') ||
                this.extractFileNameFromText(link.getAttribute('aria-label')) ||
                this.extractFileNameFromText(link.textContent) ||
                'attachment';
            return [this.normalizeUrl(link.href), name];
        }

        if (element instanceof HTMLImageElement) {
            return [this.normalizeUrl(element.src), element.alt || element.title || 'image'];
        }

        return ['', ''];
    }

    private findDownloadAttribute(element: HTMLElement): string | null {
        let current: HTMLElement | null = element;
        while (current) {
            const value =
                current.getAttribute('download_url') ||
                current.getAttribute('data-download-url');
            if (value) {
                return value;
            }
            current = current.parentElement;
        }
        return null;
    }

    private parseDownloadValue(value: string): { url: string; name: string } {
        const trimmed = value.trim();
        if (!trimmed) return { url: '', name: '' };

        const segments = trimmed.split(':');
        if (segments.length >= 3) {
            return {
                url: this.normalizeUrl(segments.slice(2).join(':')),
                name: this.safeDecode(segments[1]),
            };
        }

        if (segments.length === 2 && this.looksLikeUrl(segments[0])) {
            return {
                url: this.normalizeUrl(segments[0]),
                name: this.safeDecode(segments[1]),
            };
        }

        if (this.looksLikeUrl(trimmed)) {
            return { url: this.normalizeUrl(trimmed), name: '' };
        }

        return { url: '', name: '' };
    }

    private findAttachmentLink(element: HTMLElement): HTMLAnchorElement | null {
        if (element instanceof HTMLAnchorElement) {
            return element;
        }
        return element.querySelector('a[href]') as HTMLAnchorElement | null;
    }

    private extractFileNameFromText(text: string | null | undefined): string {
        if (!text) return '';
        const trimmed = text.trim();
        if (!trimmed) return '';
        const parts = trimmed.split(/\s+/);
        return parts.find(part => part.includes('.')) || trimmed;
    }

    private normalizeUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('//')) {
            return `${window.location.protocol}${url}`;
        }
        return url;
    }

    private looksLikeUrl(value: string): boolean {
        return /^https?:\/\//.test(value) || value.startsWith('//');
    }

    private safeDecode(value: string): string {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
}
