import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, FileText } from 'lucide-react';
import { readApplications } from './application-store';

const formatSubmitted = (value: string) =>
  new Date(value).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function PublicSubmissionsPage() {
  const [applications] = useState(readApplications);

  return (
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
            Your journey
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Recent submissions
          </h1>
          <p className="mt-2 text-sm text-[#738078]">
            Applications submitted from this browser.
          </p>
        </div>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#176b4d] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f513a] sm:self-auto"
        >
          Explore programs <ArrowRight size={16} />
        </Link>
      </div>

      {applications.length > 0 ? (
        <div className="mt-7 space-y-3">
          {applications.map((application) => (
            <article
              key={application.reference}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e6ebe7] bg-white p-5 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ef] text-[#176b4d]">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {application.programmeName}
                  </h2>
                  <p className="mt-1 text-xs text-[#68766f]">
                    {application.cohortName}
                  </p>
                  <p className="mt-1 text-xs text-[#829087]">
                    Ref. {application.reference} · Submitted{' '}
                    {formatSubmitted(application.submittedAt)}
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eaf5ef] px-3 py-1.5 text-xs font-semibold text-[#176b4d]">
                Submitted
              </span>
            </article>
          ))}
          <p className="pt-2 text-xs text-[#89958f]">
            This list is kept in this browser. Keep each reference number to
            contact Shoova about an application.
          </p>
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-dashed border-[#d6dfd9] bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf5ef] text-[#176b4d]">
            <FileText size={22} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">
            Your recent submissions will appear here
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#738078]">
            After applying, save the reference number shown on the confirmation
            screen.
          </p>
          <Link
            to="/apply"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#176b4d] hover:text-[#0f513a]"
          >
            Browse open programs <ChevronRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}
