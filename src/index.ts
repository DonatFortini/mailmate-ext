import { AttachmentManager } from "@/Helper-class/AttachmentManager";

document.addEventListener("DOMContentLoaded", () => {
  const manager = new AttachmentManager();
  manager
    .initialize()
    .catch((error) => console.error("Initialization failed:", error));
});
