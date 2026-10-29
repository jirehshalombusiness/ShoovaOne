import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { FundRequestForm } from '../components/FundRequestForm';

export function MeNewFundRequestPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">
          My Finance
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          New claim
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Attach the receipts or invoices that prove the expense.
          Your manager, Finance and the CEO will review the claim
          before Finance pays it out.
        </p>
      </div>

      <FundRequestForm
        onCancel={() => navigate('/me/finance')}
        onSaved={(request, submitted) => {
          toast.success(
            submitted
              ? 'Claim submitted for approval'
              : 'Draft saved'
          );

          navigate(`/me/finance/${request.id}`);
        }}
      />
    </div>
  );
}
