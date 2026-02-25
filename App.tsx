
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { signOut } from 'next-auth/react';
import { ErrorBoundary, CustomErrorFallback } from './components/ErrorBoundary.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { MobileFAB } from './components/MobileFAB.tsx';
import { Inventory } from './components/Inventory.tsx';
import { MobileInventory } from './components/MobileInventory.tsx';
import { LandingPage } from './components/pages/home/LandingPage.tsx';
import { AdminDevelopmentsDashboard } from './components/AdminDevelopmentsDashboard.tsx';
import { ClientPortfolio } from './components/ClientPortfolio.tsx';
import { ClientsModule } from './components/ClientsModule.tsx';
import { PaymentModule } from './components/PaymentModule.tsx';
import { BranchSwitcher } from './components/BranchSwitcher.tsx';
import { SettingsModule } from './components/SettingsModule.tsx';
import { UserManagement } from './components/UserManagement.tsx';
import { CommandCenter } from './components/CommandCenter.tsx';
import { ReconModule } from './components/ReconModule.tsx';
import AutomationList from './components/admin/AutomationList.tsx';
import { InstallmentsModule } from './components/InstallmentsModule.tsx';
import { ReceiptsModule } from './components/ReceiptsModule.tsx';
import { BillingModule } from './components/BillingModule.tsx';
import BackupDashboard from './components/dashboards/BackupDashboard.tsx';
import { WizardPage } from './components/WizardPage.tsx';
import StandsInventoryView from './components/stands/StandsInventoryView';
import { ReservationModule } from './components/ReservationModule.tsx';
import { AgentDashboard } from './components/AgentDashboard.tsx';
import { ClientDashboard } from './components/ClientDashboard.tsx';
import { ProfileDrawer } from './components/ProfileDrawer.tsx';
import { CookieConsent } from './components/CookieConsent.tsx';
import { SkeletonCard } from './components/SkeletonLoader.tsx';
import { OfflineContractForm } from './app/components/contracts/OfflineContractForm.tsx';
import { DataImportModule } from './components/admin/DataImportModule.tsx';
import { ExcelImportWizard } from './components/admin/ExcelImportWizard.tsx';
import { ClientManagementModule } from './components/ClientManagementModule.tsx';

// Module-specific error fallback component
const ModuleErrorFallback: React.FC<{ module: string }> = ({ module }) => (
  <CustomErrorFallback
    title={`${module} Module Error`}
    message={`An error occurred in the ${module} module. The rest of the application continues to work.`}
    onRetry={() => window.location.reload()}
  />
);

// Lazy load heavy components for code splitting
const ContractManagement = lazy(() => import('./components/ContractManagement.tsx'));
const ForensicAuditTrailDashboard = lazy(() => import('./components/admin/ForensicAuditTrailDashboard.tsx'));
import { Role, Branch, CompanySettings } from './types.ts';
import { BRANCH_SETTINGS } from './lib/db.ts';
import { useLogo } from '@/contexts/LogoContext';
import { logger } from '@/lib/logger';
import { dedupeFetch } from '@/lib/request-dedup';

interface AppProps {
  initialRole?: Role;
}

const App: React.FC<AppProps> = ({ initialRole = 'Admin' }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<Role>(initialRole);
  const [activeTab, setActiveTab] = useState('developments');
  const [activeBranch, setActiveBranch] = useState<Branch>('Harare');
  const [isMobile, setIsMobile] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [_branchSettings, setBranchSettings] = useState<Record<Branch, CompanySettings>>(BRANCH_SETTINGS);
  const { refreshLogo } = useLogo();

  // Load branch settings from database on mount (and fallback to localStorage)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const updated = { ...BRANCH_SETTINGS };

        // Try to fetch from database for both branches (using dedupeFetch to prevent duplicates with LogoContext)
        try {
          // The API returns settings for the queried branch
          const harareData = await dedupeFetch<{ data?: { logo_url?: string }; success?: boolean }>('/api/admin/settings?branch=Harare');
          logger.debug('Harare settings fetched', { module: 'App', hasLogo: !!harareData.data?.logo_url });

          if (harareData.data && harareData.data.logo_url) {
            updated.Harare = { ...updated.Harare, logo_url: harareData.data.logo_url };
            logger.debug('Loaded Harare logo from database', { module: 'App', logoUrl: harareData.data.logo_url });
          } else {
            logger.debug('No logo_url in Harare API response, using fallback', { module: 'App' });
          }
        } catch (err) {
          logger.warn('Failed to fetch Harare settings from database', {
            module: 'App',
            error: err instanceof Error ? err.message : err
          });
        }

        try {
          const bulawayoData = await dedupeFetch<{ data?: { logo_url?: string }; success?: boolean }>('/api/admin/settings?branch=Bulawayo');
          logger.debug('Bulawayo settings fetched', { module: 'App', hasLogo: !!bulawayoData.data?.logo_url });

          if (bulawayoData.data && bulawayoData.data.logo_url) {
            updated.Bulawayo = { ...updated.Bulawayo, logo_url: bulawayoData.data.logo_url };
            logger.debug('Loaded Bulawayo logo from database', { module: 'App', logoUrl: bulawayoData.data.logo_url });
          } else {
            logger.debug('No logo_url in Bulawayo API response, using fallback', { module: 'App' });
          }
        } catch (err) {
          logger.warn('Failed to fetch Bulawayo settings from database', {
            module: 'App',
            error: err instanceof Error ? err.message : err
          });
        }

        // Fallback: Try localStorage if database didn't have values
        try {
          const harareStored = localStorage.getItem('branch_settings_Harare');
          if (harareStored && !updated.Harare.logo_url) {
            const parsed = JSON.parse(harareStored);
            if (parsed.logo_url) {
              updated.Harare = parsed;
              logger.debug('Restored Harare from localStorage', { module: 'App' });
            }
          }

          const bulawayoStored = localStorage.getItem('branch_settings_Bulawayo');
          if (bulawayoStored && !updated.Bulawayo.logo_url) {
            const parsed = JSON.parse(bulawayoStored);
            if (parsed.logo_url) {
              updated.Bulawayo = parsed;
              logger.debug('Restored Bulawayo from localStorage', { module: 'App' });
            }
          }
        } catch (err) {
          logger.warn('Failed to load settings from localStorage', {
            module: 'App',
            error: err instanceof Error ? err.message : err
          });
        }

        setBranchSettings(updated);
      } catch (err) {
        logger.error('Error loading settings', err instanceof Error ? err : undefined, { module: 'App' });
      }
    };

    loadSettings();
  }, []);

  // Initialize authentication on mount when initialRole is provided
  useEffect(() => {
    // Auto-authenticate when accessed from protected routes like /dashboards/admin
    // NextAuth has already validated the session
    if (initialRole) {
      setUserRole(initialRole);
      setIsAuthenticated(true);
      logger.debug('Auto-authenticated with role', { module: 'App', role: initialRole });
    }
  }, [initialRole]);

  // Mock user data - replace with real user data from auth
  const [userData] = useState({
    name: userRole === 'Agent' ? 'Sarah Moyo' : userRole === 'Client' ? 'John Makoni' : 'Nicholas Gwanzura',
    email: userRole === 'Agent' ? 'sarah@fineandcountry.co.zw' : userRole === 'Client' ? 'john.makoni@example.com' : 'nicholas@fineandcountry.co.zw',
    phone: userRole === 'Agent' ? '+263 77 444 4444' : userRole === 'Client' ? '+263 77 555 5555' : '+263 77 000 0000'
  });

  // Detect mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  const handleLogout = async () => {
    logger.info('Logout initiated', {
      module: 'App',
      user: userData.name,
      role: userRole,
      branch: activeBranch,
      timestamp: new Date().toISOString(),
      clearingStorage: true
    });

    // Clear local state
    setIsAuthenticated(false);
    setActiveTab('dashboard');
    setIsProfileDrawerOpen(false);

    // Clear all local storage and session storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      logger.debug('Cleared localStorage and sessionStorage', { module: 'App' });
    } catch (storageError) {
      logger.warn('Failed to clear storage', { module: 'App', error: storageError });
    }

    // Sign out from NextAuth session and force immediate redirect
    // Use window.location.replace() to ensure URL changes and prevent back navigation
    try {
      // Call NextAuth signOut API endpoint to clear session cookie
      fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        logger.warn('signOut API error (continuing anyway)', { module: 'App', error: err });
      });

      // Call NextAuth signOut function (don't wait for it)
      signOut({
        redirect: false
      }).catch(err => {
        logger.warn('signOut error (continuing anyway)', { module: 'App', error: err });
      });

      // Force immediate redirect using replace (doesn't add to history)
      // This MUST change the URL from /dashboards/admin to /
      // Using replace instead of href ensures it can't be prevented
      window.location.replace(window.location.origin + '/');
    } catch (error) {
      logger.error('Logout error', error instanceof Error ? error : undefined, { module: 'App' });
      // Force redirect immediately on any error - use absolute URL
      window.location.replace(window.location.origin + '/');
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'profile') {
      setIsProfileDrawerOpen(true);
    } else {
      setActiveTab(tab);
    }
  };



  if (!isAuthenticated) {
    return (
      <>
        <LandingPage />
        <CookieConsent />
      </>
    );
  }

  // Agent role gets dedicated dashboard
  if (userRole === 'Agent') {
    return (
      <div className="flex min-h-screen bg-fcCream text-fcSlate font-sans selection:bg-fcGold/20 overflow-x-hidden">
        {/* Agent-specific navigation - slim sidebar, no admin features */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          role={userRole}
          activeBranch={activeBranch}
        />

        <main className="main-content flex-1 min-w-0 relative lg:ml-64 p-4 md:p-8 lg:px-8 xl:px-10 2xl:px-14 lg:py-8 xl:py-10 2xl:py-12 overflow-y-auto overflow-x-hidden no-scrollbar pb-28 md:pb-8 lg:pb-8 safe-area-inset-bottom max-w-full xl:max-w-[1500px] w-full z-10">
          {(activeTab === 'dashboard' || activeTab === 'portfolio' || activeTab === 'clients-add' || activeTab === 'properties' || activeTab === 'commissions') && (
            <AgentDashboard
              agentId="agent-001"
              agentName={userData.name}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === 'developments' && <AdminDevelopmentsDashboard activeBranch={activeBranch} userRole={userRole} />}
          {activeTab === 'branch' && <BranchSwitcher activeBranch={activeBranch} onBranchChange={setActiveBranch} />}
        </main>

        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} role={userRole} />
        <MobileFAB role={userRole} />
        <ProfileDrawer
          isOpen={isProfileDrawerOpen}
          onClose={() => setIsProfileDrawerOpen(false)}
          onLogout={handleLogout}
          userName={userData.name}
          userEmail={userData.email}
          userPhone={userData.phone}
          userRole={userRole}
          userBranch={activeBranch}
        />
        <CookieConsent />
      </div>
    );
  }

  // Client role gets dedicated investment terminal
  if (userRole === 'Client') {
    return (
      <div className="flex min-h-screen bg-fcCream text-fcSlate font-sans selection:bg-fcGold/20 overflow-x-hidden">
        {/* Client-specific navigation - investment focus */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          role={userRole}
          activeBranch={activeBranch}
        />

        <main className="main-content flex-1 min-w-0 relative lg:ml-64 p-4 md:p-8 lg:px-8 xl:px-10 2xl:px-14 lg:py-8 xl:py-10 2xl:py-12 overflow-y-auto overflow-x-hidden no-scrollbar pb-28 md:pb-8 lg:pb-8 safe-area-inset-bottom max-w-full xl:max-w-[1500px] w-full z-10">
          {(activeTab === 'portfolio' || activeTab === 'legal') && (
            <ClientDashboard
              clientId="client-001"
              clientName={userData.name}
              clientEmail={userData.email}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </main>

        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} role={userRole} />
        <MobileFAB role={userRole} />
        <ProfileDrawer
          isOpen={isProfileDrawerOpen}
          onClose={() => setIsProfileDrawerOpen(false)}
          onLogout={handleLogout}
          userName={userData.name}
          userEmail={userData.email}
          userPhone={userData.phone}
          userRole={userRole}
          userBranch={activeBranch}
        />
        <CookieConsent />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-fcCream text-fcSlate font-sans selection:bg-fcGold/20 overflow-x-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          role={userRole}
          activeBranch={activeBranch}
        />


        {/* Main Content - Responsive padding for mobile bottom nav. lg:ml-64 clears fixed sidebar (w-64 = 256px) when sidebar is visible at lg: breakpoint (1024px+). */}
        <main className="main-content flex-1 min-w-0 relative lg:ml-64 p-4 md:p-8 lg:px-8 xl:px-10 2xl:px-14 lg:py-8 xl:py-10 2xl:py-12 overflow-y-auto overflow-x-hidden no-scrollbar pb-28 md:pb-8 lg:pb-8 safe-area-inset-bottom max-w-full xl:max-w-[1500px] w-full z-10">
          {activeTab === 'stands' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Stands" />}>
              {isMobile ? <MobileInventory activeBranch={activeBranch} /> : <Inventory activeBranch={activeBranch} />}
            </ErrorBoundary>
          )}
          {activeTab === 'inventory' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Inventory" />}>
              {isMobile ? <MobileInventory activeBranch={activeBranch} /> : <Inventory activeBranch={activeBranch} />}
            </ErrorBoundary>
          )}
          {activeTab === 'developments' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Developments" />}>
              <AdminDevelopmentsDashboard activeBranch={activeBranch} userRole={userRole} />
            </ErrorBoundary>
          )}
          {activeTab === 'portfolio' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Portfolio" />}>
              {userRole === 'Admin' || userRole === 'Manager' ? <ClientsModule activeBranch={activeBranch} /> : <ClientPortfolio role={userRole} />}
            </ErrorBoundary>
          )}
          {activeTab === 'payments' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Payments" />}>
              <PaymentModule activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'branch' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Branch Settings" />}>
              <BranchSwitcher activeBranch={activeBranch} onBranchChange={setActiveBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'settings' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Settings" />}>
              <SettingsModule
                activeBranch={activeBranch}
                onSettingsUpdate={updated => setBranchSettings(prev => ({ ...prev, [updated.branch]: updated }))}
                onLogoUpdate={() => {
                  refreshLogo();
                }}
              />
            </ErrorBoundary>
          )}
          {activeTab === 'users' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="User Management" />}>
              <UserManagement activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'legal' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Contracts" />}>
              <Suspense fallback={<SkeletonCard />}>
                <ContractManagement />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'offline-contracts' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Offline Contracts" />}>
              <Suspense fallback={<SkeletonCard />}>
                <OfflineContractForm />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'import' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Import" />}>
              <Suspense fallback={<SkeletonCard />}>
                <ExcelImportWizard />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'diagnostics' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Diagnostics" />}>
              <CommandCenter />
            </ErrorBoundary>
          )}
          {activeTab === 'automation' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Automation" />}>
              <AutomationList />
            </ErrorBoundary>
          )}
          {activeTab === 'audit' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Audit Trail" />}>
              <Suspense fallback={<SkeletonCard />}>
                <ForensicAuditTrailDashboard activeBranch={activeBranch} />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'recon' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Reconciliation" />}>
              <ReconModule activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'billing' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Billing" />}>
              <BillingModule activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'backup' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Backup" />}>
              <BackupDashboard userRole="admin" userEmail="admin" />
            </ErrorBoundary>
          )}
          {activeTab === 'wizard' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Wizard" />}>
              <WizardPage activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'reservations' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Reservations" />}>
              <Suspense fallback={<SkeletonCard />}>
                <ReservationModule />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'client-management' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Client Management" />}>
              <ClientManagementModule activeBranch={activeBranch} />
            </ErrorBoundary>
          )}
          {activeTab === 'stands-inventory' && (
            <ErrorBoundary fallback={<ModuleErrorFallback module="Stands Inventory" />}>
              <StandsInventoryView
                role={userRole === 'Manager' ? 'manager' : userRole === 'Account' ? 'account' : 'admin'}
                title="Stands Inventory"
                subtitle="View and manage stands across developments"
              />
            </ErrorBoundary>
          )}

          {/* Add more modules as needed */}
        </main>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} role={userRole} />
        <MobileFAB role={userRole} />
        <CookieConsent />
      </div>
    </ErrorBoundary>
  );
}

export default App;
