import { useState, type FormEvent } from 'react';

interface LoginFormProps {
    onLogin: (email: string, password: string) => Promise<boolean>;
    loading: boolean;
    error: string;
}

export function LoginForm({ onLogin, loading, error }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        await onLogin(email, password);
    };

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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-[#DCE0D9]">MailMate</h1>
                <p className="text-[#DCE0D9] text-sm opacity-80">
                    Connectez-vous pour gérer vos pièces jointes
                </p>
            </header>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                {/* Email Field */}
                <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-[#DCE0D9] mb-1">
                        Email
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-[#616163]" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                        </div>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="votre.email@exemple.com"
                            className="w-full pl-10 pr-3 py-2 border border-[#DCE0D9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#788BFF] focus:border-[#788BFF] bg-white text-gray-900"
                            required
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Password Field */}
                <div className="mb-6">
                    <label htmlFor="password" className="block text-sm font-medium text-[#DCE0D9] mb-1">
                        Mot de passe
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-[#616163]" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-3 py-2 border border-[#DCE0D9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#788BFF] focus:border-[#788BFF] bg-white text-gray-900"
                            required
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="text-red-200 bg-red-900/30 border border-red-500/50 rounded px-3 py-2 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Login Button */}
                <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full py-2.5 px-4 bg-[#788BFF] hover:bg-[#DCE0D9] hover:text-[#251351] text-white font-bold rounded-md shadow-md transition duration-200 flex items-center justify-center mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                            Connexion...
                        </>
                    ) : (
                        'Se connecter'
                    )}
                </button>
            </form>

            {/* Footer */}
            <footer className="mt-6 text-center text-xs text-[#DCE0D9] opacity-70">
                v2.0.0 • © 2025 MailMate
            </footer>
        </div>
    );
}