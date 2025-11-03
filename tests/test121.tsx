<td className={`px-4 py-3 font-medium ${pnlClass}`}>
  {nearZero(pnl)
    ? "0.00 " 
    : `${pnl > 0 ? "+" : "-"}${fmtShort(Math.abs(pnl))} USDT`}
  <br />
  <span className="text-xs opacity-80">
    {(() => {
      const r = calculatePnlPercentage(pos);
      return nearZero(r)
        ? "0.00%"
        : `(${r > 0 ? "+" : "-"}${fmtShort(Math.abs(r))}%)`;
    })()}
  </span>
</td>




                  <td className={`px-4 py-3 font-medium ${pnlClass}`}>
                    {pnl == null
                      ? "--"
                      : nearZero(pnl)
                      ? "0.00"
                      : `${pnl > 0 ? "+" : "-"}${fmt(Math.abs(pnl), 2)}`}
                    <br />
                    <span className="text-xs opacity-80">
                      {(() => {
                        const r = calculatePnlPercentage(pos);
                        return r == null
                          ? "--"
                          : nearZero(r)
                          ? "0.00%"
                          : `(${r > 0 ? "+" : "-"}${fmt(Math.abs(r), 2)}%)`;
                      })()}
                    </span>
                  </td>