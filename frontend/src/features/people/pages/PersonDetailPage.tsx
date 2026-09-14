import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { peopleService } from '@/services/people.service';
import { PersonProfileHeader } from '../components/PersonProfileHeader';
import { PersonOverview } from '../components/PersonOverview';
import { PersonActivity } from '../components/PersonActivity';
import { PersonHR } from '@/features/hr/components/PersonHR';
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
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'overview' | 'hr' | 'projects' | 'events' | 'programmes' | 'documents' | 'activity';

interface TabConfig {
  id: TabType;
  label: string;
  icon: any;
  permission?: string;
  requiresSensitive?: boolean;
}

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: person, isLoading } = useQuery({
    queryKey: ['person', id],
    queryFn: () => peopleService.getById(id!),
    enabled: !!id,
  });

  // Check if user has HR access
  const hasHRAccess = hasPermission('hr.view_sensitive');

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: User },
    {
      id: 'hr',
      label: 'HR',
      icon: Shield,
      permission: 'hr.view_sensitive',
      requiresSensitive: true
    },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'programmes', label: 'Programmes', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'activity', label: 'Activity', icon: Clock },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter(tab => {
    if (tab.requiresSensitive) {
      return hasHRAccess;
    }
    if (tab.permission) {
      return hasPermission(tab.permission);
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Person not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/people')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to People
      </button>

      {/* Profile Header */}
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.requiresSensitive && (
                  <Lock className="h-3 w-3 text-yellow-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {activeTab === 'overview' && <PersonOverview person={person} />}
        {activeTab === 'hr' && <PersonHR personId={person.id} />}
        {activeTab === 'activity' && <PersonActivity personId={person.id} />}
        {activeTab === 'projects' && (
          <div className="text-center py-12 text-gray-500">
            <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p>No projects yet</p>
          </div>
        )}
        {activeTab === 'events' && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p>No events yet</p>
          </div>
        )}
        {activeTab === 'programmes' && (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p>No programmes yet</p>
          </div>
        )}
        {activeTab === 'documents' && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p>No documents yet</p>
          </div>
        )}
      </div>
    </div>
  );
}