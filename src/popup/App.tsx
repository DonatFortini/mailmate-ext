import { useAuth } from './hooks/useAuth';
import { useMail } from './hooks/useMail';
import { useCurrentTab } from './hooks/useCurrentTab';
import { LoginForm } from './components/LoginForm';
import { UnauthorizedDomain } from './components/UnauthorizedDomain';
import { Header } from './components/Header';
import { AttachmentList } from './components/AttachmentList';
import { FileUtils } from '../shared/utils';
import type { Attachment } from '../shared/types';

export function App() {
    const { user, isAuthenticated, loading: authLoading, error: authError, login, logout } = useAuth();
    const {
        emailData,
        attachments,
        loading: mailLoading,
        error: mailError,
        processing,
        attachmentsLoading,
        attachmentsReady,
        fetchMail,
        processMail,
    } = useMail();
    const { tabInfo, loading: tabLoading } = useCurrentTab();

    const handleLogin = async (email: string, password: string) => {
        return await login(email, password);
    };

    const handleLogout = async () => {
        await logout();
    };

    const handleFetchMail = async () => {
        if (!tabInfo) return;
        await fetchMail(tabInfo.id, tabInfo.domain);
    };

    const handleProcessMail = async () => {
        if (!emailData || attachments.length === 0 || !attachmentsReady) return;
        const success = await processMail();
        if (success) {
            console.log('Email processed successfully!');
        }
    };

    const handleDownloadAttachment = async (attachment: Attachment) => {
        if (!attachment.base64Data || attachment.status !== 'ready') {
            console.warn('Attachment not ready for download');
            return;
        }
        try {
            await FileUtils.downloadBase64(attachment.base64Data, attachment.name);
        } catch (error) {
            console.error('Error downloading attachment:', error);
        }
    };

    if (authLoading || tabLoading) {
        return (
            <div className="h-[450px] w-full flex items-center justify-center bg-linear-to-br from-[#788BFF] to-[#251351]">
                <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    if (tabInfo && !tabInfo.isSupported) {
        return <UnauthorizedDomain />;
    }

    if (!isAuthenticated) {
        return <LoginForm onLogin={handleLogin} loading={authLoading} error={authError} />;
    }

    return (
        <div className="h-[450px] w-full flex flex-col bg-linear-to-br from-[#788BFF] to-[#251351] p-4">
            <Header user={user} onLogout={handleLogout} />

            <div className="flex-1 min-h-[200px] rounded-lg shadow-sm p-3 overflow-y-auto mb-4 bg-white/15 border border-white/20">
                <AttachmentList
                    attachments={attachments}
                    onDownload={handleDownloadAttachment}
                    loading={mailLoading && attachments.length === 0}
                />
            </div>

            {mailError && (
                <div className="text-red-200 bg-red-900/30 border border-red-500/50 rounded px-3 py-2 text-xs mb-2">
                    {mailError}
                </div>
            )}

            <div className="space-y-2">
                <button
                    onClick={handleFetchMail}
                    disabled={mailLoading || attachmentsLoading || !tabInfo?.isSupported}
                    className="w-full py-2.5 px-4 bg-[#788BFF] hover:bg-[#6777E3] text-white rounded-md shadow-sm transition duration-200 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mailLoading || attachmentsLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {mailLoading ? 'Récupération...' : 'Conversion des pièces jointes...'}
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Récupérer l'email
                        </>
                    )}
                </button>

                {attachments.length > 0 && (
                    <button
                        onClick={handleProcessMail}
                        disabled={processing || attachmentsLoading || !attachmentsReady}
                        className="w-full py-2.5 px-4 bg-[#251351] hover:bg-[#470024] text-white rounded-md shadow-sm transition duration-200 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Traitement...
                            </>
                        ) : attachmentsLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Conversion des pièces jointes...
                            </>
                        ) : !attachmentsReady ? (
                            <>
                                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 13v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6m0-4h12m-6-4v8" />
                                </svg>
                                Pièces jointes en attente...
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Traiter l'email
                            </>
                        )}
                    </button>
                )}
            </div>

            <footer className="mt-3 text-center">
                <p className="text-xs text-[#DCE0D9] opacity-80">
                    {emailData && `${emailData.subject} • ${attachments.length} fichier${attachments.length > 1 ? 's' : ''}`}
                </p>
            </footer>
        </div>
    );
}
