// src/popup/components/UnauthorizedDomain.tsx

import { SUPPORTED_DOMAINS } from '../../shared/constants';

export function UnauthorizedDomain() {
    return (
        <div className="h-[450px] w-full flex flex-col bg-linear-to-br from-[#788BFF] to-[#251351] p-6">
            {/* Header Section */}
            <header className="flex flex-col items-center mb-6">
                <div className="bg-[#788BFF] p-4 rounded-full mb-3 shadow-md">
                    <svg
                        className="h-8 w-8 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-[#DCE0D9]">Domaine non supporté</h1>
                <p className="text-[#DCE0D9] text-sm opacity-80 text-center">
                    Cette extension fonctionne uniquement sur des services de messagerie compatibles
                </p>
            </header>

            {/* Supported Services List */}
            <div className="mt-4 bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20">
                <h2 className="text-white font-medium mb-2">Services supportés :</h2>
                <ul className="text-white text-sm space-y-2">
                    <li className="flex items-center">
                        <svg
                            className="h-5 w-5 mr-2 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        Gmail ({SUPPORTED_DOMAINS.GMAIL})
                    </li>
                    <li className="flex items-center">
                        <svg
                            className="h-5 w-5 mr-2 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        Outlook ({SUPPORTED_DOMAINS.OUTLOOK})
                    </li>
                </ul>
            </div>

            {/* Message */}
            <div className="flex-1 flex items-center justify-center text-center my-6">
                <p className="text-[#DCE0D9] opacity-80">
                    Veuillez ouvrir l'extension sur une page de service de messagerie compatible
                </p>
            </div>

            {/* Footer */}
            <footer className="mt-3 text-center text-xs text-[#DCE0D9] opacity-70">
                v2.0.0 • © 2025 MailMate
            </footer>
        </div>
    );
}