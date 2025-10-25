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

    const handleClick = () => {
        onDownload(attachment);
    };

    const handleDownloadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDownload(attachment);
    };

    return (
        <div
            onClick={handleClick}
            className="flex items-center p-2 border border-black rounded-md mb-2 bg-gray-50 hover:bg-gray-100 hover:shadow transition-all cursor-pointer hover:border-gray-400"
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
            </div>

            {/* Download Button */}
            <button
                onClick={handleDownloadClick}
                className="ml-2 p-1 text-gray-400 hover:text-[#788BFF] rounded-full hover:bg-gray-200 transition-colors"
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