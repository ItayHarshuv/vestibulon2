import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "~/lib/api";
import {
  authSessionResponseSchema,
  type AuthUser,
  getZodErrorMessage,
} from "~/lib/validation";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refreshSession: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitializedRef = useRef(false);
  const syncedTodayRepsUserIdRef = useRef<string | null>(null);

  async function refreshSession() {
    const response = await apiFetch("/api/auth/session");
    if (!response.ok) {
      throw new Error("Failed to fetch session");
    }

    const result = authSessionResponseSchema.safeParse(await response.json());
    if (!result.success) {
      throw new Error(getZodErrorMessage(result.error, "Invalid session response"));
    }

    setUser(result.data.user);
    return result.data.user;
  }

  async function signOut() {
    const response = await apiFetch("/api/auth/sign-out", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to sign out");
    }

    setUser(null);
  }

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    void (async () => {
      try {
        await refreshSession();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      syncedTodayRepsUserIdRef.current = null;
      return;
    }

    if (syncedTodayRepsUserIdRef.current === user.id) {
      return;
    }

    syncedTodayRepsUserIdRef.current = user.id;

    void (async () => {
      try {
        const response = await apiFetch("/api/today-reps", {
          method: "POST",
          body: JSON.stringify({
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync today's reps");
        }
      } catch (error) {
        console.error("Error syncing today's reps:", error);
      }
    })();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        refreshSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
