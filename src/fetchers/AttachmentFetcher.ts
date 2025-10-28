import type { SupportedDomain } from "../shared/constants";
import type { Attachment, EmailData } from "../shared/types";
import { FileUtils } from "../shared/utils";


export abstract class AttachmentFetcher {
    protected domain: SupportedDomain;
    protected processedUrls = new Set<string>();

    constructor(domain: SupportedDomain) {
        this.domain = domain;
    }
    /**
    * Abstract methods - must be implemented by subclasses
    */
    protected abstract getEmailId(): string;
    protected abstract getEmailSubject(): string;
    protected abstract getEmailSender(): string;
    protected abstract getEmailRecipients(): string[];
    protected abstract getEmailBody(): string;
    protected abstract getAttachmentElements(): HTMLElement[];

    /**
     * Main method to fetch complete email data
     */
    async fetchEmailData(): Promise<EmailData> {
        const id = this.getEmailId();
        const subject = this.getEmailSubject();
        const sender = this.getEmailSender();
        const recipients = this.getEmailRecipients();
        const body = this.getEmailBody();
        const attachmentElements = this.getAttachmentElements();

        console.log(`[${this.domain}] Fetching email data:`, {
            id,
            subject,
            sender,
            recipientsCount: recipients.length,
            attachmentsCount: attachmentElements.length
        });

        const attachments = await this.fetchAttachmentsFromElements(attachmentElements);

        return {
            id,
            subject,
            sender,
            recipients,
            body,
            attachments,
        };
    }

    protected async fetchAttachmentsFromElements(
        elements: HTMLElement[]
    ): Promise<Attachment[]> {
        console.log(`[AttachmentFetcher] Processing ${elements.length} elements`);

        const attachmentPromises = elements.map(async (element) => {
            try {
                const [url, name] = this.getSourceUrlAndName(element);

                if (!url || this.processedUrls.has(url)) {
                    return null;
                }

                this.processedUrls.add(url);

                const blob = await this.fetchAsBlob(url);
                if (!blob) return null;

                const mimeType = blob.type || element.getAttribute('type') || '';
                const type = FileUtils.detectFileType(name, mimeType);
                const id = FileUtils.generateId();
                const base64Data = await this.blobToBase64(blob);

                return {
                    id,
                    name: FileUtils.sanitizeFilename(name),
                    type,
                    base64Data,
                    metadata: {
                        size: blob.size,
                        mimeType,
                        sourceUrl: url,
                    },
                } satisfies Attachment;
            } catch (error) {
                console.error('[AttachmentFetcher] Error processing element:', error);
                return null;
            }
        });

        const results = await Promise.all(attachmentPromises);
        return results.filter(Boolean) as Attachment[];
    }

    protected getSourceUrlAndName(element: HTMLElement): [string, string] {
        let url = '';
        let name = '';

        if (element instanceof HTMLImageElement) {
            url = element.src;
            name = element.alt || element.title || 'image';
        } else {
            url = element.getAttribute('download_url') || '';
            const urlParts = url?.split('/');
            name = urlParts && urlParts.length > 1
                ? urlParts[1].split(':')[1] || ''
                : '';
        }

        return [url, name];
    }

    protected async fetchAsBlob(url: string): Promise<Blob> {
        const response = await fetch(url, {
            credentials: 'include',
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        return response.blob();
    }

    protected async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    clearProcessedUrls(): void {
        this.processedUrls.clear();
    }

}