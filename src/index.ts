const attachmentsDiv = document.querySelector("#attachments") as HTMLDivElement;
const fetchAttachButton = document.querySelector(
  "#fetch-attachments"
) as HTMLButtonElement;
const downloadButton = document.querySelector("#download") as HTMLButtonElement;
const languageSelect = document.querySelector("#language") as HTMLSelectElement;

interface Attachment {
  title: string;
  url: string;
}

let attachments: Attachment[] = [];

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url;
    if (!url) {
      console.error("Tab URL is undefined");
      return;
    }
    const domain = new URL(url).hostname;
    const isSupportedDomain = checkSupportedDomain(domain);

    setButtonState(fetchAttachButton, isSupportedDomain);
    setButtonState(downloadButton, isSupportedDomain);

    if (isSupportedDomain) {
      const id = tabs[0]?.id;
      if (!id) {
        console.error("Tab ID is undefined");
        return;
      }
      setupFetchAttachmentsListener(id, domain);
      setupDownloadListener();
      setupMessageListener();
    }
  });
});

function checkSupportedDomain(domain: string): boolean {
  return (
    domain.includes("mail.google.com") || domain.includes("outlook.live.com")
  );
}

function setButtonState(button: HTMLButtonElement, isEnabled: boolean) {
  button.disabled = !isEnabled;
  button.classList.toggle(isEnabled ? "active" : "inactive");
}

function setupFetchAttachmentsListener(tabId: number, domain: string) {
  fetchAttachButton.addEventListener("click", () => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "fetchAttachments", domain },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error fetching attachments:",
            chrome.runtime.lastError
          );
          return;
        }
        console.log("Attachments fetched", response);
        attachments = response;
        displayAttachments(attachments);
      }
    );
  });
}

function setupDownloadListener() {
  downloadButton.addEventListener("click", () => {
    if (attachments.length === 0) {
      console.error("No attachments to download");
      return;
    }
    const lang = languageSelect.value;
    callAPI();
  });
}

function setupMessageListener() {
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.from === "sandbox" && message.type === "ocrResults") {
      console.log("OCR Results received", message.ocrResults);
      updateAttachmentTitles(message.ocrResults);
      // TODO: Zip the attachments for download
    }
  });
}

function callAPI() {
  const url = "http://127.0.0.1:5000//test";
  fetch(url)
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error(error));
}

function updateAttachmentTitles(
  ocrResults: { original: string; new: string }[]
) {
  ocrResults.forEach(({ original, new: newTitle }) => {
    attachments.forEach((attachment) => {
      if (attachment.title === original) {
        attachment.title = newTitle;
      }
    });
  });
}

function displayAttachments(attachments: Attachment[]) {
  if (!Array.isArray(attachments)) {
    console.error("Invalid attachments parameter. Expected an array.");
    return;
  }
  attachmentsDiv.innerHTML = "";
  attachments.forEach((attachment) => {
    const attachmentElement = document.createElement("div");
    attachmentElement.classList.add("attachment");
    attachmentElement.innerHTML = `
            <img src="icons/attach.svg" alt="Attachment Icon">
            <a href="${attachment.url}" target="_blank">${attachment.title}</a>
        `;
    attachmentsDiv.appendChild(attachmentElement);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!languageSelect) {
    console.error("Language select element not found");
    return;
  }

  const ICONS = {
    fra: "icons/fr.svg",
    eng: "icons/uk.svg",
    ita: "icons/it.svg",
  };

  const createDivWithClass = (className: string) => {
    const div = document.createElement("div");
    div.classList.add(className);
    return div;
  };

  const selectedDiv = createDivWithClass("select-selected");
  const itemsDiv = createDivWithClass("select-items");

  const createOptionElement = (option: HTMLOptionElement) => {
    const optionDiv = document.createElement("div");
    const imgSrc = ICONS[option.value as keyof typeof ICONS] || "";
    optionDiv.innerHTML = `<img src="${imgSrc}">`;

    optionDiv.addEventListener("click", () => {
      languageSelect.value = option.value;
      selectedDiv.innerHTML = optionDiv.innerHTML;
      console.log("Selected language:", option.value);
      closeAllSelect();
    });

    return optionDiv;
  };

  Array.from(languageSelect.options).forEach((option) => {
    const optionElement = createOptionElement(option);
    itemsDiv.appendChild(optionElement);
  });

  if (itemsDiv.firstChild) {
    selectedDiv.innerHTML = (itemsDiv.firstChild as HTMLElement).innerHTML;
  }

  selectedDiv.addEventListener("click", () => {
    itemsDiv.style.display =
      itemsDiv.style.display === "none" ? "block" : "none";
  });

  const customSelect = document.querySelector(".custom-select");
  if (customSelect) {
    customSelect.appendChild(selectedDiv);
    customSelect.appendChild(itemsDiv);
  } else {
    console.error("Custom select element not found");
  }

  const closeAllSelect = () => {
    itemsDiv.style.display = "none";
  };

  document.addEventListener("click", (event) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.matches(".select-selected")
    ) {
      closeAllSelect();
    }
  });
});
