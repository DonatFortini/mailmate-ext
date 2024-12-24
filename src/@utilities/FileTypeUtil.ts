import { FileType } from "@/@enums/FileType";

export class FileTypeUtil {
  private static readonly CONTENT_TYPE_MAP = new Map([
    ["image", FileType.IMAGE],
    ["audio", FileType.AUDIO],
    ["video", FileType.VIDEO],
    ["pdf", FileType.PDF],
    ["text", FileType.TEXT],
  ]);

  static async determineType(url: string): Promise<FileType> {
    try {
      const response = await fetch(url);
      const contentType =
        response.headers.get("content-type")?.toLowerCase() || "";

      for (const [type, fileType] of this.CONTENT_TYPE_MAP) {
        if (contentType.includes(type)) {
          return fileType;
        }
      }

      return FileType.OTHER;
    } catch (error) {
      console.error("Error determining file type:", error);
      return FileType.OTHER;
    }
  }
}
