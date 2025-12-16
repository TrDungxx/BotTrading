import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import CustomIntervalModal from './popup panel/CustomIntervalModal';

interface TimeframeOption { value: string; label: string; pinned?: boolean; }
interface TimeframeSelectorProps {
  onClose: () => void;
  onSave: (selectedTimeframes: string[]) => void;
  currentTimeframes: string[];
}

const ORDER = ['1s','1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];
const LS_KEY = 'tw.customIntervals.v1';

const BASE: TimeframeOption[] = [
  { value:'1s',label:'1s'},{value:'1m',label:'1m'},{value:'3m',label:'3m'},{value:'5m',label:'5m'},
  { value:'15m',label:'15m'},{value:'30m',label:'30m'},{value:'1h',label:'1h'},{value:'2h',label:'2h'},
  { value:'4h',label:'4h'},{value:'6h',label:'6h'},{value:'8h',label:'8h'},{value:'12h',label:'12h'},
  { value:'1d',label:'1d'},{value:'3d',label:'3d'},{value:'1w',label:'1w'},{value:'1M',label:'1M'},
];

const byOrder = (a:TimeframeOption,b:TimeframeOption) => {
  const ia = ORDER.indexOf(a.value), ib = ORDER.indexOf(b.value);
  if (ia === -1 && ib === -1) return a.value.localeCompare(b.value);
  if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
};

const readLS = ():string[] => { 
  try{ 
    const r=localStorage.getItem(LS_KEY); 
    const v=r?JSON.parse(r):[]; 
    return Array.isArray(v)?v:[]; 
  }catch{ 
    return []; 
  } 
};

const writeLS = (v:string[]) => { 
  try{ 
    localStorage.setItem(LS_KEY, JSON.stringify(v)); 
  }catch{} 
};

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({ onClose, onSave, currentTimeframes }) => {
  const initialPinnedRef = useRef<string[] | null>(null);
  if (initialPinnedRef.current === null) {
    initialPinnedRef.current = currentTimeframes.slice();
  }

  const [customs, setCustoms] = useState<string[]>(() => readLS());
  const ALL: TimeframeOption[] = useMemo(()=>{
    const customOpts = customs.map(v=>({value:v,label:v}));
    const merged = [
      ...BASE,
      ...customOpts.filter(c=>!BASE.some(b=>b.value===c.value)),
    ];
    return merged.sort(byOrder);
  },[customs]);

  const [pinned, setPinned] = useState<TimeframeOption[]>(
    () => (initialPinnedRef.current ?? []).map(v=>{
      const f = ALL.find(t=>t.value===v);
      return f ? {...f,pinned:true} : { value:v, label:v, pinned:true };
    })
  );

  const available = useMemo(()=>{
    const setPinned = new Set(pinned.map(p=>p.value));
    return ALL.filter(t=>!setPinned.has(t.value)).sort(byOrder);
  },[ALL,pinned]);

  const toggle = useCallback((tf:TimeframeOption, isPinned:boolean)=>{
    if(isPinned){
      setPinned(prev=>prev.filter(x=>x.value!==tf.value));
    }else{
      setPinned(prev=>[...prev,{...tf,pinned:true}]);
    }
  },[]);

  const handleSave = useCallback(()=>{
    onSave(pinned.map(p=>p.value));
    onClose();
  },[pinned,onSave,onClose]);

  const [showAdd,setShowAdd]=useState(false);
  
  const addCustom = useCallback((interval:string)=>{
    const exists = pinned.some(p=>p.value===interval) || ALL.some(a=>a.value===interval);
    if(exists) return;
    const next = Array.from(new Set([...customs, interval]));
    setCustoms(next); 
    writeLS(next);
  },[pinned, ALL, customs]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onClose();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-dark-800 rounded-lg shadow-2xl border border-dark-700 w-full max-w-md"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-fluid-4 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white">Time</h3>
            <button onClick={onClose} className="text-dark-400 hover:text-white">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-fluid-sm font-medium text-dark-300">Pinned</h4>
                <button onClick={handleSave} className="text-fluid-sm font-medium text-yellow-400 hover:text-yellow-300">
                  Save
                </button>
              </div>
              <div className="grid grid-cols-3 gap-fluid-3">
                {pinned.map(tf=>(
                  <button 
                    key={tf.value}
                    onClick={()=>toggle(tf,true)}
                    className="relative px-fluid-4 py-2 rounded-fluid-md text-fluid-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {tf.label}
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"/>
                  </button>
                ))}
              </div>
              {pinned.length===0 && (
                <p className="text-fluid-sm text-dark-400 text-center py-fluid-4">No pinned timeframes.</p>
              )}
            </div>

            <div>
              <h4 className="text-fluid-sm font-medium text-dark-300 mb-3">Available</h4>
              <div className="grid grid-cols-3 gap-fluid-3">
                {available.map(tf=>(
                  <button 
                    key={tf.value}
                    onClick={()=>toggle(tf,false)}
                    className="px-fluid-4 py-2 rounded-fluid-md text-fluid-sm font-medium bg-dark-700 text-dark-300 hover:bg-dark-600"
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              {available.length===0 && (
                <p className="text-fluid-sm text-dark-400 text-center py-fluid-4">All timeframes are pinned</p>
              )}
            </div>

            <div>
              <h4 className="text-fluid-sm font-medium text-dark-300 mb-3">Custom Intervals</h4>
              <button
                onClick={()=>setShowAdd(true)}
                className="w-full py-fluid-3 border-2 border-dashed border-dark-600 rounded-fluid-md text-dark-400 hover:border-dark-500 hover:text-dark-300 text-fluid-sm"
              >
                + Add Custom Interval
              </button>
            </div>
          </div>
        </div>
      </div>

      <CustomIntervalModal 
        open={showAdd} 
        onClose={()=>setShowAdd(false)} 
        onSubmit={addCustom}
      />
    </>
  );
};

export default TimeframeSelector;