import type { SupportedDomain } from "../shared/constants";
import type { Attachment, EmailData } from "../shared/types";
import { FileUtils } from "../shared/utils";

export abstract class MailFetcher {
    protected domain: SupportedDomain;
    private attachmentCache = new Map<string, Attachment>();
    private attachmentPromises = new Map<string, Promise<Attachment>>();

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
        this.resetAttachmentCache();
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

                const sanitizedName = FileUtils.sanitizeFilename(name || 'attachment');
                const type = FileUtils.detectFileType(sanitizedName);
                const id = FileUtils.generateId();

                const elementMimeType = element.getAttribute('type') || element.getAttribute('data-mime-type') || '';

                const attachment: Attachment = {
                    id,
                    name: sanitizedName,
                    type,
                    status: 'pending',
                    base64Data: undefined,
                    metadata: {
                        sourceUrl: url,
                        mimeType: elementMimeType || undefined,
                    },
                };

                attachments.push(attachment);
                this.attachmentCache.set(id, this.cloneAttachment(attachment));
            } catch (error) {
                console.warn('[MailFetcher] Failed to collect attachment metadata', error);
            }
        }

        return attachments.map(att => this.cloneAttachment(att));
    }

    public async loadAttachmentContent(attachmentId: string): Promise<Attachment> {
        const existingPromise = this.attachmentPromises.get(attachmentId);
        if (existingPromise) {
            return existingPromise;
        }

        const cached = this.attachmentCache.get(attachmentId);
        if (!cached) {
            throw new Error(`Attachment not found: ${attachmentId}`);
        }

        if (cached.status === 'ready' && cached.base64Data) {
            return this.cloneAttachment(cached);
        }

        if (!cached.metadata.sourceUrl) {
            throw new Error(`Missing source URL for attachment: ${attachmentId}`);
        }

        const processingAttachment: Attachment = {
            ...cached,
            status: 'processing',
            error: undefined,
        };
        this.attachmentCache.set(attachmentId, this.cloneAttachment(processingAttachment));

        const promise = (async () => {
            try {
                const blob = await this.fetchAsBlob(cached.metadata.sourceUrl!);
                const mimeType = blob.type || cached.metadata.mimeType || '';
                const base64Data = await this.blobToBase64(blob);

                const readyAttachment: Attachment = {
                    ...processingAttachment,
                    status: 'ready',
                    base64Data,
                    metadata: {
                        ...processingAttachment.metadata,
                        size: blob.size,
                        mimeType,
                        downloadedAt: Date.now(),
                    },
                };

                this.attachmentCache.set(attachmentId, this.cloneAttachment(readyAttachment));
                return this.cloneAttachment(readyAttachment);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                const failedAttachment: Attachment = {
                    ...processingAttachment,
                    status: 'error',
                    base64Data: undefined,
                    error: errorMessage,
                };

                this.attachmentCache.set(attachmentId, this.cloneAttachment(failedAttachment));
                return this.cloneAttachment(failedAttachment);
            } finally {
                this.attachmentPromises.delete(attachmentId);
            }
        })();

        this.attachmentPromises.set(attachmentId, promise);
        return promise;
    }

    public getAttachmentFromCache(attachmentId: string): Attachment | null {
        const cached = this.attachmentCache.get(attachmentId);
        return cached ? this.cloneAttachment(cached) : null;
    }

    protected resetAttachmentCache(): void {
        this.attachmentCache.clear();
        this.attachmentPromises.clear();
    }

    protected cloneAttachment(attachment: Attachment): Attachment {
        return {
            ...attachment,
            metadata: { ...attachment.metadata },
        };
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
