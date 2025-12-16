import React, { useState, type PropsWithChildren, type ReactNode } from 'react';
import MainDCA from '../../components/dca/MainDCA';
import EntryOrder from '../../components/dca/EntryOrder';
import ExitOrder from '../../components/dca/ExitOrder';
import Advance from '../../components/dca/Advance';
/* ---- AccordionItem: CHỈ là item nhỏ, không chứa cả trang ---- */
type AccordionItemProps = PropsWithChildren<{
  title: string;
  right?: ReactNode;        // bạn có thể truyền <button> ở đây cũng được
  defaultOpen?: boolean;
}>;

const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  right,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
      {/* Hàng header: button toggle + vùng right tách riêng */}
      <div className="flex items-center justify-between px-fluid-4 py-fluid-3">
        {/* NÚT TOGGLE: chỉ chứa tiêu đề + caret, không chứa nút khác */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between gap-fluid-3 flex-1 text-left hover:bg-dark-700/40 px-2 py-fluid-1.5 rounded-xl"
        >
          <span className="text-fluid-sm font-semibold">{title}</span>
          <span className={`transition-transform ${open ? "" : "rotate-180"}`}>▾</span>
        </button>

        {/* RIGHT AREA: là anh em của toggle, nên không còn nested button */}
        <div className="ml-2 shrink-0">
          {right ?? <button className="btn btn-xs" type="button">Video tutorial</button>}
        </div>
      </div>

      {open && <div className="p-fluid-4">{children}</div>}
    </div>
  );
};

/* ---- Trang DCABot thật sự ---- */
const DCABot: React.FC = () => {
  return (
    <div className="h-[calc(100svh-4rem)] md:h-[calc(100dvh-4rem)] bg-dark-900 text-dark-50 flex flex-col min-h-0">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-dark-700 bg-dark-800/95 backdrop-blur px-fluid-4 py-fluid-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Create DCA Bot</h1>
        <div className="flex items-center gap-fluid-2">
          <button className="btn btn-sm">Guide</button>
          <button className="btn btn-sm">Strategy presets</button>
          <button className="btn btn-icon btn-sm" aria-label="settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.75 2.5C4.4 2.5 2.5 4.4 2.5 6.75S4.4 11 6.75 11c1.91 0 3.53-1.26 4.06-3H20.5A1.5 1.5 0 0 0 22 6.5 1.5 1.5 0 0 0 20.5 5H10.93C10.58 4.01 8.84 2.5 6.75 2.5Z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-auto p-fluid-4 grid grid-cols-12 gap-fluid-4 auto-rows-fr">
        {/* Trái: Chart + Orders + Waiting */}
        <section className="col-span-12 xl:col-span-7 order-2 xl:order-1 h-full min-h-0 flex flex-col gap-fluid-4">
          <div className="card flex-1 flex flex-col min-h-0">
            <div className="card-header flex items-center justify-between">
              <p className="text-fluid-sm font-medium">Orders</p>
              <div className="flex items-center gap-fluid-3 text-xs text-dark-200">
                <span className="inline-flex items-center gap-fluid-2"><span className="w-2 h-2 rounded-full bg-success inline-block" />Chart</span>
                <span className="inline-flex items-center gap-fluid-2"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Orders</span>
                <span className="inline-flex items-center gap-fluid-2"><span className="w-2 h-2 rounded-full bg-dark-400 inline-block" />AO Usage</span>
              </div>
            </div>

            <div className="card-body grid grid-cols-1 lg:grid-cols-2 gap-fluid-4 auto-rows-fr flex-1 min-h-0">
              {/* Chart */}
              <div className="rounded-xl overflow-hidden border border-dark-700 bg-dark-800 h-full min-h-[240px] min-h-0">
                <div className="w-full h-full grid place-content-center text-dark-300 text-xs">Trading chart</div>
              </div>
              {/* Orders table */}
              <div className="rounded-xl overflow-hidden border border-dark-700 bg-dark-800 h-full min-h-0">
                <div role="region" className="overflow-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-dark-700/40">
                      <tr className="text-left text-dark-200">
                        <th className="px-fluid-3 py-2 w-10"></th>
                        <th className="px-fluid-3 py-2">Entry Order</th>
                        <th className="px-fluid-3 py-2">Avg. O 1</th>
                        <th className="px-fluid-3 py-2">Avg. O 2</th>
                        <th className="px-fluid-3 py-2">Avg. O 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-dark-700/60">
                        <td className="px-fluid-3 py-2 text-dark-300">Min. deviation, %</td>
                        <td className="px-fluid-3 py-2">0</td>
                        <td className="px-fluid-3 py-2">-1</td>
                        <td className="px-fluid-3 py-2">-5</td>
                        <td className="px-fluid-3 py-2">-21</td>
                      </tr>
                      <tr className="border-t border-dark-700/60">
                        <td className="px-fluid-3 py-2 text-dark-300">Min. order size, ETH</td>
                        <td className="px-fluid-3 py-2">0.00492592</td>
                        <td className="px-fluid-3 py-2">0.00373177</td>
                        <td className="px-fluid-3 py-2">0.00661111</td>
                        <td className="px-fluid-3 py-2">0.01351515</td>
                      </tr>
                      <tr className="border-t border-dark-700/60">
                        <td className="px-fluid-3 py-2 text-dark-300">Order volume, USDT</td>
                        <td className="px-fluid-3 py-2">20</td>
                        <td className="px-fluid-3 py-2">15</td>
                        <td className="px-fluid-3 py-2">25.5</td>
                        <td className="px-fluid-3 py-2">43.35</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Waiting box chiếm phần còn lại */}
            <div className="rounded-xl border border-dashed border-dark-700 bg-dark-900/30 flex-1 grid place-items-center min-h-0">
              <p className="text-dark-300 text-fluid-sm">Waiting for setup…</p>
            </div>
          </div>
        </section>

        {/* Phải: 4 accordion mở sẵn */}
        <aside className="col-span-12 xl:col-span-5 order-1 xl:order-2 h-full min-h-0">
  {/* Khung ngoài giống cột trái */}
  <div className="card h-full flex flex-col min-h-0">
    <div className="card-header flex items-center justify-between">
      <p className="text-fluid-sm font-medium">Configuration</p>
      {/* tuỳ: <button className="btn btn-xs">Video tutorial</button> */}
    </div>

    {/* Nội dung cuộn bên trong khung */}
    <div className="card-body flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
      <AccordionItem title="Main" defaultOpen>
        <MainDCA />
      </AccordionItem>

      <AccordionItem title="Entry order" defaultOpen>
        <EntryOrder />
      </AccordionItem>

      <AccordionItem title="Exit order" defaultOpen>
        <ExitOrder />
      </AccordionItem>

      <AccordionItem title="Advanced" defaultOpen>
        <Advance />
      </AccordionItem>
    </div>
  </div>
</aside>
      </main>
    </div>
  );
};

export default DCABot;
