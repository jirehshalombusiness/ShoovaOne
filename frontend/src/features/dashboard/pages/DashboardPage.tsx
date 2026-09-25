import { ExecutiveHeader } from '../components/ExecutiveHeader';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
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

      {/* Row 3 — Approvals (2/3) + Contract alerts (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ExecutiveApprovalsQueue />
        </div>
        <div>
          <ContractAlerts />
        </div>
      </div>

      {/* Row 4 — Workforce + Compensation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WorkforceOverview />
        <CompensationSnapshot />
      </div>

      {/* Row 5 — Activity feed (full width) */}
      <OrgActivityFeed />
    </div>
  );
}