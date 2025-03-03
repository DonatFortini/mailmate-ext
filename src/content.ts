// @ts-nocheck
//---------------------------- TYPE DEFINITIONS ----------------------------//

enum FileType {
  IMAGE = 0,
  PDF = 1,
  TEXT = 2,
  AUDIO = 3,
  VIDEO = 4,
  OTHER = 5,
}

interface Attachment {
  id: string;
  name: string;
  type: FileType;
  data: string;
  metadata?: {
    size?: number;
    mimeType?: string;
  };
}

interface AttachmentBatch {
  attachments: Attachment[];
  lang: string;
}

enum MessageAction {
  FETCH_ATTACHMENTS = "FETCH_ATTACHMENTS",
  GET_ATTACHMENTS = "GET_ATTACHMENTS",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
}

interface Message {
  action: MessageAction | string;
  tabId?: number;
  domain?: string;
  lang?: string;
  [key: string]: any;
}

interface FetchResult {
  success: boolean;
  data?: AttachmentBatch;
  error?: string;
}

//---------------------------- CONSTANTS ----------------------------//

const SUPPORTED_DOMAINS = {
  GMAIL: "mail.google.com",
  OUTLOOK: "outlook.live.com",
} as const;

type SupportedDomain =
  (typeof SUPPORTED_DOMAINS)[keyof typeof SUPPORTED_DOMAINS];

const MAIL_SELECTORS = {
  GMAIL: ['span[class*="aZo"]', "img.CToWUd.a6T"],
  OUTLOOK: [
    "div[role='attachment'] img",
    "div.allowTextSelection img:not(.InlineImage)",
    "div.AttachmentPreview img",
    "div.FileAttachment img",
    "div.InlineAttachment img",
  ],
} as const;

//---------------------------- UTILITY FUNCTIONS ----------------------------//

class FileUtils {
  static imageToBase64(img: HTMLImageElement): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    });
  }

  static detectFileType(filename: string, mimeType?: string): FileType {
    const extension = this.getExtension(filename).toLowerCase();

    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension))
      return FileType.IMAGE;
    if (extension === "pdf") return FileType.PDF;
    if (["txt", "csv", "md", "rtf", "doc", "docx"].includes(extension))
      return FileType.TEXT;

    if (mimeType) {
      if (mimeType.startsWith("image/")) return FileType.IMAGE;
      if (mimeType === "application/pdf") return FileType.PDF;
      if (mimeType.startsWith("text/") || mimeType.includes("document"))
        return FileType.TEXT;
    }

    return FileType.OTHER;
  }

  static getExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
  }

  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_")
      .trim();
  }

  static estimateBase64Size(base64String: string): number {
    const base64Data = base64String.split(",")[1] || base64String;
    return Math.floor(base64Data.length * 0.75);
  }
}

//---------------------------- ATTACHMENT FETCHER ----------------------------//

class AttachmentFetcher {
  private domain: SupportedDomain;
  private selectors: string[];

  constructor(domain: string) {
    if (!Object.values(SUPPORTED_DOMAINS).includes(domain as SupportedDomain)) {
      throw new Error(`Unsupported domain: ${domain}`);
    }

    this.domain = domain as SupportedDomain;
    switch (this.domain) {
      case SUPPORTED_DOMAINS.GMAIL:
        this.selectors = MAIL_SELECTORS.GMAIL;
        break;
      case SUPPORTED_DOMAINS.OUTLOOK:
        this.selectors = MAIL_SELECTORS.OUTLOOK;
        break;
      default:
        this.selectors = [];
    }
  }

  getSourceUrlAndName(element: HTMLElement): [string, string] {
    let url = "";
    let name = "";

    if (element instanceof HTMLImageElement) {
      url = element.src;
      name = element.alt || element.title || "image";
    } else {
      url = element.getAttribute("download_url") || "";
      name = url?.split("/")[1].split(":")[1] || "";
    }

    return [url, name];
  }

  async fetchAttachments(language: string): Promise<AttachmentBatch> {
    try {
      const attachments: Attachment[] = [];
      const elements = this.selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
      );
      console.log(`[AttachmentFetcher] Found ${elements.length} elements`);
      console.log("[AttachmentFetcher] elements:", elements);

      for (const element of elements) {
        try {
          const [url, name] = this.getSourceUrlAndName(element);
          if (!url) {
            console.log("[AttachmentFetcher] Skipping element with no URL");
            continue;
          }

          console.log("[AttachmentFetcher] Processing attachment:", name);

          let data = "";
          if (element instanceof HTMLImageElement) {
            data = await FileUtils.imageToBase64(element);
          }

          const mimeType = element.getAttribute("type") || "";
          const type = FileUtils.detectFileType(name, mimeType);

          const id = FileUtils.generateId();
          const attachment: Attachment = {
            id,
            name: FileUtils.sanitizeFilename(name),
            type,
            data,
            metadata: {
              size: FileUtils.estimateBase64Size(data),
              mimeType,
            },
          };

          attachments.push(attachment);
        } catch (error) {
          console.error(
            "[AttachmentFetcher] Error processing attachment:",
            error
          );
        }
      }

      return { attachments, lang: language };
    } catch (error) {
      console.error("[AttachmentFetcher] Error fetching attachments:", error);
      return { attachments: [], lang: language };
    }
  }
}

//---------------------------- MESSAGE HANDLING ----------------------------//

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Content] Received message:", message);

  if (message.action === MessageAction.GET_ATTACHMENTS) {
    console.log("[Content] Processing GET_ATTACHMENTS request");
    handleGetAttachments(message, sendResponse);
    return true;
  }

  return false;
});

async function handleGetAttachments(
  message: Message,
  sendResponse: (response: FetchResult) => void
): Promise<void> {
  try {
    console.log("[Content] Getting attachments for domain:", message.domain);

    if (!message.domain) {
      throw new Error("Domain is undefined");
    }

    const fetcher = new AttachmentFetcher(message.domain);
    const batch = await fetcher.fetchAttachments(message.language);

    console.log(`[Content] Found ${batch.attachments.length} attachments`);
    console.log(
      "[Content] Attachment types:",
      batch.attachments.map((a) => FileType[a.type])
    );

    sendResponse({ success: true, data: batch });
  } catch (error) {
    console.error("[Content] Error getting attachments:", error);
    sendResponse({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get attachments",
    });
  }
}

//---------------------------- INITIALIZATION ----------------------------//

console.log("[Content] Mail Attachment Extension content script initialized");
