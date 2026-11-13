import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { readApplications } from './application-store';

export function PublicApplicationSuccessPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref') ?? '';
  const application = readApplications().find(
    (item) => item.reference === reference,
  );

  return (
    <section className="mx-auto max-w-xl py-10 text-center sm:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e5f4eb] text-[#176b4d]">
        <Check size={30} strokeWidth={2.2} />
      </div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
        Application received
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
        You’ve taken the first step.
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#738078]">
        {application
          ? `Your application for ${application.programmeName} was received for ${application.cohortName}. Save your reference number. Application status tracking is not available yet.`
          : 'Your application was received. Save the reference number shown after you submitted.'}
      </p>
      {application ? (
        <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-[#e6ebe7] bg-white p-5 text-left">
          <div className="text-xs text-[#829087]">REFERENCE NUMBER</div>
          <div className="mt-1 font-mono text-lg font-semibold">
            {application.reference}
          </div>
          <div className="mt-4 border-t border-[#edf0ee] pt-4 text-sm">
            <div className="font-semibold">{application.programmeName}</div>
            <div className="mt-1 text-xs text-[#829087]">
              Status: Application submitted
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/apply/submissions"
          className="rounded-xl bg-[#176b4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#0f513a]"
        >
          View recent submissions
        </Link>
        <Link
          to="/apply"
          className="rounded-xl border border-[#dfe6e1] bg-white px-5 py-3 text-sm font-semibold text-[#52645a] hover:bg-[#f6f8f6]"
        >
          Explore more programs
        </Link>
      </div>
    </section>
  );
}
