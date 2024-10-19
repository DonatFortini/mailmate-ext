chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchAttachments") {
    fetchAttachments(message.domain).then(sendResponse);
  }
  return true;
});

/**
 * Fetch attachments from the current page based on the domain
 * @param {string} domain
 * @returns array of attachments
 */
async function fetchAttachments(domain: string): Promise<any[]> {
  switch (domain) {
    case "mail.google.com":
      return await fetchAttachmentsFromGmail();
    case "outlook.live.com":
      return await fetchAttachmentsFromOutlook();
    default:
      console.warn(`Unsupported domain: ${domain}`);
      return [];
  }
}

/**
 * Fetch attachments from Gmail and store them into base64 format to be able to use them in the sandbox and return an array of attachments
 * @returns array of attachments
 */
async function fetchAttachmentsFromGmail(): Promise<any[]> {
  const attachments: any[] = [];
  const spanElements = document.querySelectorAll('span[class*="aZo"]'); // Gmail attachment list
  const imgElements = document.querySelectorAll("img.CToWUd.a6T"); // Gmail inline image list
  const attachmentElements = [
    ...Array.from(spanElements),
    ...Array.from(imgElements),
  ];

  for (const element of attachmentElements) {
    if (element.tagName === "SPAN") {
      const downloadUrlAttr = element.getAttribute("download_url");
      if (!downloadUrlAttr) continue;

      const downloadUrl = downloadUrlAttr.split(/(?<!https):/);
      if (downloadUrl.length >= 3) {
        const attachmentBlob = await fetchAttachmentBlob(
          downloadUrl.slice(2).join(":")
        );
        const base64String = await blobToBase64(attachmentBlob);
        attachments.push({
          type: downloadUrl[0],
          title: downloadUrl[1],
          blob: base64String,
        });
      }
    } else if (element.tagName === "IMG") {
      const imageUrl = element.getAttribute("src");
      if (imageUrl) {
        const attachmentBlob = await fetchAttachmentBlob(imageUrl);
        const base64String = await blobToBase64(attachmentBlob);
        attachments.push({
          type: "image",
          title: imageUrl.split("/").pop(),
          blob: base64String,
        });
      }
    }
  }

  if (attachments.length === 0) {
    console.warn("No attachment list found in Gmail.");
  }

  return attachments;
}

/**
 * Fetch attachments from Outlook
 * @returns array of attachments
 */
async function fetchAttachmentsFromOutlook(): Promise<any[]> {
  console.warn("fetchAttachmentsFromOutlook is not yet implemented.");
  return [];
}

/**
 * Fetch the attachment blob from the given URL
 * @param {string | URL | Request} url
 * @returns blob the attachment to be able to use it in the sandbox
 */
async function fetchAttachmentBlob(url: string | URL | Request): Promise<Blob> {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed to fetch blob from ${url}`);
  }
  return await response.blob();
}

/**
 * Convert a blob to a base64 string to make it easier to process
 * @param {Blob} blob
 * @returns base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]);
      } else {
        reject(new Error("Failed to convert blob to base64 string"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
