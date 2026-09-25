import { ExecutiveHeader } from '../components/ExecutiveHeader';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { WhosInToday } from '../components/WhosInToday';
import { ExecutiveApprovalsQueue } from '../components/ExecutiveApprovalsQueue';
import { ContractAlerts } from '../components/ContractAlerts';
import { WorkforceOverview } from '../components/WorkforceOverview';
import { CompensationSnapshot } from '../components/CompensationSnapshot';
import { OrgActivityFeed } from '../components/OrgActivityFeed';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Row 1 — Header */}
      <ExecutiveHeader />

      {/* Row 2 — KPI strip */}
      <ExecutiveKpis />

      {/* Row 3 — Who's in today */}
      <WhosInToday />

      {/* Row 4 — Approvals (2/3) + Contract alerts (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:h-[520px]">
        <div className="lg:col-span-2 lg:h-full">
          <ExecutiveApprovalsQueue />
        </div>
        <div className="lg:h-full">
          <ContractAlerts />
        </div>
      </div>

      {/* Row 5 — Workforce + Compensation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-[520px]">
        <div className="lg:h-full">
          <WorkforceOverview />
        </div>
        <div className="lg:h-full">
          <CompensationSnapshot />
        </div>
      </div>

      {/* Row 6 — Activity feed */}
      <OrgActivityFeed />
    </div>
  );
}