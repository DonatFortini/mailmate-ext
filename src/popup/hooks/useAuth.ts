import { useState, useEffect, useCallback } from 'react';
import type { AuthResult, User } from '../../shared/types';
import { sendChromeMessage, getErrorMessage } from '../../shared/utils';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    const checkAuth = useCallback(async () => {
        try {
            setLoading(true);
            const result = await sendChromeMessage<AuthResult>({ action: 'CHECK_AUTH' });

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
    }, []);

    const login = useCallback(
        async (email: string, password: string): Promise<boolean> => {
            try {
                setLoading(true);
                setError('');

                const result = await sendChromeMessage<AuthResult>({
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
                const errorMessage = getErrorMessage(err, 'Login failed');
                setError(errorMessage);
                console.error('[useAuth] Login error:', err);
                return false;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const logout = useCallback(async (): Promise<boolean> => {
        try {
            setLoading(true);
            const result = await sendChromeMessage<AuthResult>({ action: 'LOGOUT' });

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
    }, []);

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