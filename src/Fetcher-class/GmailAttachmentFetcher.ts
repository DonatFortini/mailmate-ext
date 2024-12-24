import { Attachment } from "@/@types/Attachment";
import { FetchResult } from "@/@types/FetchResult";
import { AttachmentFetcher } from "./AttachmentFetcher";

export class GmailAttachmentFetcher extends AttachmentFetcher {
  async fetchAttachments(): Promise<FetchResult> {
    try {
      const attachments: Attachment[] = [];
      const promises: Promise<void>[] = [];

      this.SELECTORS.GMAIL.forEach((selector) => {
        const elements = document.querySelectorAll(selector);

        elements.forEach((element) => {
          const name = element.getAttribute("alt") || "Attachment";
          const url =
            element.getAttribute("src") || element.getAttribute("currentSrc");
          if (name && url) {
            promises.push(
              this.createAttachment(name, url).then((attachment) => {
                if (attachment) {
                  attachments.push(attachment);
                }
              }),
            );
          }
        });
      });

      await Promise.all(promises);

      return {
        success: true,
        data: { attachments, lang: this.language },
      };
    } catch (error) {
      console.error("Error fetching Gmail attachments:", error);
      return {
        success: false,
        error: "Failed to fetch Gmail attachments",
      };
    }
  }
}
