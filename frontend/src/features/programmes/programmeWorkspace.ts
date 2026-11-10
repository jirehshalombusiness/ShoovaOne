import { createContext, useContext } from 'react';
import type {
  ProgrammeDetail,
  ProgrammeStatus,
} from '@/services/programmes.service';

export interface ProgrammeWorkspace {
  programme: ProgrammeDetail;
  canManage: boolean;
  changeStatus: (status: ProgrammeStatus) => void;
  isChangingStatus: boolean;
}

export const ProgrammeWorkspaceContext =
  createContext<ProgrammeWorkspace | null>(null);

export function useProgrammeWorkspace(): ProgrammeWorkspace {
  const context = useContext(ProgrammeWorkspaceContext);
  if (!context) {
    throw new Error(
      'useProgrammeWorkspace must be used within a ProgrammeLayout',
    );
  }
  return context;
}