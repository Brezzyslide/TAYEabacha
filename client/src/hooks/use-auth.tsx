import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Development workaround: Try multiple times with different approaches
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest", // Help distinguish from browser navigation
            },
            body: JSON.stringify(credentials),
            credentials: "include",
            cache: "no-cache",
          });
          
          const contentType = response.headers.get("content-type");
          
          // If we got HTML instead of JSON, this is the Vite dev server issue
          if (contentType?.includes("text/html") || !contentType?.includes("application/json")) {
            if (attempt < 2) {
              // Wait a bit and try again
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            } else {
              // Last attempt failed - try a page reload approach
              window.location.reload();
              throw new Error("Login requires page reload due to development server configuration.");
            }
          }
          
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Login failed with status ${response.status}`);
          }
          
          return await response.json();
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }
          // Try again
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    },
    onSuccess: (user: SelectUser) => {
      // 🔒 SECURITY: Clear all cached data on login to prevent stale data access
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/user"], user);
      
      // Force a page reload to ensure clean session state
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (user: SelectUser) => {
      // 🔒 SECURITY: Clear all cached data on login to prevent stale data access
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      // 🔒 SECURITY: Clear all cached data on logout to prevent authorization bypass
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Force page reload to clear any lingering cached state
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
