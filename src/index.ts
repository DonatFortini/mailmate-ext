// @ts-nocheck
import LoginManager from "./login";

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
  CHECK_AUTH = "CHECK_AUTH",
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

const FILE_TYPE_ICONS = {
  [FileType.IMAGE]: "/icons/img_icon.svg",
  [FileType.PDF]: "/icons/pdf_icon.svg",
  [FileType.TEXT]: "/icons/txt_icon.svg",
  [FileType.AUDIO]: "/icons/audio_icon.svg",
  [FileType.VIDEO]: "/icons/video_icon.svg",
  [FileType.OTHER]: "/icons/attach.svg",
};

//---------------------------- UI MANAGEMENT ----------------------------//

class AttachmentPopup {
  private contentElement: HTMLElement;
  private fetchButton: HTMLButtonElement;
  private downloadButton: HTMLButtonElement;
  private languageSelect: HTMLSelectElement;
  private logoutButton: HTMLButtonElement;
  private loginManager: LoginManager;
  private currentDomain: string | null = null;
  private currentAttachments: AttachmentBatch | null = null;
  private isAuthenticated: boolean = false;

  constructor() {
    this.contentElement = document.querySelector("#content") as HTMLElement;
    this.fetchButton = document.querySelector("#fetch") as HTMLButtonElement;
    this.downloadButton = document.querySelector(
      "#download"
    ) as HTMLButtonElement;
    this.languageSelect = document.querySelector(
      "#language"
    ) as HTMLSelectElement;
    this.logoutButton = document.querySelector(
      "#logoutButton"
    ) as HTMLButtonElement;

    this.fetchButton.disabled = true;
    this.downloadButton.disabled = true;

    this.loginManager = new LoginManager();

    this.fetchButton.addEventListener(
      "click",
      this.handleFetchClick.bind(this)
    );
    this.downloadButton.addEventListener(
      "click",
      this.handleDownloadClick.bind(this)
    );
    this.logoutButton.addEventListener(
      "click",
      this.handleLogoutClick.bind(this)
    );

    console.log("[Popup] UI initialized");
  }

  //---------------------------- INITIALIZATION ----------------------------//

  async initialize(): Promise<void> {
    try {
      console.log("[Popup] Initializing...");
      this.isAuthenticated = await this.loginManager.initialize();

      if (!this.isAuthenticated) {
        console.log("[Popup] Not authenticated, showing login form");
        return;
      }

      const currentTab = await this.getCurrentTab();
      if (!currentTab?.url) {
        console.log("[Popup] No valid tab URL found");
        return;
      }

      const domain = this.extractDomain(currentTab.url);
      this.currentDomain = domain;

      const isSupported = this.isDomainSupported(domain);
      this.fetchButton.disabled = !isSupported;

      console.log(
        `[Popup] Domain: ${domain} (${
          isSupported ? "supported" : "unsupported"
        })`
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  //---------------------------- EVENT HANDLERS ----------------------------//

  private async handleFetchClick(): Promise<void> {
    if (!this.currentDomain) {
      console.log("[Popup] No current domain");
      return;
    }

    try {
      console.log(`[Popup] Fetching attachments for ${this.currentDomain}`);
      const message: Message = {
        tabId: (await this.getCurrentTab()).id ?? 0,
        action: MessageAction.FETCH_ATTACHMENTS,
        domain: this.currentDomain,
        lang: this.languageSelect.value,
      };

      const result = await this.sendMessageToBackground<FetchResult>(message);

      if (!result.success) {
        if (result.error === "Authentication required") {
          await this.loginManager.initialize();
          return;
        }

        throw new Error(result.error || "Failed to fetch attachments");
      }

      this.currentAttachments = result.data ?? null;
      this.displayAttachments(this.currentAttachments);
      this.downloadButton.disabled =
        !this.currentAttachments?.attachments.length;

      console.log(
        `[Popup] Found ${
          this.currentAttachments?.attachments.length || 0
        } attachments`
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private async handleDownloadClick(): Promise<void> {
    if (!this.currentAttachments?.attachments.length) {
      console.log("[Popup] No attachments to download");
      return;
    }

    try {
      console.log(
        `[Popup] Downloading ${this.currentAttachments.attachments.length} attachments`
      );

      this.currentAttachments.attachments.forEach((attachment) => {
        this.downloadAttachment(attachment);
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private async handleLogoutClick(): Promise<void> {
    try {
      console.log("[Popup] Logging out");
      const result = await this.sendMessageToBackground({
        action: MessageAction.LOGOUT,
      });

      if (result.success) {
        this.isAuthenticated = false;
        await this.loginManager.initialize();
      } else {
        throw new Error(result.error || "Logout failed");
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  //---------------------------- UI UPDATES ----------------------------//

  private displayAttachments(batch: AttachmentBatch | null): void {
    this.contentElement.innerHTML = "";

    if (!batch?.attachments.length) {
      this.contentElement.innerHTML =
        '<p class="text-gray-500">No attachments found</p>';
      return;
    }

    batch.attachments.forEach((attachment) => {
      const element = this.createAttachmentElement(attachment);
      this.contentElement.appendChild(element);
    });
  }

  private createAttachmentElement(attachment: Attachment): HTMLElement {
    const div = document.createElement("div");
    div.className =
      "flex items-center mb-2 p-2 hover:bg-gray-100 cursor-pointer rounded";

    const iconSrc =
      FILE_TYPE_ICONS[attachment.type] || FILE_TYPE_ICONS[FileType.OTHER];

    div.innerHTML = `
      <img src="${iconSrc}" alt="icon" class="w-5 h-5 mr-2">
      <span class="text-blue-500">${attachment.name}</span>
    `;

    div.addEventListener("click", () => {
      this.downloadAttachment(attachment);
    });

    return div;
  }

  //---------------------------- UTILITY FUNCTIONS ----------------------------//

  private downloadAttachment(attachment: Attachment): void {
    try {
      if (!attachment.data) {
        console.log(`[Popup] No data for ${attachment.name}, cannot download`);
        return;
      }

      console.log(`[Popup] Downloading ${attachment.name}`);

      const a = document.createElement("a");
      a.href = attachment.data;
      a.download = attachment.name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error(`[Popup] Error downloading ${attachment.name}:`, error);
    }
  }

  private handleError(error: unknown): void {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[Popup] Error:", message);

    this.contentElement.innerHTML = `<p class="text-red-500">Error: ${message}</p>`;
  }

  private async getCurrentTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  private extractDomain(url: string): string {
    return new URL(url).hostname;
  }

  private isDomainSupported(domain: string): boolean {
    return Object.values(SUPPORTED_DOMAINS).includes(domain as SupportedDomain);
  }

  private async sendMessageToBackground<T>(message: Message): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

//---------------------------- ENTRY POINT ----------------------------//

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Popup] DOM loaded, initializing popup");
  const popup = new AttachmentPopup();
  popup.initialize().catch((error) => {
    console.error("[Popup] Initialization error:", error);
  });
});
