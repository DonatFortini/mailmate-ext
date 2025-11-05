import type { SupportedDomain } from "../shared/constants";
import type { Attachment, EmailData } from "../shared/types";
import { FileUtils } from "../shared/utils";


export abstract class MailFetcher {
    protected domain: SupportedDomain;

    constructor(domain: SupportedDomain) {
        this.domain = domain;
    }

    protected abstract getEmailId(): string;
    protected abstract getEmailSubject(): string;
    protected abstract getEmailSender(): string;
    protected abstract getEmailRecipients(): string[];
    protected abstract getEmailBody(): string;
    protected abstract getAttachmentElements(): HTMLElement[];

    async fetchEmailData(): Promise<EmailData> {
        const id = this.getEmailId();
        const subject = this.getEmailSubject();
        const sender = this.getEmailSender();
        const recipients = this.getEmailRecipients();
        const body = this.getEmailBody();
        const attachmentElements = this.getAttachmentElements();
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

        if (elements.length === 0) {
            return [];
        }

        const processedUrls = new Set<string>();
        const attachments: Attachment[] = [];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            try {
                const [url, name] = this.getSourceUrlAndName(element);

                if (!url || processedUrls.has(url)) {
                    continue;
                }

                processedUrls.add(url);

                const blob = await this.fetchAsBlob(url);
                if (!blob) {
                    continue;
                }

                const mimeType = blob.type || element.getAttribute('type') || '';
                const type = FileUtils.detectFileType(name, mimeType);
                const id = FileUtils.generateId();
                const base64Data = await this.blobToBase64(blob);

                attachments.push({
                    id,
                    name: FileUtils.sanitizeFilename(name),
                    type,
                    base64Data,
                    metadata: {
                        size: blob.size,
                        mimeType,
                        sourceUrl: url,
                    },
                });
            } catch (error) {
            }
        }

        return attachments;
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
}
