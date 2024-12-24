import { FetchResult } from "@/@types/FetchResult";
import { AttachmentFetcher } from "./AttachmentFetcher";

export class OutlookAttachmentFetcher extends AttachmentFetcher {
  async fetchAttachments(): Promise<FetchResult> {
    return {
      success: true,
      data: { attachments: [], lang: this.language },
    };
  }
}
