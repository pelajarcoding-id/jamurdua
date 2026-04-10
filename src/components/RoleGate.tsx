'use client'

import { useAuth } from "@/components/AuthProvider";

export default function RoleGate({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    // You can return a loading spinner or skeleton here
    return null;
  }

  if (role && allow.some(allowedRole => allowedRole.toUpperCase() === role.toUpperCase())) {
    return <>{children}</>;
  }

  // Optional: You can return a custom "Access Denied" component here
  return null;
}
