import { AttachmentFetcherFactory } from "./Fetcher-class/AttachmentFetcherFactory";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.action === "FETCH_ATTACHMENTS") {
    const fetcher = AttachmentFetcherFactory.create(
      message.domain,
      message.lang,
    );

    if (!fetcher) {
      console.error("Unsupported domain:", message.domain);
      sendResponse({ success: false, error: "Unsupported domain" });
      return true;
    }

    fetcher
      .fetchAttachments()
      .then((result) => {
        console.log("Fetch result:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        sendResponse({ success: false, error: "Internal error" });
      });

    return true;
  }
});
