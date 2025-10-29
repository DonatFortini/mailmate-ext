import { SUPPORTED_DOMAINS } from "../shared/constants";
import { MailFetcher } from "./MailFetcher";
import { FileUtils } from "../shared/utils";

export class OutlookFetcher extends MailFetcher {
    private selectors = {
        // Active email pane
        readingPane: 'div[role="region"][aria-label*="Reading pane"], div[role="main"]',

        // Header info
        subject: 'div[role="heading"], span[class*="Subject"]',
        sender: 'div[class*="From"] span, button[aria-label*="From"]',
        recipients: 'div[class*="To"] span, div[class*="Recipient"]',

        // Message ID
        messageContainer: 'div[data-convid], div[data-itemid]',

        // Body and attachments
        body: 'div[aria-label*="Message body"], div[class*="MessageBody"]',
        attachmentContainer: 'div[data-automation-id="AttachmentList"], div[class*="AttachmentWell"]',
        attachmentElements: `
            div[role='attachment'] img,
            div.allowTextSelection img:not(.InlineImage),
            div.AttachmentPreview img,
            div.FileAttachment img,
            div.InlineAttachment img
        `,
    };

    constructor() {
        super(SUPPORTED_DOMAINS.OUTLOOK);
    }

    private getReadingPane(): Element | null {
        return document.querySelector(this.selectors.readingPane);
    }

    protected getEmailId(): string {
        const pane = this.getReadingPane();
        const messageContainer = pane?.closest('[data-convid], [data-itemid]');

        const convId = messageContainer?.getAttribute('data-convid');
        const itemId = messageContainer?.getAttribute('data-itemid');

        return convId || itemId || FileUtils.generateIdWithPrefix('outlook');
    }

    protected getEmailSubject(): string {
        const pane = this.getReadingPane();
        const subject = pane?.querySelector(this.selectors.subject);
        return subject?.textContent?.trim() || 'No Subject';
    }

    protected getEmailSender(): string {
        const pane = this.getReadingPane();
        const senderElement = pane?.querySelector(this.selectors.sender);
        const senderText = senderElement?.textContent?.trim() ||
            senderElement?.getAttribute('aria-label')?.replace('From: ', '') ||
            'Unknown Sender';
        return senderText;
    }

    protected getEmailRecipients(): string[] {
        const pane = this.getReadingPane();
        const recipientElements = pane?.querySelectorAll(this.selectors.recipients);

        if (!recipientElements) return [];

        const recipients: string[] = [];
        recipientElements.forEach((element) => {
            const recipientText = element.textContent?.trim() ||
                element.getAttribute('aria-label')?.replace('To: ', '');
            if (recipientText) {
                const emails = recipientText.split(/[;,]/).map(e => e.trim()).filter(Boolean);
                recipients.push(...emails);
            }
        });

        return [...new Set(recipients)];
    }

    protected getEmailBody(): string {
        const pane = this.getReadingPane();
        const body = pane?.querySelector(this.selectors.body);
        return body?.innerHTML.trim() || '';
    }

    protected getAttachmentElements(): HTMLElement[] {
        const pane = this.getReadingPane();
        const container = pane?.querySelector(this.selectors.attachmentContainer);
        if (!container) return [];

        return Array.from(
            container.querySelectorAll(this.selectors.attachmentElements)
        ) as HTMLElement[];
    }
}