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
  type_: number;
  data: string;
  metadata?: {
    size?: number;
    mime_type?: string;
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
  GMAIL: 'span[class*="aZo"], img.CToWUd.a6T',
  OUTLOOK: `
    div[role='attachment'] img,
    div.allowTextSelection img:not(.InlineImage),
    div.AttachmentPreview img,
    div.FileAttachment img,
    div.InlineAttachment img
  `,
} as const;

const FILE_TYPE_MAP = {
  extensions: {
    jpg: FileType.IMAGE,
    jpeg: FileType.IMAGE,
    png: FileType.IMAGE,
    gif: FileType.IMAGE,
    webp: FileType.IMAGE,
    bmp: FileType.IMAGE,
    svg: FileType.IMAGE,
    pdf: FileType.PDF,
    txt: FileType.TEXT,
    csv: FileType.TEXT,
    md: FileType.TEXT,
    rtf: FileType.TEXT,
    doc: FileType.TEXT,
    docx: FileType.TEXT,
    mp3: FileType.AUDIO,
    wav: FileType.AUDIO,
    ogg: FileType.AUDIO,
    mp4: FileType.VIDEO,
    webm: FileType.VIDEO,
    mov: FileType.VIDEO,
  },
  mimeTypePrefixes: {
    "image/": FileType.IMAGE,
    "application/pdf": FileType.PDF,
    "text/": FileType.TEXT,
    "audio/": FileType.AUDIO,
    "video/": FileType.VIDEO,
  },
};

//---------------------------- UTILITY FUNCTIONS ----------------------------//

class FileUtils {
  static attachmentCache = new Map();

  static async toBase64(element: HTMLElement | File): Promise<string> {
    const cacheKey =
      element instanceof HTMLElement
        ? element.getAttribute("download_url") ||
          element.getAttribute("href") ||
          element.src
        : element.name;

    if (cacheKey && this.attachmentCache.has(cacheKey)) {
      return this.attachmentCache.get(cacheKey);
    }

    let dl_link =
      element.getAttribute("download_url") || element.getAttribute("href");

    if (dl_link) {
      try {
        const response = await fetch(dl_link);
        const blob = await response.blob();
        const base64 = await this.blobToBase64(blob);

        if (cacheKey) {
          this.attachmentCache.set(cacheKey, base64);
        }

        return base64;
      } catch (error) {
        console.error("[FileUtils] Error converting to base64:", error);
        return "";
      }
    }
    return "";
  }

  static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  static detectFileType(filename: string, mimeType?: string): FileType {
    const extension = this.getExtension(filename).toLowerCase();
    if (extension && FILE_TYPE_MAP.extensions[extension] !== undefined) {
      return FILE_TYPE_MAP.extensions[extension];
    }

    if (mimeType) {
      if (FILE_TYPE_MAP.mimeTypePrefixes[mimeType]) {
        return FILE_TYPE_MAP.mimeTypePrefixes[mimeType];
      }

      for (const [prefix, type] of Object.entries(
        FILE_TYPE_MAP.mimeTypePrefixes
      )) {
        if (
          mimeType.startsWith(prefix) ||
          mimeType.includes(prefix.slice(0, -1))
        ) {
          return type;
        }
      }
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
    if (!base64String) return 0;

    const base64Data = base64String.split(",")[1] || base64String;
    return Math.floor(base64Data.length * 0.75);
  }

  static clearCache(): void {
    this.attachmentCache.clear();
  }
}

//---------------------------- ATTACHMENT FETCHER ----------------------------//

class AttachmentFetcher {
  private domain: SupportedDomain;
  private selector: string;
  private processedUrls = new Set<string>();

  constructor(domain: string) {
    if (!Object.values(SUPPORTED_DOMAINS).includes(domain as SupportedDomain)) {
      throw new Error(`Unsupported domain: ${domain}`);
    }

    this.domain = domain as SupportedDomain;
    this.selector =
      MAIL_SELECTORS[
        this.domain === SUPPORTED_DOMAINS.GMAIL ? "GMAIL" : "OUTLOOK"
      ];
  }

  getSourceUrlAndName(element: HTMLElement): [string, string] {
    let url = "";
    let name = "";

    if (element instanceof HTMLImageElement) {
      url = element.src;
      name = element.alt || element.title || "image";
    } else {
      url = element.getAttribute("download_url") || "";
      const urlParts = url?.split("/");
      name =
        urlParts && urlParts.length > 1 ? urlParts[1].split(":")[1] || "" : "";
    }

    return [url, name];
  }

  async fetchAttachments(language: string): Promise<AttachmentBatch> {
    try {
      const attachments: Attachment[] = [];

      const elements = Array.from(document.querySelectorAll(this.selector));
      console.log(`[AttachmentFetcher] Found ${elements.length} elements`);

      const attachmentPromises = elements.map(async (element) => {
        try {
          const [url, name] = this.getSourceUrlAndName(element as HTMLElement);
          if (!url || this.processedUrls.has(url)) {
            return null;
          }

          this.processedUrls.add(url);

          const data = await FileUtils.toBase64(element as HTMLElement);
          if (!data) return null;

          const mime_type = element.getAttribute("type") || "";
          const type_ = FileUtils.detectFileType(name, mime_type);

          const id = FileUtils.generateId();
          return {
            id,
            name: FileUtils.sanitizeFilename(name),
            type_,
            data,
            metadata: {
              size: FileUtils.estimateBase64Size(data),
              mime_type,
            },
          };
        } catch (error) {
          console.error(
            "[AttachmentFetcher] Error processing attachment:",
            error
          );
          return null;
        }
      });

      const results = await Promise.all(attachmentPromises);
      attachments.push(...(results.filter(Boolean) as Attachment[]));

      return { attachments, lang: language };
    } catch (error) {
      console.error("[AttachmentFetcher] Error fetching attachments:", error);
      return { attachments: [], lang: language };
    }
  }

  clearProcessedUrls(): void {
    this.processedUrls.clear();
  }
}

//---------------------------- MESSAGE HANDLING ----------------------------//

const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const fetcherInstances = new Map<string, AttachmentFetcher>();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Content] Received message:", message);

  if (message.action === MessageAction.GET_ATTACHMENTS) {
    console.log("[Content] Processing GET_ATTACHMENTS request");

    const debouncedHandler = debounce(() => {
      handleGetAttachments(message, sendResponse);
    }, 100);

    debouncedHandler();
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

    if (!fetcherInstances.has(message.domain)) {
      fetcherInstances.set(
        message.domain,
        new AttachmentFetcher(message.domain)
      );
    }

    const fetcher = fetcherInstances.get(message.domain)!;
    const batch = await fetcher.fetchAttachments(message.lang);

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

window.addEventListener("beforeunload", () => {
  FileUtils.clearCache();
  fetcherInstances.forEach((fetcher) => fetcher.clearProcessedUrls());
  fetcherInstances.clear();
});

//---------------------------- INITIALIZATION ----------------------------//

console.log("[Content] Mail Attachment Extension content script initialized");
