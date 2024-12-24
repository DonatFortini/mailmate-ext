import { AttachmentBatch } from "@/@types/Attachment";
import { ChromeAPIWrapper } from "./ChromeAPIWrapper";
import { DomainValidator } from "./DomainValidator";
import { DOMHelper } from "./DOMHelper";

const SELECTORS = {
  CONTENT: "#content",
  FETCH_BUTTON: "#fetch",
  DOWNLOAD_BUTTON: "#download",
  LANGUAGE_SELECT: "#language",
} as const;

export class AttachmentManager {
  private readonly contentDiv: HTMLDivElement;
  private readonly fetchButton: HTMLButtonElement;
  private readonly downloadButton: HTMLButtonElement;
  private readonly languageSelect: HTMLSelectElement;

  constructor() {
    this.contentDiv = DOMHelper.getElement(SELECTORS.CONTENT);
    this.fetchButton = DOMHelper.getElement(SELECTORS.FETCH_BUTTON);
    this.downloadButton = DOMHelper.getElement(SELECTORS.DOWNLOAD_BUTTON);
    this.languageSelect = DOMHelper.getElement(SELECTORS.LANGUAGE_SELECT);
  }

  async initialize(): Promise<void> {
    try {
      const currentTab = await ChromeAPIWrapper.getCurrentTab();
      console.log("current ", currentTab);
      const hostname = DomainValidator.getHostname(currentTab.url!);
      console.log("hostname ", hostname);
      if (DomainValidator.isSupported(hostname)) {
        this.enableFetchButton();
        this.setupFetchListener(currentTab.id!, hostname);
      }
      console.log("currentTab.id ", currentTab.id);
    } catch (error) {
      this.handleError(error);
    }
  }

  private enableFetchButton(): void {
    this.fetchButton.disabled = false;
  }

  private enableDownloadButton(): void {
    this.downloadButton.disabled = false;
  }

  private setupFetchListener(tabId: number, domain: string): void {
    this.fetchButton.addEventListener("click", async () => {
      try {
        const attachmentList =
          await ChromeAPIWrapper.sendMessage<AttachmentBatch>(tabId, {
            action: "FETCH_ATTACHMENTS",
            domain,
            lang: this.languageSelect.value,
          });

        this.displayAttachments(attachmentList);
      } catch (error) {
        this.handleError(error);
      }
    });
  }

  private displayAttachments(attachmentList: AttachmentBatch): void {
    if (!attachmentList?.attachments?.length) {
      this.contentDiv.innerHTML =
        '<p class="text-gray-500">No attachments found</p>';
      return;
    }

    this.contentDiv.innerHTML = "";
    attachmentList.attachments.forEach((attachment) => {
      const element = DOMHelper.createAttachmentElement(attachment);
      this.contentDiv.appendChild(element);
    });

    this.enableDownloadButton();
    this.setupDownloadListener(attachmentList);
  }

  private handleError(error: unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error(errorMessage);
    this.contentDiv.innerHTML = `<p class="text-red-500">${errorMessage}</p>`;
  }

  private setupDownloadListener(attachmentList: AttachmentBatch): void {
    this.downloadButton.addEventListener("click", () => {
      this.downloadAttachments(attachmentList);
    });
  }

  private downloadAttachments(attachmentList: AttachmentBatch): void {
    if (!attachmentList?.attachments?.length) {
      this.contentDiv.innerHTML =
        '<p class="text-gray-500">No attachments found</p>';
      return;
    }

    this.contentDiv.innerHTML = "";
    attachmentList.attachments.forEach((attachment) => {
      const element = DOMHelper.createAttachmentElement(attachment);
      this.contentDiv.appendChild(element);
    });
  }
}
