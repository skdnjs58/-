import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  ResponsiveContainer, 
  Cell,
  Tooltip
} from 'recharts';

const data = [
  { name: '월', score: 65, active: false },
  { name: '화', score: 80, active: false },
  { name: '수', score: 55, active: false },
  { name: '목', score: 85, active: false },
  { name: '금', score: 92, active: true },
  { name: '토', score: 0, active: false },
  { name: '일', score: 0, active: false },
];

const StatsOverview: React.FC = () => {
  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
              dy={10}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }} 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl border border-white/10">
                      점수: {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[8, 8, 8, 8]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.active ? '#4f46e5' : '#f1f5f9'}
                  className={entry.active ? 'opacity-100 shadow-lg shadow-indigo-100' : 'opacity-100'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">선택된 기간</span>
        </div>
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">평균 72.4</span>
      </div>
    </div>
  );
};

export default StatsOverview;
