import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { financeService } from '../finance.service';
import { FundRequestForm } from '../components/FundRequestForm';

const EDITABLE_STATUSES = new Set(['draft', 'rejected']);

export function MeEditFundRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const requestQuery = useQuery({
    queryKey: ['me', 'fund-request', requestId],
    queryFn: () => financeService.getMyFundRequest(requestId!),
    enabled: Boolean(requestId),
  });

  if (requestQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate('/me/finance')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my claims
        </button>

        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <p className="text-sm text-red-700">
            This claim could not be loaded. It may have been
            removed or belongs to another employee.
          </p>
        </div>
      </div>
    );
  }

  const request = requestQuery.data;

  if (!EDITABLE_STATUSES.has(request.status)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(`/me/finance/${request.id}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the claim
        </button>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          This claim can no longer be edited because it is already
          in the approval process.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(`/me/finance/${request.id}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the claim
        </button>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Edit {request.request_number}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Update the claim, add more receipts, then resubmit it for
          approval.
        </p>
      </div>

      <FundRequestForm
        initial={request}
        onCancel={() => navigate(`/me/finance/${request.id}`)}
        onSaved={(updated, submitted) => {
          toast.success(
            submitted
              ? 'Claim resubmitted for approval'
              : 'Changes saved'
          );

          navigate(`/me/finance/${updated.id}`);
        }}
      />
    </div>
  );
}
