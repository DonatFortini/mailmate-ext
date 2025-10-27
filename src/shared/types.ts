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
}

export interface Attachment {
    id: string;
    name: string;
    type: FileType;
    base64Data: string;
    metadata: AttachmentMetadata;
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
    | 'FETCH_ATTACHMENTS'
    | 'GET_ATTACHMENTS'
    | 'LOGIN'
    | 'LOGOUT'
    | 'CHECK_AUTH'
    | 'REFRESH_TOKEN'
    | 'PROCESS_ATTACHMENTS';

export interface BaseMessage {
    action: MessageAction;
}

export interface FetchAttachmentsMessage extends BaseMessage {
    action: 'FETCH_ATTACHMENTS';
    tabId: number;
    domain: string;
}

export interface LoginMessage extends BaseMessage {
    action: 'LOGIN';
    email: string;
    password: string;
}

export interface ProcessAttachmentsMessage extends BaseMessage {
    action: 'PROCESS_ATTACHMENTS';
    attachments: Attachment[];
}

export type Message =
    | FetchAttachmentsMessage
    | LoginMessage
    | ProcessAttachmentsMessage
    | BaseMessage;

export interface FetchResult {
    success: boolean;
    attachments?: Attachment[];
    error?: string;
}

export interface ProcessResult {
    success: boolean;
    data?: any;
    error?: string;
}