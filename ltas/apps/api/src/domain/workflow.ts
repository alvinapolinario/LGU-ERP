import { fail } from '../http.js';
import type { Permission } from '@ltas/contracts';

export const INTERIM_PROFILE = 'P2-DRAFT-INTERIM';
export const INTERIM_NOTE = 'Engineering allowlist only; not adopted Internal Rules of Procedure (D-02).';

export const interimEdges = [
  {code:'submit', fromStage:'DRAFT', toStage:'SUBMITTED', permission:'measure.submit' as Permission},
  {code:'return', fromStage:'SUBMITTED', toStage:'DRAFT', permission:'measure.edit' as Permission},
  {code:'withdraw', fromStage:'DRAFT', toStage:'WITHDRAWN', permission:'measure.submit' as Permission},
  {code:'withdraw', fromStage:'SUBMITTED', toStage:'WITHDRAWN', permission:'measure.submit' as Permission},
] as const;

export function resolveTransition(fromStage:string, code:string):{fromStage:string;toStage:string;permission:Permission} {
  const edge=interimEdges.find(item=>item.fromStage===fromStage && item.code===code);
  if(!edge) fail(422,'TRANSITION_DENIED','This action is not allowed in the current draft profile.');
  return edge;
}
