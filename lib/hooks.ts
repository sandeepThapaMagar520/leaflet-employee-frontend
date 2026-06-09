"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    const raw = localStorage.getItem("auth_user");
    if (!raw) {
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setUser(parsed);

      if (allowedRoleList && !allowedRoleList.includes(parsed.role)) {
        router.push("/dashboard");
      }
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router, allowedRolesKey]);

  return { user, loading };
}
