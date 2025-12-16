// components/tabterminalindicator/IndicatorHistory.tsx
import React from "react";
import { indicatorApi } from "../../utils/api";
import { HistoryRow,mapHistoryRow } from "../../utils/IndicatorHistory";

const Chip: React.FC<{ type: string }> = ({ type }) => {
  const t = type.toUpperCase();
  const cls =
    type === "long"  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
    type === "short" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" :
    "bg-slate-500/10 text-slate-300 border-slate-500/30";
  return <span className={`px-2 py-0.5 rounded-fluid-md border text-xs ${cls}`}>{t}</span>;
};

const IndicatorHistory: React.FC = () => {
  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await indicatorApi.getAllIndicatorsHistory();
      const list = (resp?.Data?.indicators ?? []).map(mapHistoryRow);
      // mới nhất lên đầu
      setRows(list.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    } catch (e: any) {
      setError(e?.message || "Load history failed");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, []);

  return (
    <div className="h-full min-h-[14rem] rounded border border-dark-600 bg-dark-700 flex flex-col">
      <div className="p-fluid-2 border-b border-dark-600 flex items-center justify-between">
        
        <button
          className="text-xs border border-dark-500 rounded px-2 py-fluid-1 hover:bg-dark-600"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="p-fluid-3 text-xs text-rose-400">{error}</div>}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-dark-700/70 backdrop-blur border-b border-dark-600">
            <tr className="[&>th]:px-fluid-3 [&>th]:py-2 text-gray-400 text-fluid-xs">
              <th>Time</th>
              <th>Type</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Strategy</th>
              <th>Cap %</th>
              {/*<th>Req ID</th>*/}
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-fluid-3 [&>tr>td]:py-2">
            {rows.length === 0 && !loading && (
              <tr><td className="p-fluid-3 text-gray-400" colSpan={7}>Chưa có dữ liệu lịch sử</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-dark-600/60 hover:bg-dark-600/40">
                <td className="whitespace-nowrap text-gray-300">
                  {new Date(r.timestamp ?? r.createdAt).toLocaleString()}
                </td>
                <td><Chip type={r.type} /></td>
                <td className="font-medium">{r.symbol}</td>
                <td>{r.price != null ? r.price : "—"}</td>
                <td className="text-gray-300">{r.strategy}</td>
                <td>{r.capitalPercent != null ? `${r.capitalPercent}%` : "—"}</td>
               {/* <td className="text-gray-400 truncate max-w-[10rem]" title={r.requestId ?? ""}>{r.requestId ?? "—"}</td>*/}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IndicatorHistory;
