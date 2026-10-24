import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

import { DashboardHeader } from '../components/DashboardHeader';
import { FocusKpis } from '../components/FocusKpis';
import { TodayAgenda } from '../components/TodayAgenda';
import { MyWeekWidget } from '../components/MyWeekWidget';
import { MyTasksWidget } from '../components/MyTasksWidget';
import { MyProjectsWidget } from '../components/MyProjectsWidget';
import { RecentNotifications } from '../components/RecentNotifications';
import { ExecutiveApprovalsQueue } from '../components/ExecutiveApprovalsQueue';
import { UpcomingMeetings } from '../components/UpcomingMeetings';

// Organisation-wide widgets — each one is gated by the permission
// its data source requires, so no user ever sees a failed panel.
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { WhosInToday } from '../components/WhosInToday';
import { ContractAlerts } from '../components/ContractAlerts';
import { WorkforceOverview } from '../components/WorkforceOverview';
import { CompensationSnapshot } from '../components/CompensationSnapshot';
import { CrmSnapshot } from '../components/CrmSnapshot';
import { OrgActivityFeed } from '../components/OrgActivityFeed';

export function DashboardPage() {
  const access = useHRAccess();

  const canSeeOrgKpis =
    access.canViewSensitive ||
    access.canViewLeave ||
    access.canViewEmployment;

  const canSeeOrgPulse =
    canSeeOrgKpis ||
    access.canViewCompensation ||
    access.has('crm.view') ||
    access.canViewAudit;

  const showWorkforcePair =
    access.canViewSensitive || access.canViewEmployment;
  const showBusinessPair =
    access.canViewCompensation || access.has('crm.view');

  return (
    <div className="space-y-6">
      <DashboardHeader />

      <FocusKpis />

      {/* Today + weekly rhythm */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TodayAgenda />
        </div>
        <div>
          <MyWeekWidget />
        </div>
      </div>

      {/* Tasks + notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <MyTasksWidget />
        </div>
        <div>
          <RecentNotifications />
        </div>
      </div>

      {/* Approvals + next meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ExecutiveApprovalsQueue
            basePath="/me/approvals"
            title="Waiting on You"
            emptyTitle="Nothing needs your decision"
            limit={4}
          />
        </div>
        <div>
          <UpcomingMeetings />
        </div>
      </div>

      {access.has('projects.view') && <MyProjectsWidget />}

      {/* Organisation pulse — only rendered for entitled portfolios */}
      {canSeeOrgPulse && (
        <section className="pt-2">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="w-4 h-4 text-gray-400"
                  strokeWidth={1.75}
                />
                <h2 className="text-lg font-semibold text-gray-900">
                  Organisation pulse
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Live across the organisation — shown according to your access.
              </p>
            </div>
          </div>

          <div className="space-y-5 mt-5">
            {canSeeOrgKpis && <ExecutiveKpis />}

            {access.canViewSensitive && <WhosInToday />}

            {showWorkforcePair && (
              <div
                className={cn(
                  'grid grid-cols-1 gap-5',
                  access.canViewSensitive &&
                    access.canViewEmployment &&
                    'lg:grid-cols-2',
                )}
              >
                {access.canViewSensitive && <WorkforceOverview />}
                {access.canViewEmployment && <ContractAlerts />}
              </div>
            )}

            {showBusinessPair && (
              <div
                className={cn(
                  'grid grid-cols-1 gap-5',
                  access.canViewCompensation &&
                    access.has('crm.view') &&
                    'lg:grid-cols-2',
                )}
              >
                {access.canViewCompensation && <CompensationSnapshot />}
                {access.has('crm.view') && <CrmSnapshot />}
              </div>
            )}

            {access.canViewAudit && <OrgActivityFeed />}
          </div>
        </section>
      )}
    </div>
  );
}
