/**
 * Login Layout - ISOLATED
 * 
 * This layout ensures the login page is completely isolated from
 * any parent layout auth logic. No headers, no nav, no auth checks.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
