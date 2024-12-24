import { SupportedDomain } from "@/@enums/SupportedDomain";
import { AttachmentFetcher } from "./AttachmentFetcher";
import { OutlookAttachmentFetcher } from "./OutlookAttachmentFetcher";
import { GmailAttachmentFetcher } from "./GmailAttachmentFetcher";

export class AttachmentFetcherFactory {
  static create(domain: string, language: string): AttachmentFetcher | null {
    switch (domain) {
      case SupportedDomain.GMAIL:
        return new GmailAttachmentFetcher(language);
      case SupportedDomain.OUTLOOK:
        return new OutlookAttachmentFetcher(language);
      default:
        return null;
    }
  }
}
