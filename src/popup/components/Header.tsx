import type { User } from '../../shared/types';

interface HeaderProps {
    user: User | null;
    onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
    return (
        <div>
            {/* Main Header */}
            <header className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-semibold text-[#DCE0D9]">Vos fichiers</h1>

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    className="text-xs text-[#DCE0D9] hover:text-white transition-colors p-2 rounded hover:bg-white/10"
                    title="Déconnexion"
                >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7z"
                            clipRule="evenodd"
                        />
                        <path d="M9 7a1 1 0 10-2 0v6a1 1 0 102 0V7z" />
                    </svg>
                </button>
            </header>

            {/* User Info */}
            {user && (
                <div className="text-sm text-[#DCE0D9] mb-3 opacity-90 font-medium">
                    {user.displayName || user.email}
                </div>
            )}
        </div>
    );
}