"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuthSession, getStoredAuthUser } from "./auth";

export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

export type AuthUser = {
  userId: number;
  fullName: string;
  email: string;
  role: Role;
};

export function useAuth(allowedRoles?: Role[]) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const allowedRolesKey = allowedRoles?.join("|") ?? "";

  useEffect(() => {
    const allowedRoleList = allowedRolesKey ? allowedRolesKey.split("|") as Role[] : null;
    const raw = getStoredAuthUser();
    if (!raw) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setUser(parsed);

      if (allowedRoleList && !allowedRoleList.includes(parsed.role)) {
        router.replace("/dashboard");
      }
    } catch {
      clearAuthSession();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router, allowedRolesKey]);

  return { user, loading };
}
