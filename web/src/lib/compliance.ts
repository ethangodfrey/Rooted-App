import type { StateFoodRegulation } from '@/types/database';

export function complianceChecklistForState(
  regs: StateFoodRegulation | null,
): { label: string; required: boolean; met?: boolean }[] {
  if (!regs) {
    return [{ label: 'Select your state to see cottage food requirements', required: true }];
  }

  return [
    { label: 'Cottage food sales allowed in your state', required: true, met: regs.cottage_food_allowed },
    {
      label: regs.requires_food_handler_cert
        ? 'Food handler certification on file'
        : 'Food handler certification (recommended)',
      required: regs.requires_food_handler_cert,
    },
    {
      label: regs.requires_permit ? 'Cottage food permit uploaded' : 'Permit (if required by state)',
      required: regs.requires_permit,
    },
    { label: 'Product labels include required fields', required: true },
    { label: 'No prohibited products listed (meat, dairy, etc.)', required: true },
  ];
}
