import { Attachment } from "@/@types/Attachment";
import { FetchResult } from "@/@types/FetchResult";
import { Base64Converter } from "@/@utilities/Base64Converter";
import { FileTypeUtil } from "@/@utilities/FileTypeUtil";

export abstract class AttachmentFetcher {
  protected readonly language: string;

  protected SELECTORS = {
    GMAIL: ['span[class*="aZo"]', "img.CToWUd.a6T"],
    OUTLOOK: [], // Add Outlook selectors
  } as const;

  constructor(language: string) {
    this.language = language;
  }

  abstract fetchAttachments(): Promise<FetchResult>;

  protected createAttachment(name: string, url: string): Promise<Attachment> {
    return new Promise(async (resolve) => {
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        name,
        type: await FileTypeUtil.determineType(url),
        data: await Base64Converter.convert(url),
      };
      resolve(attachment);
    });
  }
}
