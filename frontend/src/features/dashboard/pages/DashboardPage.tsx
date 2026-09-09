import { useAuth } from '@/lib/auth';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardKpis } from '../components/DashboardKpis';
import { ActionRequired } from '../components/ActionRequired';
import { MyWork } from '../components/MyWork';
import { ActiveProjects } from '../components/ActiveProjects';
import { PeopleOverview } from '../components/PeopleOverview';
import { UpcomingOverview } from '../components/UpcomingOverview';
import { RecentActivity } from '../components/RecentActivity';
import { PartnershipsOverview } from '../components/PartnershipsOverview';
import { ProgrammesOverview } from '../components/ProgrammesOverview';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Level 1: Header */}
      <DashboardHeader user={user} />

      {/* Level 2: KPI Row */}
      <DashboardKpis />

      {/* Level 3 & 4: Action Required + My Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionRequired />
        <MyWork />
      </div>

      {/* Level 5 & 6: Active Projects + People */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveProjects />
        <PeopleOverview />
      </div>

      {/* Level 7 & 8: Partnerships + Programmes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PartnershipsOverview />
        <ProgrammesOverview />
      </div>

      {/* Level 9 & 10: Upcoming + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingOverview />
        <RecentActivity />
      </div>
    </div>
  );
}