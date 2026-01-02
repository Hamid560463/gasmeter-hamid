
import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, PlusCircle, History, Settings, Camera, AlertTriangle, CheckCircle2, 
  Factory, Gauge, Trash2, AlertOctagon, Info, ShieldCheck, 
  ArrowRight, LogOut, Globe, Database, Upload, TrendingUp, Search,
  Calendar, FileText, ArrowUpRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Industry, Reading, AppState, User } from './types';
import { extractMeterReading } from './services/geminiService';
import * as DB from './services/db';
import { Button } from './components/Button';

const formatNumber = (num: number) => new Intl.NumberFormat('fa-IR').format(num);
const formatDate = (timestamp: number) => new Intl.DateTimeFormat('fa-IR', { 
  dateStyle: 'medium', 
  timeStyle: 'short', 
  calendar: 'persian' 
}).format(new Date(timestamp));

interface NavBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  isCenter?: boolean;
}

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

interface DashboardProps {
  state: AppState;
  industries: Industry[];
  onNewReading: () => void;
}

interface ScanViewProps {
  industries: Industry[];
  onSave: (reading: Partial<Reading>) => Promise<void>;
  onCancel: () => void;
}

interface HistoryViewProps {
  state: AppState;
  onDelete: (id: string) => void;
}

interface SettingsViewProps {
  state: AppState;
  onLogout: () => void;
  onGoAdmin: () => void;
}

interface AdminViewProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onUpdateIndustries: (industries: Industry[]) => void;
  onAssignIndustries: (username: string, industries: Industry[]) => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'scan' | 'history' | 'settings' | 'admin'>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<AppState>({ 
    industries: [], readings: [], users: [], currentUser: null, pendingConfigs: {} 
  });

  useEffect(() => {
    const unsubscribe = DB.subscribe((newData) => {
      const sessionUserId = sessionStorage.getItem('currentUserId');
      setState(prev => {
        let currentUser = prev.currentUser;
        if (sessionUserId && newData.users) {
          currentUser = newData.users.find(u => u.id === sessionUserId) || null;
        }
        return { ...prev, ...newData, currentUser };
      });
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    sessionStorage.setItem('currentUserId', user.id);
    setState(prev => ({ ...prev, currentUser: user }));
    setActiveTab('home');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUserId');
    setState(prev => ({ ...prev, currentUser: null }));
  };

  const getVisibleIndustries = () => {
      if (!state.currentUser) return [];
      if (state.currentUser.role === 'admin') return state.industries;
      const assigned = state.pendingConfigs?.[state.currentUser.username];
      if (!assigned) return [];
      const assignedIds = new Set(assigned.map(a => a.id));
      return state.industries.filter(i => assignedIds.has(i.id));
  };

  const visibleIndustries = getVisibleIndustries();

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-emerald-400 p-6 text-center">
      <div className="relative mb-8 text-emerald-500">
        <Globe size={64} className="animate-spin opacity-20 absolute -inset-2" />
        <Database size={64} className="animate-pulse relative z-10" />
      </div>
      <h2 className="text-xl font-bold mb-2 text-white">سامانه قرائت گاز صنایع</h2>
      <p className="text-slate-400 text-sm">در حال اتصال به دیتابیس ابری...</p>
    </div>
  );

  if (!state.currentUser) return <LoginView users={state.users} onLogin={handleLogin} />;

  const isAdmin = state.currentUser.role === 'admin';

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto bg-slate-50 shadow-2xl relative overflow-x-hidden">
      <header className="bg-emerald-700 text-white p-5 shadow-lg sticky top-0 z-30 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <Gauge size={24} className="text-emerald-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">گاز سنج هوشمند</h1>
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] font-medium">{state.currentUser.fullName} ({state.currentUser.role === 'admin' ? 'مدیر' : 'مامور'})</span>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-white/10 p-2.5 rounded-xl hover:bg-white/20 transition-all active:scale-90">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {activeTab === 'home' && <Dashboard state={state} industries={visibleIndustries} onNewReading={() => setActiveTab('scan')} />}
        {activeTab === 'scan' && <ScanView industries={visibleIndustries} onSave={async (r: Partial<Reading>) => { 
          const rWithUser = { ...r, recordedBy: state.currentUser?.username }; 
          await DB.putItem('readings', rWithUser); 
          setActiveTab('history');
        }} onCancel={() => setActiveTab('home')} />}
        {activeTab === 'history' && <HistoryView state={state} onDelete={(id: string) => confirm('آیا از حذف مطمئن هستید؟') && DB.deleteItem('readings', id)} />}
        {activeTab === 'settings' && <SettingsView state={state} onLogout={handleLogout} onGoAdmin={() => setActiveTab('admin')} />}
        {activeTab === 'admin' && <AdminView state={state} onAddUser={(u: User) => DB.putItem('users', u)} onDeleteUser={(id: string) => DB.deleteItem('users', id)} onUpdateIndustries={(i: Industry[]) => DB.bulkPutIndustries(i)} onAssignIndustries={(u: string, i: Industry[]) => DB.savePendingConfig(u, i)} />}
      </main>

      <nav className="fixed bottom-4 left-4 right-4 max-w-[calc(28rem-2rem)] mx-auto bg-white/90 backdrop-blur-lg border border-slate-200 rounded-3xl p-3 flex justify-around items-center z-40 shadow-2xl">
        <NavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={Home} label="داشبورد" />
        <NavBtn active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={Camera} label="قرائت" isCenter />
        <NavBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="سوابق" />
        <NavBtn active={activeTab === 'admin' || activeTab === 'settings'} onClick={() => setActiveTab(isAdmin ? 'admin' : 'settings')} icon={isAdmin ? ShieldCheck : Settings} label={isAdmin ? 'مدیریت' : 'تنظیمات'} />
      </nav>
    </div>
  );
}

const NavBtn = ({ active, onClick, icon: Icon, label, isCenter }: NavBtnProps) => (
  <button onClick={onClick} className={`flex flex-col items-center transition-all ${isCenter ? '-mt-12' : ''}`}>
    <div className={`
      flex items-center justify-center p-3 rounded-2xl transition-all duration-300
      ${isCenter ? 'bg-emerald-600 shadow-xl shadow-emerald-200 text-white scale-125 hover:bg-emerald-700 active:scale-110' : 
        active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-slate-600'}
    `}>
      <Icon size={24} strokeWidth={active || isCenter ? 2.5 : 2} />
    </div>
    {!isCenter && <span className={`text-[10px] mt-1 font-bold ${active ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>}
  </button>
);

const LoginView = ({ users, onLogin }: LoginViewProps) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const match = users.find(u => u.username === user && u.password === pass);
      if (match) onLogin(match);
      else alert('اطلاعات ورود نادرست است.');
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8 justify-center items-center">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex bg-emerald-600 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-100 mb-2">
            <Gauge size={56} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">برداشت گاز صنایع</h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">سامانه هوشمند پایش مصرف انرژی</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">نام کاربری</label>
            <input type="text" value={user} onChange={e=>setUser(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-right dir-ltr shadow-sm transition-all" placeholder="Username" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500 mr-2 uppercase tracking-widest">رمز عبور</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-right dir-ltr shadow-sm transition-all" placeholder="••••••••" required />
          </div>
          <Button type="submit" fullWidth disabled={loading} className="py-4 text-lg shadow-emerald-100">
            {loading ? <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" /> : "ورود به سامانه"}
          </Button>
        </form>

        {users.length === 0 && (
          <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl">
            <div className="flex items-center gap-2 mb-2 text-blue-700">
              <Info size={18} />
              <p className="text-xs font-bold">دیتابیس در حال حاضر خالی است</p>
            </div>
            <p className="text-[10px] text-blue-600 leading-relaxed mb-4">برای راه‌اندازی اولیه و افزودن صنایع و کاربران، به عنوان مدیر سیستم وارد شوید:</p>
            <button onClick={() => onLogin({ id: 'init-admin', username: 'admin', password: '', fullName: 'مدیر کل سیستم', role: 'admin' })} className="w-full bg-blue-600 text-white text-xs py-3 rounded-xl font-black hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">ورود به پنل مدیریت</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = ({ state, industries, onNewReading }: DashboardProps) => {
  const totalReadings = state.readings.length;
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="flex justify-between items-start mb-10 relative z-10">
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/30">
            <TrendingUp size={28} />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black opacity-70 block uppercase tracking-tighter">Last Update</span>
            <span className="text-xs font-bold">{formatDate(Date.now())}</span>
          </div>
        </div>
        <div className="flex justify-between items-end relative z-10">
          <div>
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">صنایع فعال</p>
            <p className="text-5xl font-black tracking-tighter">{formatNumber(industries.length)}</p>
          </div>
          <div className="text-left">
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">قرائت‌های کل</p>
            <p className="text-5xl font-black tracking-tighter">{formatNumber(totalReadings)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
            <Factory size={22} className="text-emerald-600" /> لیست واحدهای صنعتی
          </h3>
          <span className="text-[10px] bg-emerald-100 px-3 py-1 rounded-full text-emerald-700 font-black uppercase tracking-widest shadow-sm">
            Live Monitoring
          </span>
        </div>
        
        <div className="grid gap-5">
          {industries.map((ind: Industry) => {
            const industryReadings = state.readings.filter(r => r.industryId === ind.id).sort((a,b) => b.timestamp - a.timestamp);
            const lastReading = industryReadings[0];
            const prevReading = industryReadings[1];
            
            let consumption = 0;
            if (lastReading && prevReading) {
               const timeDiff = (lastReading.timestamp - prevReading.timestamp) / (1000 * 60 * 60 * 24); // days
               if (timeDiff > 0) {
                 consumption = (lastReading.value - prevReading.value) / timeDiff;
               }
            }

            const usagePercent = ind.allowedDailyConsumption > 0 ? Math.min((consumption / ind.allowedDailyConsumption) * 100, 100) : 0;
            
            return (
              <div key={ind.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group active:scale-[0.98] transition-all hover:shadow-xl hover:shadow-slate-200/50">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h4 className="font-black text-slate-900 text-lg group-hover:text-emerald-700 transition-colors">{ind.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                      <Globe size={12} className="text-emerald-500" /> {ind.city}، {ind.address}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="bg-slate-50 text-slate-500 text-[10px] font-black px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
                      {ind.subscriptionId}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-black">
                    <div className="flex items-center gap-2 text-slate-500">
                      <ArrowUpRight size={14} className="text-emerald-500" />
                      مصرف روزانه تخمینی
                    </div>
                    <span className={usagePercent > 80 ? 'text-red-500' : 'text-emerald-600'}>
                      {formatNumber(Math.round(consumption))} m³ / {formatNumber(ind.allowedDailyConsumption)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${usagePercent}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                    <span>{usagePercent.toFixed(1)}٪ از حد مجاز</span>
                    {lastReading && <span>آخرین قرائت: {formatDate(lastReading.timestamp)}</span>}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-50 flex gap-2 overflow-x-auto no-scrollbar">
                  {ind.meters.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl text-[10px] font-black text-slate-600 whitespace-nowrap shadow-sm">
                      <Gauge size={16} className="text-emerald-500" />
                      {m.name}
                    </div>
                  ))}
                  <button onClick={onNewReading} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black whitespace-nowrap border border-emerald-100 active:scale-90 transition-transform">
                    <PlusCircle size={16} />
                    ثبت جدید
                  </button>
                </div>
              </div>
            );
          })}
          {industries.length === 0 && (
            <div className="text-center py-20 px-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <div className="bg-slate-200 inline-flex p-6 rounded-3xl text-slate-400 mb-6 shadow-inner"><Info size={40} /></div>
              <p className="text-slate-600 font-black text-lg">واحد صنعتی یافت نشد</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">توسط مدیر سیستم، صنایع مورد نظر را به حساب کاربری خود تخصیص دهید.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ScanView = ({ industries, onSave, onCancel }: ScanViewProps) => {
    const [step, setStep] = useState(1);
    const [selIndId, setSelIndId] = useState('');
    const [selMeterId, setSelMeterId] = useState('');
    const [val, setVal] = useState('');
    const [preview, setPreview] = useState<string|null>(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    
    const selInd = industries.find((i:Industry) => i.id === selIndId);
    const selMeter = selInd?.meters.find((m:any) => m.id === selMeterId);

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if(!f) return;
        const r = new FileReader();
        r.onload = async () => {
            const dataUrl = r.result as string;
            setPreview(dataUrl); 
            setLoadingAi(true);
            try { 
              const res = await extractMeterReading(dataUrl); 
              if(res.value !== null) setVal(res.value.toString()); 
            } catch(e) {
              alert("خطا در پردازش تصویر توسط هوش مصنوعی Gemini");
            } finally { 
              setLoadingAi(false); 
            }
        };
        r.readAsDataURL(f);
    };

    if(step === 1) return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
        <div className="flex items-center gap-3 mb-2 px-2">
          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shadow-sm"><Search size={24}/></div>
          <div>
            <h3 className="font-black text-slate-800 text-lg leading-tight">انتخاب کنتور جهت قرائت</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">صنعت و کنتور مورد نظر را لمس کنید</p>
          </div>
        </div>
        {industries.map((i:Industry) => (
          <div key={i.id} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="px-6 py-4 bg-slate-50 text-[11px] font-black text-slate-500 border-b border-slate-100 tracking-widest uppercase flex justify-between items-center">
              <span>{i.name}</span>
              <span className="text-[9px] bg-white px-2 py-0.5 rounded-lg border border-slate-200">ID: {i.subscriptionId}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {i.meters.map((m:any) => (
                <button key={m.id} onClick={()=>{setSelIndId(i.id);setSelMeterId(m.id);setStep(2)}} className="w-full text-right p-5 hover:bg-emerald-50 text-sm font-black flex gap-4 items-center transition-all group active:bg-emerald-100">
                  <div className="bg-slate-100 p-3 rounded-2xl text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all shadow-inner"><Gauge size={22}/></div>
                  <div className="flex-1">{m.name}</div>
                  <ArrowRight size={18} className="text-slate-300 rotate-180 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
    
    if(step === 2) return (
      <div className="space-y-6 animate-in zoom-in-95 duration-300 pb-10">
        <div className="space-y-1.5 px-2 text-center">
          <h3 className="font-black text-slate-800 text-xl">قرائت کنتور: {selMeter?.name}</h3>
          <p className="text-sm text-slate-400 font-bold">{selInd?.name}</p>
        </div>

        <div onClick={()=>!loadingAi && fileRef.current?.click()} className={`
          relative h-64 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer
          ${preview ? 'border-transparent shadow-2xl' : 'border-slate-200 bg-white hover:bg-slate-50 shadow-inner'}
        `}>
          {preview ? <img src={preview} className="h-full w-full object-cover"/> : (
            <div className="text-center space-y-3 p-8">
              <div className="bg-emerald-600 text-white p-6 rounded-full inline-block mb-2 shadow-xl shadow-emerald-100 animate-bounce"><Camera size={36}/></div>
              <p className="text-sm font-black text-slate-700">تصویر کنتور را ثبت کنید</p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">هوش مصنوعی Gemini به صورت خودکار عدد کنتور را استخراج می‌کند.</p>
            </div>
          )}
          {loadingAi && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md text-white flex flex-col items-center justify-center gap-5">
              <div className="relative">
                <div className="h-16 w-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-2xl"></div>
                <Database size={20} className="absolute inset-0 m-auto text-emerald-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-emerald-400 tracking-widest uppercase mb-1">Processing via Gemini AI</p>
                <p className="text-[11px] opacity-70 font-medium">در حال آنالیز و استخراج عدد از تصویر...</p>
              </div>
            </div>
          )}
        </div>

        <input type="file" ref={fileRef} className="hidden" accept="image/*" capture="environment" onChange={handlePhoto}/>
        
        <div className="space-y-5 px-1">
          <div className="relative group">
            <input 
              type="number" 
              placeholder="000000" 
              value={val} 
              onChange={e=>setVal(e.target.value)} 
              className="w-full p-8 bg-white border-2 border-slate-100 rounded-[2rem] text-center text-5xl dir-ltr font-black text-emerald-800 outline-none focus:border-emerald-500 transition-all placeholder:text-slate-200 shadow-sm"
            />
            <div className="absolute top-3 right-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Meter Counter Value (m³)</div>
          </div>
          
          <div className="flex gap-4">
            <Button variant="secondary" onClick={()=>setStep(1)} className="flex-1 py-4 text-slate-600 font-black">بازگشت</Button>
            <Button 
              onClick={() => {
                if(!val) return alert('لطفاً مقدار قرائت را وارد کنید.');
                onSave({ id: crypto.randomUUID(), industryId: selIndId, meterId: selMeterId, timestamp: Date.now(), value: parseFloat(val), imageUrl: preview || undefined, isManual: !preview });
              }} 
              className="flex-[2] py-4 text-lg shadow-emerald-200" 
              disabled={!val || loadingAi}
            >
              تایید و ثبت نهایی
            </Button>
          </div>
        </div>
      </div>
    );

    return null;
};

const HistoryView = ({ state, onDelete }: HistoryViewProps) => (
    <div className="space-y-5 animate-in fade-in duration-500 pb-10">
        <div className="flex justify-between items-center px-2">
          <h2 className="font-black text-slate-800 text-xl flex items-center gap-2">
            <History size={24} className="text-emerald-600"/> سوابق قرائت
          </h2>
          <span className="text-[10px] font-black text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full">{formatNumber(state.readings.length)} رکورد ثبت شده</span>
        </div>
        
        <div className="space-y-4">
          {state.readings.map((r:Reading) => {
              const ind = state.industries.find(i => i.id === r.industryId);
              return (
                  <div key={r.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm group hover:shadow-xl transition-all">
                      <div className="flex items-center gap-5">
                        <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-emerald-50 transition-colors shadow-inner relative">
                          <Gauge size={28} className="text-slate-400 group-hover:text-emerald-500" />
                          {r.imageUrl && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>}
                        </div>
                        <div>
                            <div className="text-[11px] font-black text-slate-400 mb-1 flex items-center gap-1">
                              <Factory size={12} /> {ind?.name || 'صنعت نامشخص'}
                            </div>
                            <div className="font-black text-slate-800 text-2xl flex items-center gap-2 tracking-tighter">
                              {formatNumber(r.value)} 
                              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">m³</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 font-bold bg-slate-50 py-1 px-2 rounded-lg inline-flex">
                              <Calendar size={12} /> {formatDate(r.timestamp)} 
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                              @{r.recordedBy}
                            </div>
                        </div>
                      </div>
                      <button onClick={()=>onDelete(r.id)} className="text-slate-300 hover:text-red-500 p-3 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                        <Trash2 size={22}/>
                      </button>
                  </div>
              );
          })}
        </div>
        {state.readings.length === 0 && (
          <div className="text-center py-28 text-slate-300">
            <div className="mb-6 inline-block opacity-10"><History size={80}/></div>
            <p className="font-black text-xl text-slate-400">سابقه‌ای ثبت نشده است</p>
            <p className="text-sm mt-2 text-slate-300">اولین قرائت خود را از بخش دوربین ثبت کنید.</p>
          </div>
        )}
    </div>
);

const SettingsView = ({ state, onLogout, onGoAdmin }: SettingsViewProps) => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2"><Settings size={24} className="text-emerald-600"/> تنظیمات حساب</h2>
        
        {state.currentUser?.role === 'admin' && (
          <button onClick={onGoAdmin} className="w-full bg-slate-900 text-white p-7 rounded-[2.5rem] shadow-2xl shadow-slate-200 flex justify-between items-center hover:bg-slate-800 transition-all group overflow-hidden relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full -ml-16 -mt-16 blur-2xl"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-emerald-500/20 p-3 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform"><ShieldCheck size={28}/></div>
              <div className="text-right">
                <p className="font-black text-base">پنل مدیریت پیشرفته</p>
                <p className="text-[11px] text-slate-400 font-bold mt-1 tracking-tight">کنترل صنایع، ماموران و گزارشات کل</p>
              </div>
            </div>
            <ArrowRight className="rotate-180 text-emerald-500 relative z-10" />
          </button>
        )}

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-8 shadow-sm">
            <div className="flex items-center gap-5 pb-8 border-b border-slate-50">
                <div className="bg-emerald-600 w-20 h-20 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-emerald-100 ring-4 ring-emerald-50">
                  <UserIcon size={40} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{state.currentUser?.fullName}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-lg">{state.currentUser?.username}</span>
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-200">{state.currentUser?.role}</span>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">عملیات حساب</h4>
              <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4 text-sm font-black text-slate-700">
                  <div className="bg-slate-100 p-2.5 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all"><FileText size={18}/></div>
                  راهنمای کاربری سامانه
                </div>
                <ArrowRight size={18} className="text-slate-300 rotate-180 group-hover:translate-x-1 transition-transform"/>
              </button>
              <Button variant="danger" fullWidth onClick={onLogout} className="py-5 text-base font-black rounded-3xl">خروج ایمن از حساب</Button>
            </div>
        </div>
    </div>
);

const UserIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 21C20 18.2386 16.4183 16 12 16C7.58172 16 4 18.2386 4 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdminView = ({ state, onAddUser, onDeleteUser, onUpdateIndustries, onAssignIndustries }: AdminViewProps) => {
    const [tab, setTab] = useState('db');
    const [targetUser, setTargetUser] = useState('');
    const [selIds, setSelIds] = useState(new Set<string>());
    const [newUser, setNewUser] = useState({name:'', user:'', pass:'', role:'user' as 'user' | 'admin'});
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if(targetUser && state.pendingConfigs) setSelIds(new Set((state.pendingConfigs[targetUser]||[]).map((i:Industry)=>i.id)));
        else setSelIds(new Set());
    }, [targetUser, state.pendingConfigs]);

    const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if(!f) return;
        const d = await f.arrayBuffer();
        const wb = XLSX.read(d);
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
        const industries: Industry[] = [];
        json.forEach((r: any) => {
            const id = String(r['SubscriptionID']||r['شناسه اشتراک']||'');
            if(id) industries.push({ 
                id: `IND-${id}`, 
                name: r['IndustryName']||r['نام صنعت']||'صنعت جدید', 
                subscriptionId: id, 
                city: r['City'] || r['شهر'] || '', 
                address: r['Address'] || r['آدرس'] || '', 
                meters: [{id:`M-${id}`, name: r['MeterName']||r['نام کنتور']||'کنتور اصلی', serialNumber: id}],
                allowedDailyConsumption: Number(r['Limit'] || r['حد مجاز'] || 5000)
            });
        });
        if(industries.length) {
          onUpdateIndustries(industries);
          alert(`${industries.length} واحد صنعتی با موفقیت بارگذاری شد.`);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex bg-slate-200/50 rounded-2xl p-1.5 shadow-inner border border-slate-100">
                {['db', 'users', 'assign'].map(t => (
                  <button key={t} onClick={()=>setTab(t)} className={`
                    flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all rounded-xl
                    ${tab===t?'bg-white text-emerald-700 shadow-md shadow-slate-200/50 ring-1 ring-slate-100':'text-slate-500 hover:text-slate-700'}
                  `}>
                    {{db:'دیتا سنتر',users:'پرسنل',assign:'تخصیص'}[t]}
                  </button>
                ))}
            </div>

            {tab === 'db' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -mr-24 -mb-24 blur-3xl"></div>
                        <div className="flex items-center gap-4 relative z-10">
                          <div className="bg-emerald-500 p-3 rounded-2xl text-white shadow-xl shadow-emerald-900/50"><Database size={24}/></div>
                          <div>
                            <h3 className="font-black text-lg">پایگاه داده صنایع</h3>
                            <p className="text-[10px] text-slate-400 font-bold tracking-tight">Vercel Postgres Connected</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed relative z-10">برای وارد کردن صنایع به صورت دسته‌جمعی، فایل اکسل را با ستون‌های "نام صنعت"، "شناسه اشتراک" و "حد مجاز" بارگذاری کنید.</p>
                        <input type="file" ref={fileRef} onChange={handleExcel} className="hidden" accept=".xlsx, .xls"/>
                        <Button onClick={()=>fileRef.current?.click()} fullWidth className="bg-emerald-600 hover:bg-emerald-500 shadow-none py-5 rounded-2xl font-black relative z-10 text-base">
                          <Upload size={20} className="mr-2"/> آپلود اکسل صنایع
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">صنایع در شبکه</p>
                        <p className="text-4xl font-black text-emerald-600 tracking-tighter">{formatNumber(state.industries.length)}</p>
                      </div>
                      <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">کل قرائت‌ها</p>
                        <p className="text-4xl font-black text-emerald-600 tracking-tighter">{formatNumber(state.readings.length)}</p>
                      </div>
                    </div>
                </div>
            )}

            {tab === 'users' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                          <PlusCircle size={20} className="text-emerald-600" /> افزودن کاربر جدید
                        </h3>
                        <div className="space-y-4">
                          <input placeholder="نام و نام خانوادگی کامل" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black shadow-inner" />
                          <div className="grid grid-cols-2 gap-4">
                              <input placeholder="Username" value={newUser.user} onChange={e=>setNewUser({...newUser, user: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black dir-ltr shadow-inner focus:bg-white transition-colors" />
                              <input type="password" placeholder="Password" value={newUser.pass} onChange={e=>setNewUser({...newUser, pass: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black dir-ltr shadow-inner focus:bg-white transition-colors" />
                          </div>
                          <select value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as 'user' | 'admin'})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black shadow-inner appearance-none cursor-pointer">
                              <option value="user">مامور قرائت (User)</option>
                              <option value="admin">مدیر سیستم (Admin)</option>
                          </select>
                          <Button onClick={()=>{
                            if(!newUser.user || !newUser.name) return alert('لطفاً تمامی فیلدها را پر کنید.');
                            onAddUser({id:crypto.randomUUID(), fullName: newUser.name, username: newUser.user, password: newUser.pass, role: newUser.role});
                            setNewUser({name:'',user:'',pass:'',role:'user'});
                          }} fullWidth className="py-4 text-base rounded-2xl shadow-emerald-50">ایجاد کاربر در سیستم</Button>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-[2rem] border border-slate-100 divide-y divide-slate-50 shadow-sm overflow-hidden">
                        {state.users.map((u:User)=>(
                          <div key={u.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="bg-slate-100 p-2.5 rounded-xl text-slate-500 uppercase font-black text-[10px] tracking-widest ring-1 ring-slate-200">{u.role}</div>
                              <div>
                                <p className="text-sm font-black text-slate-800">{u.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-bold">@{u.username}</p>
                              </div>
                            </div>
                            <button onClick={()=>confirm('آیا کاربر حذف شود؟') && onDeleteUser(u.id)} className="text-slate-300 hover:text-red-500 transition-all p-3 active:scale-90"><Trash2 size={20}/></button>
                          </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'assign' && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-3 px-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">انتخاب مامور قرائت</label>
                      <select value={targetUser} onChange={e=>setTargetUser(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none ring-offset-2 focus:ring-2 focus:ring-emerald-500 shadow-inner appearance-none">
                        <option value="">جستجوی مامور...</option>
                        {state.users.filter((u:User)=>u.role!=='admin').map((u:User)=><option key={u.id} value={u.username}>{u.fullName} (@{u.username})</option>)}
                      </select>
                    </div>

                    {targetUser && (
                        <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                            <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mr-2 flex items-center gap-2">
                              <CheckCircle2 size={16} /> صنایع مجاز برای مامور
                            </label>
                            <div className="max-h-96 overflow-y-auto border border-slate-50 rounded-[2rem] p-3 bg-slate-50 space-y-3 no-scrollbar shadow-inner">
                                {state.industries.map((i:Industry)=>(
                                    <label key={i.id} className={`flex gap-4 p-5 bg-white rounded-2xl items-center cursor-pointer transition-all border-2 ${selIds.has(i.id) ? 'border-emerald-500 shadow-lg shadow-emerald-50 scale-[1.02]' : 'border-transparent opacity-70 hover:opacity-100 hover:border-slate-200'}`}>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selIds.has(i.id) ? 'bg-emerald-500 border-emerald-500 shadow-inner' : 'border-slate-200 bg-slate-50'}`}>
                                          {selIds.has(i.id) && <CheckCircle2 size={16} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={selIds.has(i.id)} onChange={()=>{
                                          const s=new Set(selIds); if(s.has(i.id)) s.delete(i.id); else s.add(i.id); setSelIds(s);
                                        }}/>
                                        <div className="flex-1">
                                            <div className="text-sm font-black text-slate-800">{i.name}</div>
                                            <div className="text-[10px] text-slate-400 font-black tracking-tight mt-1">شناسه اشتراک: {i.subscriptionId}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <Button onClick={()=>{
                              onAssignIndustries(targetUser, state.industries.filter((i:Industry)=>selIds.has(i.id)));
                              alert(`دسترسی‌های ${targetUser} با موفقیت در دیتابیس ابری ثبت شد.`);
                            }} fullWidth className="py-5 text-base font-black rounded-3xl shadow-emerald-100">بروزرسانی نهایی دسترسی‌ها</Button>
                        </div>
                    )}
                    {!targetUser && (
                      <div className="text-center py-16 text-slate-300">
                        <div className="bg-slate-50 inline-flex p-6 rounded-full mb-4 shadow-inner opacity-40"><Info size={48} /></div>
                        <p className="text-sm font-black text-slate-400">ابتدا یک مامور قرائت را از لیست بالا انتخاب کنید</p>
                      </div>
                    )}
                </div>
            )}
        </div>
    );
};
