import { ExecutiveHeader } from '../components/ExecutiveHeader';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { WhosInToday } from '../components/WhosInToday';
import { ExecutiveApprovalsQueue } from '../components/ExecutiveApprovalsQueue';
import { ContractAlerts } from '../components/ContractAlerts';
import { WorkforceOverview } from '../components/WorkforceOverview';
import { CompensationSnapshot } from '../components/CompensationSnapshot';
import { OrgActivityFeed } from '../components/OrgActivityFeed';
import { CrmSnapshot } from '../components/CrmSnapshot';
import { UpcomingMeetings } from '../components/UpcomingMeetings';


export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Row 1 — Header */}
      <ExecutiveHeader />

      {/* Row 2 — KPI strip */}
      <ExecutiveKpis />

      {/* Row 3 — Who's in today */}
      <WhosInToday />

      {/* Row 4A — Upcoming meetings + Contract alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <UpcomingMeetings />
        </div>
        <div>
          <ContractAlerts />
        </div>
      </div>

      {/* Existing: Approvals + Contract alerts */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:h-[520px]">
  <div className="lg:col-span-2 lg:h-full">
    <ExecutiveApprovalsQueue />
  </div>
  <div className="lg:h-full">
    <ContractAlerts />
  </div>
</div>

{/* Workforce + Compensation */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-[520px]">
  <div className="lg:h-full">
    <WorkforceOverview />
  </div>
  <div className="lg:h-full">
    <CompensationSnapshot />
  </div>
</div>

{/* NEW: Upcoming meetings — full width */}
<UpcomingMeetings />

{/* CRM snapshot */}
<CrmSnapshot />

{/* Activity */}
<OrgActivityFeed />
  </div>
  );
}