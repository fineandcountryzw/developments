import { useSession, signOut } from "next-auth/react";

export const useSessionManager = () => {
  const { data: session, status } = useSession();

  return {
    isSessionActive: status === "authenticated" && session.user,
    status,
    signOut,
    session,
  };
};
