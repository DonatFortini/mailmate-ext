import { FileType } from "@/@enums/FileType";

export interface Attachment {
  id: string;
  name: string;
  type: FileType;
  data: string;
  metadata?: {
    size: number;
    mimeType: string;
  };
}

export interface AttachmentBatch {
  attachments: Attachment[];
  lang: string;
}
