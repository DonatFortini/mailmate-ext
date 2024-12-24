import { Attachment } from "@/@types/Attachment";

export class DOMHelper {
  static getElement<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return element;
  }

  static createAttachmentElement(attachment: Attachment): HTMLElement {
    const div = document.createElement("div");
    div.className = "flex items-center mb-2";
    div.innerHTML = `
      <img src="./assets/attach.svg" alt="icon" class="w-5 h-5 mr-2">
      <a href="#" class="text-blue-500 hover:underline">${attachment.name}</a>
    `;
    return div;
  }
}
