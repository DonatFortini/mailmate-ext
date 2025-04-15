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
      this.contentElement.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center text-gray-400">
          <svg class="h-10 w-10 mb-2 text-[#788BFF] opacity-30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm">Aucune pièce jointe trouvée</p>
          <p class="text-xs mt-1">Essayez de vérifier un autre email</p>
        </div>
      `;
      return;
    }

    const attachmentsContainer = document.createElement("div");
    attachmentsContainer.className = "space-y-2";

    batch.attachments.forEach((attachment) => {
      const element = this.createAttachmentElement(attachment);
      attachmentsContainer.appendChild(element);
    });

    const countText = document.createElement("div");
    countText.className = "text-xs text-[#251351] opacity-70 mb-2";
    countText.textContent = `${batch.attachments.length} pièce${
      batch.attachments.length > 1 ? "s" : ""
    } jointe${batch.attachments.length > 1 ? "s" : ""} trouvée${
      batch.attachments.length > 1 ? "s" : ""
    }`;

    this.contentElement.appendChild(countText);
    this.contentElement.appendChild(attachmentsContainer);
  }

  private createAttachmentElement(attachment: Attachment): HTMLElement {
    const div = document.createElement("div");
    div.className =
      "attachment-item flex items-center p-2 border border-black rounded-md mb-2 bg-gray-50 hover:bg-gray-100 hover:shadow transition-colors";

    const iconSrc =
      FILE_TYPE_ICONS[attachment.type] || FILE_TYPE_ICONS[FileType.OTHER];

    const fileExtension = attachment.name.split(".").pop()?.toUpperCase() || "";

    const fileSize = attachment.metadata?.size
      ? this.formatFileSize(attachment.metadata.size)
      : "";

    div.innerHTML = `
      <div class="mr-3 text-[#788BFF]">
        <img src="${iconSrc}" alt="icon" class="w-6 h-6">
      </div>
      <div class="flex-1 overflow-hidden">
        <div class="text-sm font-medium text-[#251351] truncate">${
          attachment.name
        }</div>
        <div class="text-xs text-gray-500">${fileExtension}${
      fileSize ? " • " + fileSize : ""
    }</div>
      </div>
      <button class="download-btn ml-2 p-1 text-gray-400 hover:text-[#788BFF] rounded-full hover:bg-gray-200 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    `;

    const downloadBtn = div.querySelector(".download-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.downloadAttachment(attachment);
      });
    }

    div.addEventListener("click", () => {
      this.downloadAttachment(attachment);
    });

    div.addEventListener("mouseover", () => {
      div.style.borderColor = "lightgray";
    });

    div.addEventListener("mouseout", () => {
      div.style.borderColor = "black";
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

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + " " + sizes[i];
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
