import { statusClasses, titleCase } from './payroll.utils';

export function PayrollStatusBadge({ status }: { status?: string | null }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
        status,
      )}`}
    >
      {titleCase(status)}
    </span>
  );
}
