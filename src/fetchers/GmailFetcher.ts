import { SUPPORTED_DOMAINS } from "../shared/constants";
import { AttachmentFetcher } from "./AttachmentFetcher";
import { FileUtils } from "../shared/utils";

export class GmailFetcher extends AttachmentFetcher {
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
        return contentDiv?.innerHTML.trim() || '';
    }

    protected getAttachmentElements(): HTMLElement[] {
        const activeEmail = this.getActiveEmail();

        const attachmentDiv = activeEmail?.querySelector(this.selectors.attachmentDiv);
        if (!attachmentDiv) {
            console.log('[GmailFetcher] No attachment container found');
            return [];
        }

        const elements = Array.from(
            attachmentDiv.querySelectorAll(this.selectors.attachmentElements)
        ) as HTMLElement[];

        console.log(`[GmailFetcher] Found ${elements.length} attachment elements`);
        return elements;
    }
}