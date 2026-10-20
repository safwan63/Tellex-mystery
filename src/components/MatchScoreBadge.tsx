import { getMatchScoreOutOf10, matchScoreColor } from '../utils/matchScore';
import { Recommendation } from '../types/bookDiscovery';

type Props = {
  rec: Pick<Recommendation, 'matchScoreOutOf10' | '_rankScore'>;
  size?: 'sm' | 'md';
  showBar?: boolean;
};

export default function MatchScoreBadge({ rec, size = 'sm', showBar = true }: Props) {
  const scoreOutOf10 = getMatchScoreOutOf10(rec);
  if (scoreOutOf10 == null) return null;

  const color = matchScoreColor(scoreOutOf10);
  const barWidth = `${(scoreOutOf10 / 10) * 100}%`;
  const textClass = size === 'md' ? 'text-lg' : 'text-sm';

  return (
    <div className="flex items-center gap-2" title="How well this book fits your answers">
      <span className={`${textClass} font-black tabular-nums`} style={{ color }}>
        {scoreOutOf10.toFixed(1)}
        <span className="text-xs font-medium text-gray-400">/10</span>
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Match</span>
      {showBar && (
        <div className={`${size === 'md' ? 'w-28' : 'w-24'} h-1.5 bg-gray-100 rounded-full overflow-hidden`}>
          <div className="h-full rounded-full transition-all" style={{ width: barWidth, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}
