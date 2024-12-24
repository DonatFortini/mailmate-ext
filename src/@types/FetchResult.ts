import { AttachmentBatch } from "./Attachment";

export type FetchResult = {
  success: boolean;
  data?: AttachmentBatch;
  error?: string;
};
