import { useState, useEffect, useCallback } from 'react';
import type { AuthResult, User } from '../../shared/types';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    const sendMessage = useCallback(<T,>(message: any): Promise<T> => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response: T) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }, []);

    const checkAuth = useCallback(async () => {
        try {
            setLoading(true);
            const result = await sendMessage<AuthResult>({ action: 'CHECK_AUTH' });

            if (result.success && result.user) {
                setUser(result.user);
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (err) {
            console.error('[useAuth] Error checking auth:', err);
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, [sendMessage]);

    const login = useCallback(
        async (email: string, password: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');

                const result = await sendMessage<AuthResult>({
                    action: 'LOGIN',
                    email,
                    password,
                });

                if (result.success && result.user) {
                    setUser(result.user);
                    setIsAuthenticated(true);
                    return true;
                } else {
                    setError(result.error || 'Login failed');
                    return false;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Login failed';
                setError(errorMessage);
                console.error('[useAuth] Login error:', err);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [sendMessage]
    );

    const logout = useCallback(async (): Promise<boolean> => {
        try {
            setLoading(true);
            const result = await sendMessage<AuthResult>({ action: 'LOGOUT' });

            if (result.success) {
                setUser(null);
                setIsAuthenticated(false);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[useAuth] Logout error:', err);
            return false;
        } finally {
            setLoading(false);
        }
    }, [sendMessage]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return {
        user,
        isAuthenticated,
        loading,
        error,
        login,
        logout,
        checkAuth,
    };
}