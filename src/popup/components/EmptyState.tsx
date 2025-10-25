// src/popup/components/EmptyState.tsx

export function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-100">
            <svg
                className="h-10 w-10 mb-2 text-[#DCE0D9] opacity-70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
            </svg>
            <p className="text-sm text-[#DCE0D9]">Aucune pièce jointe trouvée</p>
            <p className="text-xs mt-1 text-[#DCE0D9] opacity-80">
                Cliquez sur "Récupérer" pour rechercher des pièces jointes
            </p>
        </div>
    );
}