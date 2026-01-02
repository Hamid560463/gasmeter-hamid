
import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, PlusCircle, History, Settings, Camera, AlertTriangle, CheckCircle2, 
  Factory, Gauge, Trash2, AlertOctagon, Info, ShieldCheck, 
  ArrowRight, LogOut, Globe, Database, Upload, TrendingUp, Search
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

// --- Prop Interfaces ---
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
      <div className="relative mb-8">
        <Globe size={64} className="animate-spin text-emerald-500 opacity-20 absolute -inset-2" />
        <Database size={64} className="animate-pulse-soft relative z-10" />
      </div>
      <h2 className="text-xl font-bold mb-2 text-white">در حال راه‌اندازی سامانه</h2>
      <p className="text-slate-400 text-sm">برقراری ارتباط امن با Vercel Postgres...</p>
    </div>
  );

  if (!state.currentUser) return <LoginView users={state.users} onLogin={handleLogin} />;

  const isAdmin = state.currentUser.role === 'admin';

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-50 shadow-2xl relative overflow-x-hidden">
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
                <span className="text-[10px] font-medium">{state.currentUser.fullName}</span>
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

      <nav className="fixed bottom-4 left-4 right-4 max-w-[calc(28rem-2rem)] mx-auto bg-white/90 backdrop-blur-lg border border-slate-200 rounded-2xl p-2.5 flex justify-around items-center z-40 shadow-xl">
        <NavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={Home} label="داشبورد" />
        <NavBtn active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={Camera} label="قرائت" isCenter />
        <NavBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="سوابق" />
        <NavBtn active={activeTab === 'admin' || activeTab === 'settings'} onClick={() => setActiveTab(isAdmin ? 'admin' : 'settings')} icon={isAdmin ? ShieldCheck : Settings} label={isAdmin ? 'مدیریت' : 'تنظیمات'} />
      </nav>
    </div>
  );
}

const NavBtn = ({ active, onClick, icon: Icon, label, isCenter }: NavBtnProps) => (
  <button onClick={onClick} className={`flex flex-col items-center transition-all ${isCenter ? '-mt-10' : ''}`}>
    <div className={`
      flex items-center justify-center p-3 rounded-2xl transition-all duration-300
      ${isCenter ? 'bg-emerald-600 shadow-lg shadow-emerald-200 text-white scale-125 hover:bg-emerald-700 active:scale-110' : 
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
    <div className="min-h-screen bg-white flex flex-col p-8 justify-center items-center">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex bg-emerald-100 p-4 rounded-3xl text-emerald-600 mb-2">
            <Gauge size={48} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">سامانه گاز صنایع</h1>
          <p className="text-slate-500 text-sm">لطفاً برای دسترسی به سامانه وارد شوید</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 mr-2">نام کاربری</label>
            <input type="text" value={user} onChange={e=>setUser(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-right dir-ltr" placeholder="Username" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 mr-2">رمز عبور</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-right dir-ltr" placeholder="••••••••" required />
          </div>
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : "ورود به حساب"}
          </Button>
        </form>

        {users.length === 0 && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <p className="text-xs text-blue-700 leading-relaxed">دیتابیس ابری در حال حاضر خالی است. برای ورود اولیه به عنوان مدیر سیستم:</p>
            <button onClick={() => onLogin({ id: 'init-admin', username: 'admin', password: '', fullName: 'مدیر کل', role: 'admin' })} className="mt-3 w-full bg-blue-600 text-white text-xs py-2.5 rounded-xl font-bold">ورود به پنل مدیریت</button>
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
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
            <TrendingUp size={24} />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold opacity-70 block">بروزرسانی</span>
            <span className="text-xs font-medium">{formatDate(Date.now())}</span>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-emerald-100 text-xs font-medium">صنایع تحت پوشش</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{formatNumber(industries.length)}</p>
          </div>
          <div className="text-left">
            <p className="text-emerald-100 text-xs font-medium">قرائت‌های کل</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{formatNumber(totalReadings)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Factory size={18} className="text-emerald-600" /> لیست واحدهای صنعتی
          </h3>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-bold uppercase tracking-wider">
            Active
          </span>
        </div>
        
        <div className="grid gap-4">
          {industries.map((ind: Industry) => {
            const lastReading = state.readings.find((r: Reading) => r.industryId === ind.id);
            const usagePercent = lastReading ? Math.min((lastReading.value / ind.allowedDailyConsumption) * 10, 100) : 0; // Simulated
            
            return (
              <div key={ind.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group active:scale-[0.98] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{ind.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Globe size={10} /> {ind.city}، {ind.address}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="bg-slate-50 text-slate-500 text-[9px] font-bold px-2 py-1 rounded-lg border border-slate-100">
                      {ind.subscriptionId}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end text-[10px] font-bold">
                    <span className="text-slate-500">وضعیت مصرف روزانه</span>
                    <span className={usagePercent > 80 ? 'text-red-500' : 'text-emerald-600'}>
                      {usagePercent.toFixed(0)}٪ مجاز
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${usagePercent}%` }} 
                    />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex gap-2 overflow-x-auto no-scrollbar">
                  {ind.meters.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 whitespace-nowrap">
                      <Gauge size={14} className="text-emerald-500" />
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {industries.length === 0 && (
            <div className="text-center py-16 px-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="bg-slate-200 inline-flex p-4 rounded-3xl text-slate-400 mb-4"><Info size={32} /></div>
              <p className="text-slate-500 font-bold">واحد صنعتی تخصیص نیافته است</p>
              <p className="text-slate-400 text-xs mt-1">با مدیر سیستم تماس بگیرید</p>
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
              alert("خطا در پردازش تصویر توسط هوش مصنوعی");
            } finally { 
              setLoadingAi(false); 
            }
        };
        r.readAsDataURL(f);
    };

    if(step === 1) return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Search size={20}/></div>
          <h3 className="font-bold text-slate-800">انتخاب کنتور جهت قرائت</h3>
        </div>
        {industries.map((i:Industry) => (
          <div key={i.id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-slate-50 text-[11px] font-black text-slate-500 border-b border-slate-100 tracking-wider uppercase">{i.name}</div>
            <div className="divide-y divide-slate-50">
              {i.meters.map((m:any) => (
                <button key={m.id} onClick={()=>{setSelIndId(i.id);setSelMeterId(m.id);setStep(2)}} className="w-full text-right p-4 hover:bg-emerald-50 text-sm font-bold flex gap-3 items-center transition-colors group">
                  <div className="bg-slate-100 p-2 rounded-xl text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all"><Gauge size={18}/></div>
                  <div className="flex-1">{m.name}</div>
                  <ArrowRight size={16} className="text-slate-300 rotate-180" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
    
    if(step === 2) return (
      <div className="space-y-6 animate-in zoom-in-95 duration-300">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800">قرائت کنتور: {selMeter?.name}</h3>
          <p className="text-[10px] text-slate-400">{selInd?.name}</p>
        </div>

        <div onClick={()=>!loadingAi && fileRef.current?.click()} className={`
          relative h-56 rounded-3xl flex items-center justify-center border-2 border-dashed transition-all overflow-hidden cursor-pointer
          ${preview ? 'border-transparent shadow-lg' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}
        `}>
          {preview ? <img src={preview} className="h-full w-full object-cover"/> : (
            <div className="text-center space-y-2">
              <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full inline-block mb-2 shadow-inner"><Camera size={32}/></div>
              <p className="text-xs font-bold text-slate-600">تصویر کنتور را بگیرید</p>
              <p className="text-[10px] text-slate-400">هوش مصنوعی عدد را استخراج می‌کند</p>
            </div>
          )}
          {loadingAi && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm text-white flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <Database size={16} className="absolute inset-0 m-auto text-emerald-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-emerald-400">هوش مصنوعی Gemini</p>
                <p className="text-[10px] opacity-70">در حال آنالیز تصویر...</p>
              </div>
            </div>
          )}
        </div>

        <input type="file" ref={fileRef} className="hidden" accept="image/*" capture="environment" onChange={handlePhoto}/>
        
        <div className="space-y-4">
          <div className="relative group">
            <input 
              type="number" 
              placeholder="0000.00" 
              value={val} 
              onChange={e=>setVal(e.target.value)} 
              className="w-full p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl text-center text-4xl dir-ltr font-black text-emerald-800 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
            />
            <div className="absolute top-2 right-4 text-[9px] font-black text-emerald-600/50 uppercase tracking-tighter">Reading Value (m³)</div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="secondary" onClick={()=>setStep(1)} className="flex-1 py-4">بازگشت</Button>
            <Button 
              onClick={() => {
                onSave({ id: crypto.randomUUID(), industryId: selIndId, meterId: selMeterId, timestamp: Date.now(), value: parseFloat(val), imageUrl: preview || undefined, isManual: !preview });
              }} 
              className="flex-2 py-4 shadow-emerald-200" 
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
    <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex justify-between items-center px-1">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><History size={20} className="text-emerald-600"/> سوابق قرائت</h2>
          <span className="text-[10px] font-bold text-slate-400">{formatNumber(state.readings.length)} رکورد</span>
        </div>
        
        <div className="space-y-3">
          {state.readings.map((r:Reading) => {
              const ind = state.industries.find(i => i.id === r.industryId);
              return (
                  <div key={r.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                          <Gauge size={24} className="text-slate-400 group-hover:text-emerald-500" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 mb-0.5">{ind?.name || 'صنعت نامشخص'}</div>
                            <div className="font-black text-slate-800 text-xl flex items-center gap-2 tracking-tight">
                              {formatNumber(r.value)} 
                              <span className="text-[9px] text-slate-400 font-medium uppercase">m³</span>
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1">
                              <History size={10} /> {formatDate(r.timestamp)} <span className="mx-1">•</span> {r.recordedBy}
                            </div>
                        </div>
                      </div>
                      <button onClick={()=>onDelete(r.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={20}/>
                      </button>
                  </div>
              );
          })}
        </div>
        {state.readings.length === 0 && (
          <div className="text-center py-20 text-slate-300">
            <div className="mb-4 inline-block opacity-20"><History size={64}/></div>
            <p className="font-bold">سابقه‌ای ثبت نشده است</p>
          </div>
        )}
    </div>
);

const SettingsView = ({ state, onLogout, onGoAdmin }: SettingsViewProps) => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Settings size={22} className="text-emerald-600"/> تنظیمات کاربری</h2>
        
        {state.currentUser?.role === 'admin' && (
          <button onClick={onGoAdmin} className="w-full bg-slate-900 text-white p-5 rounded-3xl shadow-xl shadow-slate-200 flex justify-between items-center hover:bg-slate-800 transition-all group">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform"><ShieldCheck size={24}/></div>
              <div className="text-right">
                <p className="font-bold text-sm">پنل مدیریت سیستم</p>
                <p className="text-[10px] text-slate-400">تنظیمات دیتابیس، کاربران و تخصیص صنایع</p>
              </div>
            </div>
            <ArrowRight className="rotate-180 text-emerald-500" />
          </button>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-6 shadow-sm">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-50">
                <div className="bg-emerald-100 w-16 h-16 rounded-3xl flex items-center justify-center text-emerald-600 shadow-inner">
                  <UserIcon size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{state.currentUser?.fullName}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{state.currentUser?.username}</span>
                      <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{state.currentUser?.role}</span>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">حساب کاربری</h4>
              <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <div className="bg-slate-100 p-2 rounded-xl"><Info size={16}/></div>
                  راهنمای کاربری
                </div>
                <ArrowRight size={16} className="text-slate-300 rotate-180"/>
              </button>
              <Button variant="danger" fullWidth onClick={onLogout} className="py-4">خروج از حساب</Button>
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
                name: r['IndustryName']||r['نام صنعت']||'صنعت', 
                subscriptionId: id, 
                city: r['City'] || '', 
                address: r['Address'] || '', 
                meters: [{id:`M-${id}`, name: r['MeterName']||r['نام کنتور']||'کنتور اصلی', serialNumber: id}],
                allowedDailyConsumption: Number(r['Limit'] || 5000)
            });
        });
        if(industries.length) onUpdateIndustries(industries);
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex bg-slate-100 rounded-2xl p-1.5 shadow-inner">
                {['db', 'users', 'assign'].map(t => (
                  <button key={t} onClick={()=>setTab(t)} className={`
                    flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all rounded-xl
                    ${tab===t?'bg-white text-emerald-700 shadow-sm shadow-slate-200':'text-slate-400'}
                  `}>
                    {{db:'دیتا',users:'کاربران',assign:'تخصیص'}[t]}
                  </button>
                ))}
            </div>

            {tab === 'db' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-400/20 p-2 rounded-xl text-emerald-300"><Database size={20}/></div>
                          <h3 className="font-bold text-sm">مدیریت صنایع Vercel Postgres</h3>
                        </div>
                        <p className="text-[10px] opacity-70 leading-relaxed">برای ثبت دسته‌جمعی صنایع، فایل اکسل را با ستون‌های شناسه اشتراک، نام صنعت و محدودیت مصرف بارگذاری کنید.</p>
                        <input type="file" ref={fileRef} onChange={handleExcel} className="hidden" accept=".xlsx, .xls"/>
                        <Button onClick={()=>fileRef.current?.click()} fullWidth className="bg-emerald-500 hover:bg-emerald-400 shadow-none py-4"><Upload size={18}/> آپلود فایل اکسل صنایع</Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] font-bold text-slate-400 mb-1">صنایع ثبت شده</p>
                        <p className="text-3xl font-black text-emerald-600 tracking-tight">{formatNumber(state.industries.length)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] font-bold text-slate-400 mb-1">کل قرائت‌ها</p>
                        <p className="text-3xl font-black text-emerald-600 tracking-tight">{formatNumber(state.readings.length)}</p>
                      </div>
                    </div>
                </div>
            )}

            {tab === 'users' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-800 text-sm">تعریف کاربر جدید</h3>
                        <div className="space-y-3">
                          <input placeholder="نام و نام خانوادگی" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold" />
                          <div className="grid grid-cols-2 gap-3">
                              <input placeholder="نام کاربری" value={newUser.user} onChange={e=>setNewUser({...newUser, user: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold dir-ltr" />
                              <input type="password" placeholder="رمز عبور" value={newUser.pass} onChange={e=>setNewUser({...newUser, pass: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold dir-ltr" />
                          </div>
                          <select value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as 'user' | 'admin'})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold">
                              <option value="user">مامور قرائت (User)</option>
                              <option value="admin">مدیر سیستم (Admin)</option>
                          </select>
                          <Button onClick={()=>{
                            if(!newUser.user) return;
                            onAddUser({id:crypto.randomUUID(), fullName: newUser.name, username: newUser.user, password: newUser.pass, role: newUser.role});
                            setNewUser({name:'',user:'',pass:'',role:'user'});
                          }} fullWidth className="py-3">افزودن به سامانه</Button>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-50 shadow-sm overflow-hidden">
                        {state.users.map((u:User)=>(
                          <div key={u.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="bg-slate-100 p-2 rounded-xl text-slate-500 uppercase font-black text-[9px]">{u.role}</div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{u.fullName}</p>
                                <p className="text-[9px] text-slate-400 font-medium">@{u.username}</p>
                              </div>
                            </div>
                            <button onClick={()=>onDeleteUser(u.id)} className="text-slate-300 hover:text-red-500 transition-all p-2"><Trash2 size={18}/></button>
                          </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'assign' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">انتخاب مامور</label>
                      <select value={targetUser} onChange={e=>setTargetUser(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-emerald-500">
                        <option value="">لیست پرسنل...</option>
                        {state.users.filter((u:User)=>u.role!=='admin').map((u:User)=><option key={u.id} value={u.username}>{u.fullName} (@{u.username})</option>)}
                      </select>
                    </div>

                    {targetUser && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mr-2">تخصیص صنایع مجاز</label>
                            <div className="max-h-80 overflow-y-auto border border-slate-50 rounded-2xl p-2 bg-slate-50 space-y-2 no-scrollbar">
                                {state.industries.map((i:Industry)=>(
                                    <label key={i.id} className={`flex gap-3 p-4 bg-white rounded-2xl items-center cursor-pointer transition-all border-2 ${selIds.has(i.id) ? 'border-emerald-500 shadow-md shadow-emerald-50' : 'border-transparent'}`}>
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selIds.has(i.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                                          {selIds.has(i.id) && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={selIds.has(i.id)} onChange={()=>{
                                          const s=new Set(selIds); if(s.has(i.id)) s.delete(i.id); else s.add(i.id); setSelIds(s);
                                        }}/>
                                        <div className="flex-1">
                                            <div className="text-xs font-black text-slate-800">{i.name}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">اشتراک: {i.subscriptionId}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <Button onClick={()=>{
                              onAssignIndustries(targetUser, state.industries.filter((i:Industry)=>selIds.has(i.id)));
                              alert('تغییرات با موفقیت در دیتابیس ابری ثبت شد');
                            }} fullWidth className="py-4 shadow-emerald-100">بروزرسانی دسترسی‌ها</Button>
                        </div>
                    )}
                    {!targetUser && (
                      <div className="text-center py-12 text-slate-300">
                        <Info size={40} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs font-bold">لطفاً ابتدا یک مامور انتخاب کنید</p>
                      </div>
                    )}
                </div>
            )}
        </div>
    );
};
