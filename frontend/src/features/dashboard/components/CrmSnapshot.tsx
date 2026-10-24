import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { crmService } from '@/services/crm.service';
import {
  GitBranch,
  TrendingUp,
  DollarSign,
  Target,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CrmSnapshot() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'dashboard-snapshot'],
    queryFn: () => crmService.listOpportunities({ limit: 500 }),
    refetchInterval: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const items = data.items;
  const open = items.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
  const won = items.filter((o) => o.stage === 'won');
  const lost = items.filter((o) => o.stage === 'lost');

  const baseValue = (o: (typeof items)[number]) => o.amount_base ?? 0;
  const openValue = open.reduce((s, o) => s + baseValue(o), 0);
  const weightedValue = open.reduce(
    (s, o) => s + (baseValue(o) * o.probability) / 100,
    0,
  );
  const winRate =
    won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0;

  const topThree = [...open]
    .sort((a, b) => baseValue(b) - baseValue(a))
    .slice(0, 3);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            CRM Pipeline
          </h3>
        </div>
        <button
          onClick={() => navigate('/crm')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open CRM
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-5">
        {/* Four KPIs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <GitBranch className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Open
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums">
              {open.length}
            </div>
            <div className="text-[10px] text-gray-500">opportunities</div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Value
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums">
              GHS{' '}
              {openValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-500">total open</div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Forecast
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              GHS{' '}
              {weightedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-500">weighted</div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Target className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Win rate
              </span>
            </div>
            <div
              className={cn(
                'text-xl font-bold tabular-nums',
                winRate >= 50
                  ? 'text-emerald-700'
                  : winRate >= 25
                    ? 'text-amber-700'
                    : 'text-gray-900',
              )}
            >
              {winRate}%
            </div>
            <div className="text-[10px] text-gray-500">
              {won.length} won · {lost.length} lost
            </div>
          </div>
        </div>

        {/* Top open opportunities */}
        {topThree.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Top open
            </div>
            <div className="space-y-1.5">
              {topThree.map((opp) => (
                <button
                  key={opp.id}
                  onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                  className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-gray-900 truncate">
                      {opp.title}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {opp.organisation.name} · {opp.stage}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] font-semibold text-gray-900 tabular-nums">
                      {opp.currency}{' '}
                      {(opp.amount || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    {opp.currency !== 'GHS' && (
                      <div className="text-[9px] text-gray-400 tabular-nums">
                        ≈ GHS{' '}
                        {baseValue(opp).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}