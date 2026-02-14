import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "../domain/models";
import { authApi } from "../services/apiClient";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      if (!authApi.hasTokens()) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const me = await authApi.me();
        if (mounted) {
          setUser(me);
        }
      } catch {
        authApi.logout();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login: async (email: string, password: string) => {
        const currentUser = await authApi.signIn(email, password);
        setUser(currentUser);
      },
      logout: () => {
        authApi.logout();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
