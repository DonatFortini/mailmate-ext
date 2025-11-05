import type { MouseEvent } from 'react';
import type { Attachment } from '../../shared/types';
import { FILE_TYPE_ICONS } from '../../shared/constants';
import { FileUtils } from '../../shared/utils';

interface AttachmentItemProps {
    attachment: Attachment;
    onDownload: (attachment: Attachment) => void;
}

export function AttachmentItem({ attachment, onDownload }: AttachmentItemProps) {
    const iconSrc = FILE_TYPE_ICONS[attachment.type];
    const fileExtension = FileUtils.getExtension(attachment.name).toUpperCase() || '';
    const fileSize = attachment.metadata?.size
        ? FileUtils.formatFileSize(attachment.metadata.size)
        : '';
    const isReady = attachment.status === 'ready';
    const isProcessing = attachment.status === 'processing';
    const isPending = attachment.status === 'pending';
    const isError = attachment.status === 'error';

    const containerClassName = [
        'flex items-center p-2 rounded-md mb-2 transition-all',
        isReady
            ? 'border border-black bg-gray-50 hover:bg-gray-100 hover:shadow hover:border-gray-400 cursor-pointer'
            : 'border border-gray-300 bg-gray-100 cursor-not-allowed opacity-80',
        isError ? 'border-red-400 bg-red-50 text-red-700' : '',
    ].join(' ').trim();

    const handleClick = () => {
        if (!isReady) return;
        onDownload(attachment);
    };

    const handleDownloadClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (!isReady) return;
        onDownload(attachment);
    };

    return (
        <div
            onClick={handleClick}
            className={containerClassName}
        >
            {/* File Icon */}
            <div className="mr-3 text-[#788BFF]">
                <img src={iconSrc} alt="icon" className="w-6 h-6" />
            </div>

            {/* File Info */}
            <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium text-[#251351] truncate">{attachment.name}</div>
                <div className="text-xs text-gray-500">
                    {fileExtension}
                    {fileSize && ` • ${fileSize}`}
                </div>
                {!isReady && (
                    <div className={`text-xs mt-1 ${isError ? 'text-red-500' : 'text-gray-500'} flex items-center gap-1`}>
                        {isProcessing && (
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        {isPending && 'En attente de conversion'}
                        {isProcessing && 'Conversion en cours...'}
                        {isError && (attachment.error || 'Conversion échouée')}
                    </div>
                )}
            </div>

            {/* Download Button */}
            <button
                onClick={handleDownloadClick}
                disabled={!isReady}
                aria-disabled={!isReady}
                className={`ml-2 p-1 rounded-full transition-colors ${
                    isReady
                        ? 'text-gray-400 hover:text-[#788BFF] hover:bg-gray-200'
                        : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Télécharger"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                </svg>
            </button>
        </div>
    );
}
