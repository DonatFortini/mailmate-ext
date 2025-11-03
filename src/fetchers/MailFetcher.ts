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

        if (elements.length === 0) {
            console.log('[AttachmentFetcher] No elements to process');
            return [];
        }

        const processedUrls = new Set<string>();
        const results: (Attachment | null)[] = [];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            console.log(`[AttachmentFetcher] Processing element ${i + 1}/${elements.length}`);

            try {
                const [url, name] = this.getSourceUrlAndName(element);

                if (!url) {
                    console.warn(`[AttachmentFetcher] Element ${i + 1}: No URL found, skipping`);
                    results.push(null);
                    continue;
                }

                if (processedUrls.has(url)) {
                    console.log(`[AttachmentFetcher] Element ${i + 1}: Duplicate URL, skipping:`, url.substring(0, 100));
                    results.push(null);
                    continue;
                }

                processedUrls.add(url);
                console.log(`[AttachmentFetcher] Element ${i + 1}: Attempting to fetch:`, {
                    name,
                    url: url.substring(0, 100) + (url.length > 100 ? '...' : '')
                });

                try {
                    const blob = await this.fetchAsBlob(url);
                    if (!blob) {
                        console.warn(`[AttachmentFetcher] Element ${i + 1}: Failed to fetch blob`);
                        results.push(null);
                        continue;
                    }

                    console.log(`[AttachmentFetcher] Element ${i + 1}: Blob fetched successfully:`, {
                        size: blob.size,
                        type: blob.type
                    });

                    const mimeType = blob.type || element.getAttribute('type') || '';
                    const type = FileUtils.detectFileType(name, mimeType);
                    const id = FileUtils.generateId();

                    console.log(`[AttachmentFetcher] Element ${i + 1}: Converting to base64...`);
                    const base64Data = await this.blobToBase64(blob);

                    const attachment: Attachment = {
                        id,
                        name: FileUtils.sanitizeFilename(name),
                        type,
                        base64Data,
                        metadata: {
                            size: blob.size,
                            mimeType,
                            sourceUrl: url,
                        },
                    };

                    console.log(`[AttachmentFetcher] Element ${i + 1}: Successfully processed attachment:`, {
                        id,
                        name: attachment.name,
                        type,
                        size: blob.size
                    });

                    results.push(attachment);
                } catch (fetchError) {
                    console.error(`[AttachmentFetcher] Element ${i + 1}: Error fetching/processing:`, {
                        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
                        url: url.substring(0, 100)
                    });
                    results.push(null);
                }
            } catch (error) {
                console.error(`[AttachmentFetcher] Element ${i + 1}: Error in processing:`, error);
                results.push(null);
            }
        }

        const attachments = results.filter((a): a is Attachment => a !== null);
        console.log(`[AttachmentFetcher] Successfully processed ${attachments.length}/${elements.length} attachments`);

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