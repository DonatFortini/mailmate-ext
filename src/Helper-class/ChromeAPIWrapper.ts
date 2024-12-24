import { Message } from "@/@types/ChromeMessage";

export class ChromeAPIWrapper {
  static async getCurrentTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (!currentTab?.id || !currentTab.url) {
      throw new Error("Invalid tab");
    }
    return currentTab;
  }

  static async sendMessage<T>(tabId: number, message: Message): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
}
