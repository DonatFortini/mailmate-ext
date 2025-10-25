import type { Attachment } from '../../shared/types';
import { AttachmentItem } from './AttachmentItem';
import { EmptyState } from './EmptyState';

interface AttachmentListProps {
    attachments: Attachment[];
    onDownload: (attachment: Attachment) => void;
    loading: boolean;
}

export function AttachmentList({ attachments, onDownload, loading }: AttachmentListProps) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <svg
                    className="animate-spin h-8 w-8 text-[#DCE0D9]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
                <p className="text-[#DCE0D9] mt-2 text-sm">Chargement des pièces jointes...</p>
            </div>
        );
    }

    if (attachments.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-2">
            {/* Count */}
            <div className="text-xs text-[#251351] opacity-70 mb-2">
                {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe
                {attachments.length > 1 ? 's' : ''} trouvée{attachments.length > 1 ? 's' : ''}
            </div>

            {/* List */}
            <div className="space-y-2">
                {attachments.map((attachment) => (
                    <AttachmentItem
                        key={attachment.id}
                        attachment={attachment}
                        onDownload={onDownload}
                    />
                ))}
            </div>
        </div>
    );
}