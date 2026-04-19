import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Trophy, Target, CheckCircle2, Circle, TrendingUp, Calendar, Sword, Shield, Zap, Save, Loader2, Sparkles, MessageSquare, ChevronDown, ChevronUp, BookOpen, Home, Sun, Gift, IceCream, Tv, Coffee
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rpg-prod-app';

// --- CONFIGURAÇÃO GEMINI API ---
const apiKey = ""; 

const QUEST_TREE = [
  { 
    id: 'm_higiene', 
    name: 'Despertar do Herói', 
    icon: <Sun className="w-5 h-5 text-yellow-500" />,
    subs: [
      { id: 'h_rosto', name: 'Lavar o rosto e dentes 🪥', xp: 10 }
    ]
  },
  { 
    id: 'm_fisico', 
    name: 'Treino de Atributos', 
    icon: <Sword className="w-5 h-5 text-red-500" />,
    subs: [
      { id: 't_calistenia', name: 'Calistenia (Treino A/B) 🤸', xp: 30 },
      { id: 't_muay', name: 'Foco no Muay Thai 🥊', xp: 50 }
    ]
  },
  { 
    id: 'm_casa', 
    name: 'Guardião da Base', 
    icon: <Home className="w-5 h-5 text-blue-500" />,
    subs: [
      { id: 'h_arrumar', name: 'Arrumar a cama 🛌', xp: 5 },
      { id: 'c_louca', name: 'Lavar a louça 🍽️', xp: 15 },
      { id: 'c_lixo', name: 'Tirar o lixo 🗑️', xp: 10 }
    ]
  },
  { 
    id: 'm_escola', 
    name: 'Academia de Magia (Escola)', 
    icon: <BookOpen className="w-5 h-5 text-purple-500" />,
    subs: [
      { id: 'e_foco', name: 'Foco total nas aulas 🧠', xp: 40 },
      { id: 'e_notas', name: 'Anotar matéria importante 📝', xp: 40 }
    ]
  },
  { 
    id: 'm_skill', 
    name: 'Forja de Python', 
    icon: <Zap className="w-5 h-5 text-cyan-500" />,
    subs: [
      { id: 'p_revisar', name: 'Revisar o que os profs passaram 📖', xp: 30 },
      { id: 'p_python', name: 'Programar em Python 💻', xp: 40 }
    ]
  },
  { 
    id: 'm_org', 
    name: 'Inventário e Logística', 
    icon: <Shield className="w-5 h-5 text-green-500" />,
    subs: [
      { id: 'o_mochila', name: 'Arrumar mochila e uniforme 🎒', xp: 15 }
    ]
  }
];

const REWARDS = [
  { id: 'r1', name: 'Comer um Sorvete 🍦', level: 2, icon: <IceCream className="text-pink-400" /> },
  { id: 'r3', name: 'Assistir um Filme 🍿', level: 5, icon: <Tv className="text-red-400" /> },
  { id: 'r4', name: 'Lanche Especial 🍔', level: 7, icon: <Coffee className="text-yellow-600" /> },
  { id: 'r5', name: 'Dia de Descanso Total 💤', level: 10, icon: <Calendar className="text-blue-400" /> },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [history, setHistory] = useState({});
  const [todayData, setTodayData] = useState({ done: [], obs: "" });
  const [expanded, setExpanded] = useState({});
  const [aiAdvice, setAiAdvice] = useState("");
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const callGemini = async (prompt, systemInstruction = "") => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (e) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
    throw new Error("Erro.");
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
    const unsubscribe = onSnapshot(query(historyRef), (snapshot) => {
      const newHistory = {};
      snapshot.forEach(doc => { newHistory[doc.id] = doc.data(); });
      setHistory(newHistory);
      if (newHistory[todayStr]) setTodayData(newHistory[todayStr]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [user]);

  const totalXp = useMemo(() => {
    return Object.values(history).reduce((acc, curr) => acc + (curr.dailyXp || 0), 0);
  }, [history]);

  // --- LÓGICA DE NÍVEL DINÂMICA ---
  const getLevelInfo = (xp) => {
    let currentLvl = 1;
    let remainingXp = xp;
    let nextLevelThreshold = 500;

    while (remainingXp >= nextLevelThreshold) {
      remainingXp -= nextLevelThreshold;
      currentLvl++;
      nextLevelThreshold += 150; 
    }

    return {
      level: currentLvl,
      xpInCurrent: remainingXp,
      xpNeeded: nextLevelThreshold,
      progress: (remainingXp / nextLevelThreshold) * 100
    };
  };

  const lvlInfo = useMemo(() => getLevelInfo(totalXp), [totalXp]);

  const chartData = useMemo(() => {
    return Object.keys(history).sort().slice(-7).map(date => ({
      date: date.split('-').slice(1).reverse().join('/'),
      xp: history[date].dailyXp || 0
    }));
  }, [history]);

  const generateAdvice = async () => {
    setIsGeneratingAdvice(true);
    try {
      const prompt = `Status: Nível ${lvlInfo.level}, XP: ${totalXp}. O progresso hoje está em ${todayData.done.length} sub-tarefas. Mande uma mensagem curta.`;
      const system = "Você é o Rocky Balboa. Fala de um jeito motivador, duro e inspirador. Use gírias como 'Um round a mais', 'O mundo não é um mar de rosas'. Português do Brasil.";
      const response = await callGemini(prompt, system);
      setAiAdvice(response);
    } catch (err) { setAiAdvice("Levanta desse sofá e luta! Um round a mais!"); }
    finally { setIsGeneratingAdvice(false); }
  };

  const handleToggleSub = async (subId) => {
    if (!user) return;
    let newDone = [...todayData.done];
    if (newDone.includes(subId)) {
      newDone = newDone.filter(id => id !== subId);
    } else {
      newDone.push(subId);
    }
    let dailyXp = 0;
    QUEST_TREE.forEach(main => {
      main.subs.forEach(sub => {
        if (newDone.includes(sub.id)) dailyXp += sub.xp;
      });
    });
    const updatedData = { ...todayData, done: newDone, dailyXp };
    setTodayData(updatedData);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'history', todayStr), updatedData);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER DAVI MIRANDA */}
        <header className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <span className="text-2xl font-black italic">L{lvlInfo.level}</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-black tracking-tight uppercase">DAVI MIRANDA</h1>
              <div className="flex items-center justify-center md:justify-start gap-3 mt-1 text-zinc-500 font-bold text-xs uppercase">
                <Trophy className="w-4 h-4 text-yellow-500" /> {totalXp} XP ACUMULADO
              </div>
            </div>
            <div className="w-full md:w-64">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 mb-1 uppercase">
                <span>XP Progress</span>
                <span>{Math.floor(lvlInfo.xpInCurrent)}/{lvlInfo.xpNeeded}</span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full border border-zinc-700 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${lvlInfo.progress}%` }} />
              </div>
            </div>
          </div>
        </header>

        {/* AI MENTOR (ROCKY) */}
        <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-black uppercase text-blue-400">Dica do Rocky ✨</span>
            </div>
            <p className="text-sm italic text-zinc-300">
              {aiAdvice || "Ei, você! Quer saber o que eu acho? Clica no botão ali e ouve o que eu tenho pra dizer."}
            </p>
          </div>
          <button 
            onClick={generateAdvice}
            disabled={isGeneratingAdvice}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-6 rounded-xl transition-all border border-zinc-700 flex items-center gap-2 text-xs"
          >
            {isGeneratingAdvice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-500" />}
            OUVIR O MESTRE
          </button>
        </div>

        {/* TABS */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'tasks' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>Missões</button>
          <button onClick={() => setActiveTab('rewards')} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'rewards' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>Recompensas</button>
          <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>Status</button>
        </div>

        {activeTab === 'tasks' ? (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              {QUEST_TREE.map(main => {
                const completedSubs = main.subs.filter(s => todayData.done.includes(s.id)).length;
                const totalSubs = main.subs.length;
                const isFullComplete = completedSubs === totalSubs;

                return (
                  <div key={main.id} className={`border rounded-xl transition-all overflow-hidden ${isFullComplete ? 'border-green-500/50 bg-green-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div 
                      onClick={() => setExpanded(prev => ({...prev, [main.id]: !prev[main.id]}))}
                      className="p-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isFullComplete ? 'bg-green-500' : 'bg-zinc-800'}`}>
                          {isFullComplete ? <CheckCircle2 className="text-white w-6 h-6" /> : main.icon}
                        </div>
                        <div>
                          <h3 className={`font-bold text-sm ${isFullComplete ? 'text-green-500' : 'text-white'}`}>{main.name}</h3>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{completedSubs}/{totalSubs} COMPLETO</p>
                        </div>
                      </div>
                      {expanded[main.id] ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                    </div>

                    {expanded[main.id] && (
                      <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        {main.subs.map(sub => {
                          const done = todayData.done.includes(sub.id);
                          return (
                            <div 
                              key={sub.id}
                              onClick={() => handleToggleSub(sub.id)}
                              className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${done ? 'bg-zinc-800/50 border-zinc-700/50 opacity-60' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'}`}
                            >
                              <div className="flex items-center gap-3">
                                {done ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-zinc-600" />}
                                <span className={`text-xs font-medium ${done ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>{sub.name}</span>
                              </div>
                              <span className="text-[9px] font-black text-blue-400">+{sub.xp} XP</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Save className="w-3 h-3" /> Diário de Bordo</h2>
              <textarea 
                value={todayData.obs}
                onChange={(e) => {
                  const val = e.target.value;
                  setTodayData(p => ({...p, obs: val}));
                  setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'history', todayStr), {...todayData, obs: val});
                }}
                className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                placeholder="Anote suas conquistas aqui..."
              />
            </div>
          </div>
        ) : activeTab === 'rewards' ? (
          /* ABA DE RECOMPENSAS */
          <div className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-500">
            {REWARDS.map(reward => {
              const unlocked = lvlInfo.level >= reward.level;
              return (
                <div 
                  key={reward.id} 
                  className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-5 ${unlocked ? 'border-yellow-500/40 bg-zinc-900 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-zinc-800 bg-zinc-900 opacity-50'}`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-zinc-800 border-2 ${unlocked ? 'border-yellow-500' : 'border-zinc-700'}`}>
                    {reward.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-black uppercase text-sm ${unlocked ? 'text-white' : 'text-zinc-600'}`}>{reward.name}</h3>
                    <p className="text-[10px] font-bold text-zinc-500 mt-1">
                      {unlocked ? 'RECOMPENSA DISPONÍVEL! 🔓' : `DESBLOQUEIA NO NÍVEL ${reward.level} 🔒`}
                    </p>
                  </div>
                  {unlocked && <Gift className="w-5 h-5 text-yellow-500 animate-bounce" />}
                </div>
              );
            })}
          </div>
        ) : (
          /* ABA DE STATUS */
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 animate-in fade-in duration-500">
            <h3 className="text-sm font-black uppercase mb-6 flex items-center gap-2 text-zinc-400"><TrendingUp className="text-blue-500 w-4 h-4" /> Evolução de XP</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="date" stroke="#444" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#444" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                  <Line type="monotone" dataKey="xp" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
