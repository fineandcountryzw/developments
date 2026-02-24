// Force dynamic rendering to prevent SSR issues with recharts
export const dynamic = 'force-dynamic';

export default function AgentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
