import { FileType } from './types';

// ======================== SUPPORTED DOMAINS ========================
export const SUPPORTED_DOMAINS = {
    GMAIL: 'mail.google.com',
    OUTLOOK: 'outlook',
} as const;

export type SupportedDomain = (typeof SUPPORTED_DOMAINS)[keyof typeof SUPPORTED_DOMAINS];

// ======================== FILE TYPE MAPPINGS ========================
export const FILE_TYPE_MAP = {
    extensions: {
        // Images
        jpg: FileType.IMAGE,
        jpeg: FileType.IMAGE,
        png: FileType.IMAGE,
        gif: FileType.IMAGE,
        webp: FileType.IMAGE,
        bmp: FileType.IMAGE,
        svg: FileType.IMAGE,
        // PDF
        pdf: FileType.PDF,
        // Text
        txt: FileType.TEXT,
        csv: FileType.TEXT,
        md: FileType.TEXT,
        rtf: FileType.TEXT,
        doc: FileType.TEXT,
        docx: FileType.TEXT,
        // Audio
        mp3: FileType.AUDIO,
        wav: FileType.AUDIO,
        ogg: FileType.AUDIO,
        // Video
        mp4: FileType.VIDEO,
        webm: FileType.VIDEO,
        mov: FileType.VIDEO,
    },
    mimeTypePrefixes: {
        'image/': FileType.IMAGE,
        'application/pdf': FileType.PDF,
        'text/': FileType.TEXT,
        'audio/': FileType.AUDIO,
        'video/': FileType.VIDEO,
    },
} as const;

// ======================== FILE TYPE ICONS ========================
export const FILE_TYPE_ICONS: Record<FileType, string> = {
    [FileType.IMAGE]: '/assets/img_icon.svg',
    [FileType.PDF]: '/assets/pdf_icon.svg',
    [FileType.TEXT]: '/assets/txt_icon.svg',
    [FileType.AUDIO]: '/assets/audio_icon.svg',
    [FileType.VIDEO]: '/assets/video_icon.svg',
    [FileType.OTHER]: '/assets/attach.svg',
};

// ======================== TIMING CONSTANTS ========================
export const MESSAGE_TIMEOUT = 30000;
export const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes