import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandMenu } from './CommandMenu';
import { X } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string;
  onSelectTab?: (tab: string) => void;
  onAction?: (action: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  breadcrumb = 'Bảng điều khiển',
  onSelectTab,
  onAction,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* 1. Desktop Sidebar */}
      <div className="hidden lg:block">
        <AppSidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onSelectTab={onSelectTab}
        />
      </div>

      {/* 2. Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 w-72 h-full bg-slate-950 border-r border-white/10 shadow-2xl flex flex-col">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <AppSidebar
              isCollapsed={false}
              setIsCollapsed={() => {}}
              onSelectTab={(tab) => {
                onSelectTab?.(tab);
                setMobileMenuOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <AppHeader
          currentBreadcrumb={breadcrumb}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 4. Global Command Palette Modal (Ctrl+K) */}
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onAction={onAction}
      />
    </div>
  );
};
