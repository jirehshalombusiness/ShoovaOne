import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { peopleService } from '@/services/people.service';
import { hrService } from '@/services/hr.service';
import { PersonProfileHeader } from '../components/PersonProfileHeader';
import { PersonOverview } from '../components/PersonOverview';
import { PersonActivity } from '../components/PersonActivity';
import { PersonHROverview } from '../components/PersonHROverview';
import { PersonHRContracts } from '../components/PersonHRContracts';
import { PersonHRTimeOff } from '../components/PersonHRTimeOff';
import { PersonHRDocuments } from '../components/PersonHRDocuments';
import { PersonHRNotes } from '../components/PersonHRNotes';
import { PersonHRTimeline } from '../components/PersonHRTimeline';
import { usePermissions } from '@/hooks/usePermissions';
import { EditPersonModal } from '../components/EditPersonModal';
import {
  ArrowLeft,
  User,
  Briefcase,
  Calendar,
  FileText,
  Clock,
  Users,
  Shield,
  StickyNote,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType =
  | 'overview'
  | 'hr-overview'
  | 'hr-contracts'
  | 'hr-time-off'
  | 'hr-documents'
  | 'hr-notes'
  | 'hr-timeline'
  | 'projects'
  | 'events'
  | 'programmes'
  | 'documents'
  | 'activity';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
  permission?: string;
  isHR?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isValidId = !!id && UUID_RE.test(id);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: person, isLoading } = useQuery({
    queryKey: ['person', id],
    queryFn: () => peopleService.getById(id!),
    enabled: isValidId,
  });

  const hasHRAccess = hasPermission('hr.view_sensitive');
  const hasHREmployment = hasPermission('hr.view_employment');
  const canEditSensitive = hasPermission('hr.edit_sensitive');

  const hrQuery = useQuery({
    queryKey: ['hr', 'employee', id],
    queryFn: () => hrService.getEmployee(id!),
    enabled: isValidId && hasHRAccess,
    staleTime: 60_000,
  });

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'programmes', label: 'Programmes', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'activity', label: 'Activity', icon: Clock },
  ];

  const hrTabs: TabConfig[] = hasHRAccess
    ? [
        { id: 'hr-overview', label: 'HR', icon: Shield, isHR: true },
        { id: 'hr-contracts', label: 'Contracts', icon: FileText, isHR: true },
        { id: 'hr-time-off', label: 'Time Off', icon: Calendar, isHR: true },
        { id: 'hr-documents', label: 'HR Docs', icon: FileText, isHR: true },
        { id: 'hr-notes', label: 'Notes', icon: StickyNote, isHR: true },
        { id: 'hr-timeline', label: 'Timeline', icon: History, isHR: true },
      ]
    : [];

  // ---- guards ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isValidId) {
    return (
      <NotFoundBack
        message="Page not found"
        onBack={() => navigate('/people')}
      />
    );
  }

  if (!person) {
    return (
      <NotFoundBack
        message="Person not found"
        onBack={() => navigate('/people')}
      />
    );
  }

  // ---- main render ----

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/people')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to People
      </button>

      <PersonProfileHeader
        person={person}
        onEdit={
          hasPermission('people.edit')
            ? () => setShowEditModal(true)
            : undefined
        }
      />
      {showEditModal && hasPermission('people.edit') && (
        <EditPersonModal
          person={person}
          onClose={() => setShowEditModal(false)}
        />
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

          {hasHRAccess && (
            <div className="w-px h-6 bg-gray-200 self-center mx-1" />
          )}

          {hrTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.isHR && <Shield className="h-3 w-3 text-primary/60" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'overview' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <PersonOverview person={person} />
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <PersonActivity personId={person.id} />
          </div>
        )}
        {activeTab === 'projects' && (
          <PlaceholderTab icon={Briefcase} label="No projects yet" />
        )}
        {activeTab === 'events' && (
          <PlaceholderTab icon={Calendar} label="No events yet" />
        )}
        {activeTab === 'programmes' && (
          <PlaceholderTab icon={Users} label="No programmes yet" />
        )}
        {activeTab === 'documents' && (
          <PlaceholderTab icon={FileText} label="No documents yet" />
        )}

        {activeTab === 'hr-overview' && (
          <PersonHROverview
            personId={person.id}
            employee={hrQuery.data}
            isLoading={hrQuery.isLoading}
            onViewFullRecord={() => navigate(`/hr/employees/${person.id}`)}
          />
        )}
        {activeTab === 'hr-contracts' && (
          <PersonHRContracts
            employee={hrQuery.data}
            isLoading={hrQuery.isLoading}
            canEdit={hasHREmployment}
          />
        )}
        {activeTab === 'hr-time-off' && (
          <PersonHRTimeOff
            employee={hrQuery.data}
            isLoading={hrQuery.isLoading}
            canEdit={hasPermission('hr.edit_leave')}
          />
        )}
        {activeTab === 'hr-documents' && (
          <PersonHRDocuments
            employee={hrQuery.data}
            isLoading={hrQuery.isLoading}
            canVerify={canEditSensitive}
          />
        )}
        {activeTab === 'hr-notes' && (
          <PersonHRNotes
            personId={person.id}
            employee={hrQuery.data}
            isLoading={hrQuery.isLoading}
            canEdit={canEditSensitive}
            onMutated={() => hrQuery.refetch()}
          />
        )}
        {activeTab === 'hr-timeline' && (
          <PersonHRTimeline personId={person.id} />
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="text-center py-12 text-gray-500">
        <Icon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p>{label}</p>
      </div>
    </div>
  );
}

function NotFoundBack({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="text-center py-12">
      <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">{message}</p>
      <button
        onClick={onBack}
        className="mt-4 text-sm font-medium text-primary hover:underline"
      >
        Back to People
      </button>
    </div>
  );
}