import { ProgrammeCurriculumTab } from '../components/ProgrammeCurriculumTab';
import { useProgrammeWorkspace } from '../programmeWorkspace';

export function ProgrammeCurriculumPage() {
  const { programme, canManage } = useProgrammeWorkspace();
  return <ProgrammeCurriculumTab programme={programme} canManage={canManage} />;
}