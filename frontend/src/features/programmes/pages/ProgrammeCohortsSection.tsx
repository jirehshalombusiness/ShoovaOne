import { ProgrammeCohortsTab } from '../components/ProgrammeCohortsTab';
import { useProgrammeWorkspace } from '../programmeWorkspace';

export function ProgrammeCohortsSection() {
  const { programme, canManage } = useProgrammeWorkspace();
  return <ProgrammeCohortsTab programme={programme} canManage={canManage} />;
}