
import React, { useState, useMemo } from 'react';
import { FileText, ArrowRight } from 'lucide-react';

export const Calculator: React.FC = () => {
  const [price, setPrice] = useState<number>(55000);
  const [deposit, setDeposit] = useState<number>(15000);
  const [interest, setInterest] = useState<number>(8.5);
  const [office, setOffice] = useState<'Harare' | 'Bulawayo'>('Harare');

  const monthlyInstallment = useMemo(() => {
    const principal = price - deposit;
    if (principal <= 0) return 0;
    const totalWithInterest = principal * (1 + (interest / 100));
    return totalWithInterest / 36;
  }, [price, deposit, interest]);

  return (
    <div className="max-w-screen-xl space-y-32 animate-in fade-in duration-1000">
      <div className="grid grid-cols-12 gap-32">
        <div className="col-span-7 space-y-24">
          <div className="border-b border-fcDivider pb-12">
             <h2 className="text-5xl font-light tracking-tightest text-fcSlate font-sans">Terms simulator</h2>
             <p className="text-sm text-fcMuted mt-4 font-light leading-relaxed">Simulate automated settlement cycles for land acquisition. Financial logic is based on reducing balance principles.</p>
          </div>
          
          <div className="space-y-20">
            <div className="grid grid-cols-2 gap-20">
              <div className="space-y-6">
                <label className="text-[11px] font-bold text-fcMuted tracking-wider uppercase font-sans">Asking Price (USD)</label>
                <input 
                  type="number" 
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full border-b border-fcDivider py-4 text-4xl font-light tracking-tightest transition-all focus:border-fcGold font-mono"
                />
              </div>

              <div className="space-y-6">
                <label className="text-[11px] font-bold text-fcMuted tracking-wider uppercase font-sans">Entry deposit</label>
                <input 
                  type="number" 
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="w-full border-b border-fcDivider py-4 text-4xl font-light tracking-tightest transition-all focus:border-fcGold font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-20">
              <div className="space-y-6">
                <label className="text-[11px] font-bold text-fcMuted tracking-wider uppercase font-sans">APR yield (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={interest}
                  onChange={(e) => setInterest(Number(e.target.value))}
                  className="w-full border-b border-fcDivider py-4 text-4xl font-light tracking-tightest transition-all focus:border-fcGold font-mono"
                />
              </div>

              <div className="space-y-6">
                <label className="text-[11px] font-bold text-fcMuted tracking-wider uppercase font-sans">Processing branch</label>
                <div className="flex space-x-12 pt-8">
                  {['Harare', 'Bulawayo'].map((city) => (
                    <button 
                      key={city}
                      onClick={() => setOffice(city as any)}
                      className={`text-[12px] font-bold tracking-widest transition-all border-b-2 pb-2 font-sans ${office === city ? 'text-fcSlate border-fcGold' : 'text-fcDivider border-transparent hover:text-fcSlate'}`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 space-y-24 border-l border-fcDivider pl-32 py-4">
          <div className="space-y-20">
            <div className="space-y-6">
              <div className="text-[11px] text-fcMuted font-bold tracking-widest uppercase font-sans">Debt principal</div>
              <div className="text-6xl font-light tracking-tightest text-fcSlate font-mono">${(price - deposit).toLocaleString()}</div>
              <div className="w-full h-[1px] bg-fcDivider relative">
                <div className="absolute h-full bg-fcGold" style={{ width: '40%' }}></div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="text-[11px] text-fcMuted font-bold tracking-widest uppercase font-sans">36-month settlement</div>
              <div className="text-8xl font-light tracking-tightest text-fcGold mb-4 font-mono">${monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-fcMuted leading-relaxed font-light max-w-xs">Estimated monthly liability inclusive of {interest}% interest over the full term duration.</p>
            </div>
          </div>

          <button className="flex items-center space-x-6 text-sm font-bold tracking-widest text-fcSlate group border-b-2 border-fcSlate pb-5 hover:pb-10 transition-all mt-10 font-sans">
            <span>Execute legal draft</span>
            <ArrowRight size={18} strokeWidth={1.5} className="transition-transform group-hover:translate-x-3 duration-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
