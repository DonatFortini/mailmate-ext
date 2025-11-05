export const FileType = {
    IMAGE: 0,
    PDF: 1,
    TEXT: 2,
    AUDIO: 3,
    VIDEO: 4,
    OTHER: 5,
} as const;

export type FileType = typeof FileType[keyof typeof FileType];

export interface AttachmentMetadata {
    size?: number;
    mimeType?: string;
    sourceUrl?: string;
    downloadedAt?: number;
}

export type AttachmentStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Attachment {
    id: string;
    name: string;
    type: FileType;
    base64Data?: string;
    status: AttachmentStatus;
    metadata: AttachmentMetadata;
    error?: string;
}

export interface EmailData {
    id: string;
    subject: string;
    sender: string;
    recipients: string[];
    body: string;
    attachments: Attachment[];
}

export interface User {
    id: string;
    email: string;
    displayName?: string;
}

export interface AuthTokens {
    jwt: string;
    refreshToken: string;
    tokenExpiry: number;
    user?: User;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    refreshToken?: string;
    expiresIn?: number;
    error?: string;
}

export type MessageAction =
    | 'FETCH_MAIL'
    | 'FETCH_ATTACHMENT_CONTENT'
    | 'PROCESS_MAIL'
    | 'LOGIN'
    | 'LOGOUT'
    | 'CHECK_AUTH'
    | 'REFRESH_TOKEN';

export interface BaseMessage {
    action: MessageAction;
}

export interface FetchMailMessage extends BaseMessage {
    action: 'FETCH_MAIL';
    tabId: number;
    domain: string;
}

export interface FetchAttachmentContentMessage extends BaseMessage {
    action: 'FETCH_ATTACHMENT_CONTENT';
    tabId: number;
    domain: string;
    attachmentId: string;
}

export interface ProcessMailMessage extends BaseMessage {
    action: 'PROCESS_MAIL';
    emailData: EmailData;
}

export interface LoginMessage extends BaseMessage {
    action: 'LOGIN';
    email: string;
    password: string;
}

export type Message =
    | FetchMailMessage
    | FetchAttachmentContentMessage
    | ProcessMailMessage
    | LoginMessage
    | BaseMessage;

export interface FetchResult {
    success: boolean;
    emailData?: EmailData;
    error?: string;
}

//TODO: refine 'any' type when backend is stabilized
export interface ProcessResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface FetchAttachmentContentResult {
    success: boolean;
    attachment?: Attachment;
    error?: string;
}
