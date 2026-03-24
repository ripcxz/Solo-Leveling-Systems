/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, 
  Shield, 
  Zap, 
  Activity, 
  Brain, 
  Sword, 
  ScrollText, 
  Package, 
  Settings, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Minus,
  Trophy,
  Bell,
  X,
  LogIn,
  LogOut,
  Users,
  Search,
  Timer,
  AlertTriangle,
  Coins,
  Star,
  Mic,
  MicOff,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  FirebaseUser
} from './firebase';

// --- Types ---

interface Stats {
  strength: number;
  agility: number;
  sense: number;
  vitality: number;
  intelligence: number;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  completed: boolean;
  rewardMoney: number;
  duration: number;
}

interface DungeonTask {
  id: string;
  title: string;
  completed: boolean;
}

interface ActiveDungeon {
  id: string;
  title: string;
  difficulty: string;
  reward: number;
  tasks: DungeonTask[];
}

const DUNGEON_TASKS_POOL = [
  "الجري لمدة ساعة",
  "البطم 30 مرة",
  "تمرين الضغط 50 مرة",
  "تمرين القرفصاء 40 مرة",
  "تمارين البطن 100 مرة",
  "القفز بالحبل 5 دقائق",
  "تمرين العقلة 10 مرات",
  "تمرين البلانك لمدة دقيقتين",
  "المشي السريع 30 دقيقة",
  "تمرين الاندفاع 20 مرة لكل ساق",
  "تمرين تسلق الجبال 50 مرة",
  "تمرين بيربي 15 مرة",
  "تمرين رفع الساقين 30 مرة",
  "تمرين الجسر 40 مرة",
  "تمرين سوبرمان 20 مرة",
  "تمرين الغطس للصدر 15 مرة",
  "تمرين الدراجة الهوائية 50 مرة",
  "تمرين الركل الخلفي 30 مرة لكل ساق",
  "تمرين تمدد القطة 10 مرات",
  "تمرين الوقوف على قدم واحدة لمدة دقيقة لكل قدم"
];

interface PlayerData {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  level: number;
  xp: number;
  maxXp: number;
  hp: number;
  mp: number;
  money: number;
  bossKeys: number;
  healers: number;
  weapons: number;
  armors: number;
  manaPotions: number;
  doubleXpPotions: number;
  streak: number;
  stats: Stats;
  statPoints: number;
  friends: string[];
  lastLoginDate: string;
  titles: string[];
  activeTitle: string;
}

// --- Constants ---

const ALL_TITLES = ["زعيم الظل", "ملك الظلال", "قوه الظل", "الضعيف", "الميت"];
const INITIAL_TITLES = ["الضعيف", "الميت"];

const INITIAL_STATS: Stats = {
  strength: 10,
  agility: 10,
  sense: 10,
  vitality: 10,
  intelligence: 10,
};

const DAILY_QUESTS: Quest[] = [
  { id: 'q1', title: 'تمارين الضغط', description: 'تقوية الجزء العلوي من الجسم', target: 100, current: 0, unit: 'عدة', completed: false, rewardMoney: 5, duration: 15 },
  { id: 'q2', title: 'تمارين البطن', description: 'تدريب استقرار الجذع', target: 100, current: 0, unit: 'عدة', completed: false, rewardMoney: 5, duration: 30 },
  { id: 'q3', title: 'تمارين القرفصاء', description: 'قوة الجزء السفلي من الجسم', target: 100, current: 0, unit: 'عدة', completed: false, rewardMoney: 15, duration: 15 },
  { id: 'q4', title: 'الجري', description: 'التحمل والسرعة', target: 10, current: 0, unit: 'كم', completed: false, rewardMoney: 15, duration: 30 },
];

// --- Audio Utility ---
const playSystemSound = (type: 'click' | 'success' | 'fail' | 'levelUp' = 'click') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'click') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'fail') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'levelUp') {
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  } catch (e) {
    console.warn('Audio context not supported or blocked');
  }
};

// --- Components ---

const ProgressBar = ({ current, max, colorClass = "bg-system-blue", label }: { current: number, max: number, colorClass?: string, label?: string }) => {
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full space-y-1">
      {label && (
        <div className="flex justify-between text-[10px] font-orbitron text-white/60">
          <span>{label}</span>
          <span>{current} / {max}</span>
        </div>
      )}
      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full ${colorClass}`}
          style={{ boxShadow: `0 0 10px currentColor` }}
        />
      </div>
    </div>
  );
};

const StatItem = ({ label, value, icon: Icon, onAdd, onMinus, canEdit }: any) => (
  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 mb-2">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-500/20 rounded-md">
        <Icon size={18} className="text-blue-400" />
      </div>
      <div>
        <p className="text-xs text-white/50 uppercase font-cairo">{label}</p>
        <p className="text-lg font-bold font-orbitron">{value}</p>
      </div>
    </div>
    {canEdit && (
      <div className="flex gap-2">
        <button onClick={onMinus} className="p-1 hover:bg-white/10 rounded"><Minus size={16} /></button>
        <button onClick={onAdd} className="p-1 hover:bg-white/10 rounded text-blue-400"><Plus size={16} /></button>
      </div>
    )}
  </div>
);

const MysteriousQuestPopup = ({ onClose, timeLeft }: { onClose: () => void, timeLeft: number }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
    >
      <div className="hologram-panel-purple w-full max-w-sm rounded-3xl p-8 border-2 border-purple-500/50">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full border border-purple-400 flex items-center justify-center text-purple-400">?</div>
          <h2 className="text-2xl font-black font-cairo text-glow-purple">!مهمة غامضة ظهرت</h2>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-3xl font-bold font-cairo text-purple-400 mb-4 text-center">اساس الروتين</h3>
            <div className="space-y-2 text-white/80 font-cairo">
              <p className="flex items-center gap-2"><ScrollText size={16} /> :التفاصيل</p>
              <ul className="list-disc list-inside pr-4 space-y-1 text-sm">
                <li>تمرين ضغط 10</li>
                <li>تمرين بطن 10</li>
                <li>تمرين سكوات 10</li>
                <li>الجري لمسافة 1 كيلومترات</li>
              </ul>
            </div>
          </div>

          <div className="h-[1px] bg-purple-500/20" />

          <div className="grid grid-cols-2 gap-4 text-sm font-cairo">
            <div className="space-y-1">
              <p className="text-red-400 flex items-center gap-1"><Timer size={14} /> :ينتهي العرض خلال</p>
              <p className="font-orbitron text-lg">00:{formatTime(timeLeft)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-blue-400 flex items-center gap-1"><Activity size={14} /> :وقت الإنجاز</p>
              <p className="font-cairo text-lg">دقيقة 50</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-yellow-400 flex items-center gap-1"><Trophy size={14} /> :المكافآت</p>
            <div className="flex gap-4 font-orbitron">
              <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400" /> 250 XP</span>
              <span className="flex items-center gap-1"><Coins size={14} className="text-yellow-600" /> +60</span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-cairo">
            <p className="text-red-500 flex items-center gap-1"><AlertTriangle size={14} /> :العواقب</p>
            <ul className="pr-4 space-y-1 text-red-400/80">
              <li>الرفض: -20% من الصحة</li>
              <li>الفشل: -100 من الخبرة</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-green-600/20 text-green-400 border border-green-500/50 font-bold text-lg hover:bg-green-600/30 transition-all"
            >
              قبول
            </button>
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-red-600/20 text-red-400 border border-red-500/50 font-bold text-lg hover:bg-red-600/30 transition-all"
            >
              رفض
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LevelUpNotification = ({ level, onClose }: { level: number, onClose: () => void }) => (
  <motion.div 
    initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: 100, opacity: 0 }}
    className="fixed bottom-24 left-6 right-6 z-50"
  >
    <div className="hologram-panel p-4 rounded-xl border-2 border-blue-400 bg-blue-900/90 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-system-dark font-black font-orbitron">
          {level}
        </div>
        <div>
          <h4 className="font-black font-cairo text-blue-400">!ارتفع المستوى</h4>
          <p className="text-xs text-white/70 font-cairo">لقد وصلت إلى المستوى {level}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X size={20} /></button>
    </div>
  </motion.div>
);

const SystemAlertModal = ({ type, message, onClose, onStopMusic }: { type: 'message' | 'danger' | 'motivation', message?: string, onClose: () => void, onStopMusic?: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
  >
    <div className={`w-full max-w-sm rounded-3xl p-8 border-2 ${
      type === 'message' ? 'border-blue-500/50 hologram-panel' : 
      type === 'danger' ? 'border-red-500/50 hologram-panel-red' :
      'border-purple-500/50 hologram-panel-purple'
    }`}>
      <div className="flex items-center justify-center gap-2 mb-6">
        <AlertTriangle size={32} className={
          type === 'message' ? 'text-blue-400' : 
          type === 'danger' ? 'text-red-500' : 
          'text-purple-400'
        } />
        <h2 className={`text-2xl font-black font-cairo ${
          type === 'message' ? 'text-blue-400' : 
          type === 'danger' ? 'text-red-500' : 
          'text-purple-400'
        }`}>
          {type === 'message' ? '(تنبيه النظام)' : type === 'danger' ? 'تحذير النظام' : 'رسالة من (النظام)'}
        </h2>
      </div>

      <div className="text-center space-y-6">
        <p className="text-xl font-bold font-cairo text-white leading-relaxed">
          {type === 'message' ? 'لديك رساله مهمه' : 
           type === 'danger' ? 'مهمه اجباريه: يجب عليك التخلص من الاعداء' : 
           message}
        </p>

        <div className="space-y-3">
          {(type === 'danger' || type === 'motivation') && onStopMusic && (
            <button 
              onClick={onStopMusic}
              className="w-full py-3 rounded-xl font-bold text-sm font-cairo bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <MicOff size={18} />
              إيقاف الموسيقى
            </button>
          )}
          
          <button 
            onClick={onClose}
            className={`w-full py-4 rounded-xl font-bold text-lg font-cairo transition-all ${
              type === 'message' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/30' : 
              type === 'danger' ? 'bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600/30' :
              'bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600/30'
            }`}
          >
            {type === 'message' ? 'حسنا' : type === 'danger' ? 'فهمت' : 'استمرار'}
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

const VaultModal = ({ player, onClose }: { player: PlayerData, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
  >
    <div className="hologram-panel w-full max-w-sm rounded-3xl p-8 border-2 border-blue-500/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black font-cairo text-blue-400">الخزنة</h2>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X size={24} /></button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Sword size={32} className="text-blue-400" />
          <p className="text-xs text-white/50 font-cairo">الأسلحة</p>
          <p className="text-xl font-bold font-orbitron">{player.weapons || 0}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Shield size={32} className="text-purple-400" />
          <p className="text-xs text-white/50 font-cairo">الدروع</p>
          <p className="text-xl font-bold font-orbitron">{player.armors || 0}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Activity size={32} className="text-green-400" />
          <p className="text-xs text-white/50 font-cairo">العلاجات</p>
          <p className="text-xl font-bold font-orbitron">{player.healers || 0}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Zap size={32} className="text-cyan-400" />
          <p className="text-xs text-white/50 font-cairo">المانا</p>
          <p className="text-xl font-bold font-orbitron">{player.manaPotions || 0}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Star size={32} className="text-orange-400" />
          <p className="text-xs text-white/50 font-cairo">مضاعف XP</p>
          <p className="text-xl font-bold font-orbitron">{player.doubleXpPotions || 0}</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center gap-2">
          <Shield size={32} className="text-red-400" />
          <p className="text-xs text-white/50 font-cairo">مفاتيح</p>
          <p className="text-xl font-bold font-orbitron">{player.bossKeys || 0}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

const TitlesModal = ({ player, onClose, onSelect }: { player: PlayerData, onClose: () => void, onSelect: (title: string) => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
  >
    <div className="hologram-panel-purple w-full max-w-sm rounded-3xl p-8 border-2 border-purple-500/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black font-cairo text-purple-400">الألقاب الملكية</h2>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X size={24} /></button>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {ALL_TITLES.map((title) => {
          const isUnlocked = player.titles?.includes(title);
          const isActive = player.activeTitle === title;
          
          return (
            <div 
              key={title}
              onClick={() => isUnlocked && onSelect(title)}
              className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                isActive ? 'bg-purple-500/20 border-purple-400' : 
                isUnlocked ? 'bg-white/5 border-white/10 hover:border-purple-400/30 cursor-pointer' : 
                'bg-black/40 border-white/5 opacity-40 grayscale cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <Trophy size={18} className={isActive ? 'text-purple-400' : 'text-white/20'} />
                <span className={`font-bold font-cairo ${isActive ? 'text-purple-400' : 'text-white/80'}`}>
                  {title}
                </span>
              </div>
              {!isUnlocked && <span className="text-[10px] font-cairo text-white/40">غير مفتوح</span>}
              {isActive && <CheckCircle2 size={16} className="text-purple-400" />}
            </div>
          );
        })}
      </div>
      
      <p className="mt-6 text-[10px] text-center text-white/40 font-cairo">
        يتم فتح الألقاب من خلال الإنجازات والمهمات الخاصة
      </p>
    </div>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'quests' | 'social' | 'shop' | 'dungeons'>('status');
  const [showMysteriousQuest, setShowMysteriousQuest] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showProfilePicInput, setShowProfilePicInput] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newProfilePic, setNewProfilePic] = useState('');
  const [levelUpNotify, setLevelUpNotify] = useState<number | null>(null);
  const [systemAlert, setSystemAlert] = useState<'message' | 'danger' | 'motivation' | null>(null);
  const [motivationMsg, setMotivationMsg] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [socialTab, setSocialTab] = useState<'friends' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [questTimer, setQuestTimer] = useState(24 * 60 * 60); // 24 hours global timer
  const [mysteriousTimer, setMysteriousTimer] = useState(15 * 60); // 15 minutes for mysterious quest
  const [acceptedQuests, setAcceptedQuests] = useState<Record<string, { timeLeft: number, totalTime: number, active: boolean, finished: boolean }>>({});
  const [boxReward, setBoxReward] = useState<string | null>(null);
  const [activeDungeon, setActiveDungeon] = useState<ActiveDungeon | null>(null);
  const [showTitles, setShowTitles] = useState(false);

  const handleCloseMysteriousQuest = () => {
    setShowMysteriousQuest(false);
    localStorage.setItem('seenMysteriousQuest', 'true');
  };

  const enterDungeon = (dungeon: any) => {
    if (!player || player.bossKeys < parseInt(dungeon.cost)) return;
    
    playSystemSound('levelUp');
    
    let taskCount = 10;
    if (dungeon.difficulty === 'متوسط') taskCount = 20;
    if (dungeon.difficulty === 'صعب') taskCount = 50;

    const tasks: DungeonTask[] = [];
    for (let i = 0; i < taskCount; i++) {
      const randomTask = DUNGEON_TASKS_POOL[Math.floor(Math.random() * DUNGEON_TASKS_POOL.length)];
      tasks.push({
        id: `task-${i}-${Date.now()}`,
        title: `${randomTask} (#${i + 1})`,
        completed: false
      });
    }

    setActiveDungeon({
      id: dungeon.id,
      title: dungeon.title,
      difficulty: dungeon.difficulty,
      reward: parseInt(dungeon.reward),
      tasks
    });

    // Deduct key
    if (user) {
      updateDoc(doc(db, 'users', user.uid), {
        bossKeys: player.bossKeys - parseInt(dungeon.cost)
      });
    }
  };

  const toggleDungeonTask = (taskId: string) => {
    if (!activeDungeon) return;
    
    playSystemSound('click');
    const newTasks = activeDungeon.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    
    setActiveDungeon({ ...activeDungeon, tasks: newTasks });
  };

  const finishDungeon = async () => {
    if (!activeDungeon || !player || !user) return;
    
    const allCompleted = activeDungeon.tasks.every(t => t.completed);
    if (!allCompleted) {
      setSystemAlert('danger');
      setMotivationMsg('يجب إكمال جميع المهام للخروج من الديماس!');
      return;
    }

    playSystemSound('levelUp');
    
    const xpReward = activeDungeon.reward;
    let newXp = player.xp + xpReward;
    let newLevel = player.level;
    let newMaxXp = player.maxXp;

    while (newXp >= newMaxXp) {
      newXp -= newMaxXp;
      newLevel += 1;
      newMaxXp = Math.floor(newMaxXp * 1.2);
      setLevelUpNotify(newLevel);
    }

    await updateDoc(doc(db, 'users', user.uid), {
      xp: newXp,
      level: newLevel,
      maxXp: newMaxXp,
      money: player.streak > 0 ? player.money + 100 : player.money + 50
    });

    setActiveDungeon(null);
    setSystemAlert('motivation');
    setMotivationMsg(`تم تطهير الديماس بنجاح! حصلت على ${xpReward} XP`);
  };

  // --- Auth & Sync ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as PlayerData;
          const today = new Date().toDateString();
          const lastLogin = data.lastLoginDate;

          if (lastLogin !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            let newStreak = data.streak || 1;
            if (lastLogin === yesterdayStr) {
              newStreak += 1;
            } else {
              newStreak = 1;
            }

            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastLoginDate: today,
              streak: newStreak
            });
            setPlayer({ ...data, lastLoginDate: today, streak: newStreak });
          } else {
            setPlayer(data);
          }
          setNewDisplayName(data.displayName);
          setNewUsername(data.username || '');
        } else {
          const newPlayer: PlayerData = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'لاعب مجهول',
            username: firebaseUser.email?.split('@')[0] || `user_${Math.random().toString(36).substr(2, 5)}`,
            photoURL: firebaseUser.photoURL,
            level: 1,
            xp: 0,
            maxXp: 100,
            hp: 100,
            mp: 150,
            money: 500,
            bossKeys: 0,
            healers: 0,
            weapons: 0,
            armors: 0,
            manaPotions: 0,
            doubleXpPotions: 0,
            streak: 1,
            stats: INITIAL_STATS,
            statPoints: 0,
            friends: [],
            lastLoginDate: new Date().toDateString(),
            titles: INITIAL_TITLES,
            activeTitle: 'الضعيف',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newPlayer);
          setPlayer(newPlayer);
          setNewDisplayName(newPlayer.displayName);
          setNewUsername(newPlayer.username);
        }
        
        // Show mysterious quest only if not seen before
        if (!localStorage.getItem('seenMysteriousQuest')) {
          setShowMysteriousQuest(true);
        }
      } else {
        setPlayer(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const newData = doc.data() as PlayerData;
        if (player && newData.level > player.level) {
          setLevelUpNotify(newData.level);
        }
        setPlayer(newData);
      }
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!player) return;
    const fetchFriends = async () => {
      if (player.friends.length === 0) {
        setFriendsList([]);
        return;
      }
      const q = query(collection(db, 'users'), where('uid', 'in', player.friends));
      const querySnapshot = await getDocs(q);
      const friends = querySnapshot.docs.map(doc => doc.data());
      setFriendsList(friends);
    };
    fetchFriends();
  }, [player?.friends]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs
        .map(doc => doc.data())
        .filter(u => u.uid !== user?.uid);
      setSearchResults(results);
    };

    const timeoutId = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  // --- Timer ---

  useEffect(() => {
    const interval = setInterval(() => {
      setQuestTimer(prev => (prev > 0 ? prev - 1 : 24 * 60 * 60));
      setMysteriousTimer(prev => (prev > 0 ? prev - 1 : 0));
      
      setAcceptedQuests(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id].active && !next[id].finished && next[id].timeLeft > 0) {
            next[id].timeLeft -= 1;
            changed = true;
          } else if (next[id].active && !next[id].finished && next[id].timeLeft === 0) {
            next[id].finished = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatLongTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Actions ---

  const handleLogin = async () => {
    playSystemSound('click');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    playSystemSound('click');
    signOut(auth);
  };

  const buyBox = async () => {
    playSystemSound('click');
    if (!player || !user || player.money < 100) return;

    const rand = Math.random() * 100;
    let reward = "لا شيء";
    let update: any = { money: player.money - 100 };

    if (rand < 0.1) {
      reward = "سلاح أسطوري";
      update.weapons = player.weapons + 1;
    } else if (rand < 2.1) {
      reward = "400$";
      update.money = player.money - 100 + 400;
    } else if (rand < 11.1) {
      reward = "100$";
      update.money = player.money - 100 + 100;
    } else if (rand < 27.5) {
      reward = "مفتاح رئيس";
      update.bossKeys = player.bossKeys + 1;
    } else if (rand < 52.5) {
      reward = "هيلر (علاج)";
      update.healers = player.healers + 1;
    }

    await updateDoc(doc(db, 'users', user.uid), update);
    setBoxReward(reward);
    playSystemSound('success');
    setTimeout(() => setBoxReward(null), 3000);
  };

  const buyItem = async (item: string, price: number) => {
    playSystemSound('click');
    if (!player || !user || player.money < price) return;

    let update: any = { money: player.money - price };
    if (item === 'sword') update.weapons = player.weapons + 1;
    if (item === 'healer') update.healers = player.healers + 1;
    if (item === 'armor') update.armors = player.armors + 1;
    if (item === 'mana') update.manaPotions = player.manaPotions + 1;
    if (item === 'xp') update.doubleXpPotions = player.doubleXpPotions + 1;

    await updateDoc(doc(db, 'users', user.uid), update);
    playSystemSound('success');
  };

  const acceptQuest = (id: string, duration: number) => {
    playSystemSound('click');
    setAcceptedQuests(prev => ({
      ...prev,
      [id]: { timeLeft: duration * 60, totalTime: duration * 60, active: true, finished: false }
    }));
  };

  const rejectQuest = async (id: string) => {
    playSystemSound('click');
    if (player && user) {
      const newHp = Math.max(0, player.hp - 20);
      await updateDoc(doc(db, 'users', user.uid), { hp: newHp });
    }
    setAcceptedQuests(prev => ({
      ...prev,
      [id]: { timeLeft: 0, totalTime: 0, active: false, finished: false }
    }));
  };

  const finishQuest = async (id: string, success: boolean) => {
    if (!player || !user) return;
    const quest = DAILY_QUESTS.find(q => q.id === id);
    if (!quest) return;

    if (success) {
      playSystemSound('success');
      await addXp(100);
      const newHp = Math.min(100, player.hp + 5);
      await updateDoc(doc(db, 'users', user.uid), {
        money: player.money + quest.rewardMoney,
        hp: newHp
      });
    } else {
      playSystemSound('fail');
    }

    setAcceptedQuests(prev => ({
      ...prev,
      [id]: { ...prev[id], active: false, finished: false }
    }));
  };

  const updateProfilePic = async () => {
    if (!user || !newProfilePic) return;
    playSystemSound('click');
    await updateDoc(doc(db, 'users', user.uid), { photoURL: newProfilePic });
    setShowProfilePicInput(false);
    setNewProfilePic('');
  };

  const updateProfileInfo = async () => {
    if (!user || !newDisplayName || !newUsername) return;
    playSystemSound('click');
    
    // Simple validation for username
    const sanitizedUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    await updateDoc(doc(db, 'users', user.uid), { 
      displayName: newDisplayName,
      username: sanitizedUsername
    });
    setShowNameEdit(false);
  };

  const addXp = async (amount: number) => {
    if (!player || !user) return;
    let newXp = player.xp + amount;
    let newLevel = player.level;
    let newMaxXp = player.maxXp;
    let newStatPoints = player.statPoints;

    while (newXp >= newMaxXp) {
      newXp -= newMaxXp;
      newLevel += 1;
      newMaxXp = Math.floor(newMaxXp * 1.2);
      newStatPoints += 5;
      playSystemSound('levelUp');
    }

    await updateDoc(doc(db, 'users', user.uid), {
      xp: newXp,
      level: newLevel,
      maxXp: newMaxXp,
      statPoints: newStatPoints
    });
  };

  const updateStat = async (stat: keyof Stats, delta: number) => {
    playSystemSound('click');
    if (!player || !user) return;
    if (delta > 0 && player.statPoints <= 0) return;
    if (delta < 0 && player.stats[stat] <= 10) return;

    await updateDoc(doc(db, 'users', user.uid), {
      statPoints: player.statPoints - delta,
      [`stats.${stat}`]: player.stats[stat] + delta
    });
  };

  const addFriend = async (friendUid: string) => {
    playSystemSound('click');
    if (!user || !player) return;
    if (player.friends.includes(friendUid)) return;
    await updateDoc(doc(db, 'users', user.uid), {
      friends: arrayUnion(friendUid)
    });
  };

  // --- AI System Monitor ---
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dangerAudioRef = useRef<HTMLAudioElement | null>(null);
  const sadnessAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopDangerMusic = () => {
    if (dangerAudioRef.current) {
      dangerAudioRef.current.pause();
      dangerAudioRef.current.currentTime = 0;
    }
  };

  const stopSadnessMusic = () => {
    if (sadnessAudioRef.current) {
      sadnessAudioRef.current.pause();
      sadnessAudioRef.current.currentTime = 0;
    }
  };

  const toggleSystemMonitor = async () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  const startMonitoring = async () => {
    playSystemSound('click');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are the System Monitor. Listen to the user's environment. \n\n1. If you detect immediate danger, loud aggressive noises, or threats, output the text 'DANGER_DETECTED'.\n2. If you detect sadness, depression, or low mood, output the text 'SADNESS_DETECTED'.\n\nDO NOT SPEAK. DO NOT OUTPUT ANY AUDIO. ONLY OUTPUT THE TEXT KEYWORDS WHEN DETECTED. STAY SILENT OTHERWISE.",
        },
        callbacks: {
          onopen: () => {
            setIsMonitoring(true);
            const audioContext = new AudioContext({ sampleRate: 24000 });
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              session.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
              });
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: (message) => {
            const text = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
            if (text) {
              if (text.includes('DANGER_DETECTED')) {
                setSystemAlert('danger');
                if (!dangerAudioRef.current) {
                  dangerAudioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); 
                  dangerAudioRef.current.loop = true;
                }
                dangerAudioRef.current.play().catch(e => console.error("Audio play failed:", e));
              } else if (text.includes('SADNESS_DETECTED')) {
                const messages = [
                  "لا تنتظر أن يرفعك أحد… انهض وحدك واصنع مكانك. (arise).",
                  "الجبان يرى النهاية… أما المحارب فيرى البدايه",
                  "أنت لست نسخة الأمس… أنت مشروع قوة يتطور كل لحظه",
                  "الألم هو مجرد وقود لنموك… استمر في التقدم.",
                  "النظام يراقب إمكانياتك… لا تخذل نفسك.",
                  "كل جرح هو علامة على أنك نجوت… والآن حان وقت الهجوم."
                ];
                const randomMsg = messages[Math.floor(Math.random() * messages.length)];
                setMotivationMsg(randomMsg);
                setSystemAlert('motivation');
                if (!sadnessAudioRef.current) {
                  sadnessAudioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'); 
                  sadnessAudioRef.current.loop = true;
                }
                sadnessAudioRef.current.play().catch(e => console.error("Audio play failed:", e));
              }
            }
          },
          onclose: () => stopMonitoring(),
          onerror: (e) => {
            console.error('System Monitor error:', e);
            stopMonitoring();
          }
        }
      });
      sessionRef.current = session;
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const selectTitle = async (title: string) => {
    if (!user || !player) return;
    playSystemSound('success');
    await updateDoc(doc(db, 'users', user.uid), { activeTitle: title });
    setPlayer({ ...player, activeTitle: title });
    setShowTitles(false);
  };

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-system-dark">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-system-dark text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="w-32 h-32 mx-auto hologram-panel rounded-full flex items-center justify-center border-2 border-blue-400">
            <User size={64} className="text-blue-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black font-orbitron tracking-widest text-blue-400">SOLO LEVELING</h1>
            <p className="text-white/60 font-cairo">استيقظ كملك الظلال وابدأ رحلتك</p>
          </div>
          <button 
            onClick={handleLogin}
            className="system-button px-12 py-4 rounded-2xl flex items-center gap-3 text-xl font-bold font-cairo"
          >
            <LogIn size={24} />
            تسجيل الدخول بجوجل
          </button>
        </motion.div>
      </div>
    );
  }

  const renderStatus = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="hologram-panel p-6 rounded-3xl">
        <div className="flex items-center gap-4 mb-6">
          <div 
            className="w-20 h-20 rounded-full border-2 border-blue-400 p-1 bg-blue-900/30 overflow-hidden cursor-pointer hover:border-white transition-all"
            onClick={() => setShowProfilePicInput(!showProfilePicInput)}
          >
            {player?.photoURL ? (
              <img src={player.photoURL} alt="Profile" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <User size={40} className="text-blue-400 m-auto mt-4" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black font-cairo text-glow">{player?.displayName}</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowTitles(true)}
                  className="p-1 text-purple-400 hover:text-purple-300 transition-colors"
                  title="الألقاب"
                >
                  <Trophy size={18} />
                </button>
                <button 
                  onClick={() => setShowNameEdit(!showNameEdit)}
                  className="p-1 text-white/30 hover:text-blue-400 transition-colors"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
            <p className="text-xs text-blue-400 font-orbitron">@{player?.username}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="level-badge">LV. {player?.level}</span>
              <div className="flex items-center gap-1 text-orange-400 font-orbitron text-xs">
                <Star size={12} fill="currentColor" />
                <span>STREAK: {player?.streak}</span>
              </div>
              {player?.activeTitle && (
                <span className="text-xs text-purple-400 font-cairo uppercase tracking-widest">[{player.activeTitle}]</span>
              )}
            </div>
          </div>
        </div>

        {showNameEdit && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-6 space-y-3 overflow-hidden p-4 bg-white/5 rounded-2xl border border-white/10"
          >
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-cairo mr-2">الاسم المستعار</label>
              <input 
                type="text" 
                placeholder="الاسم الجديد..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs font-cairo focus:outline-none focus:border-blue-400/50"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-cairo mr-2">اسم المستخدم (للبحث)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-orbitron">@</span>
                <input 
                  type="text" 
                  placeholder="username..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-4 pr-8 text-xs font-orbitron focus:outline-none focus:border-blue-400/50"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={updateProfileInfo}
              className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold font-cairo"
            >
              حفظ التعديلات
            </button>
          </motion.div>
        )}

        {showProfilePicInput && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-6 space-y-2 overflow-hidden"
          >
            <input 
              type="text" 
              placeholder="رابط الصورة الجديد..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs font-cairo focus:outline-none focus:border-blue-400/50"
              value={newProfilePic}
              onChange={(e) => setNewProfilePic(e.target.value)}
            />
            <button 
              onClick={updateProfilePic}
              className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold font-cairo"
            >
              تحديث الصورة
            </button>
          </motion.div>
        )}

        <div className="space-y-4">
          <ProgressBar current={player?.hp || 0} max={100} colorClass="hp-bar-fill" label="الدم (HP)" />
          <ProgressBar current={player?.mp || 0} max={150} colorClass="mp-bar-fill" label="المانا (MP)" />
          <ProgressBar current={player?.xp || 0} max={player?.maxXp || 100} colorClass="bg-yellow-400" label="الخبرة (XP)" />
        </div>
        <div className="mt-6 flex justify-between items-center">
          <div className="flex gap-4 text-sm font-cairo text-white/70">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-yellow-500" />
              <span>{player?.money}$</span>
            </div>
          </div>
          <button 
            onClick={() => setShowVault(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/50 rounded-xl text-xs font-bold font-cairo hover:bg-purple-600/30 transition-all"
          >
            <Package size={16} />
            الخزنة
          </button>
        </div>
      </div>

      <div className="hologram-panel p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
            <Sword size={20} className="text-blue-400" />
            إحصائيات القدرة
          </h3>
          {player && player.statPoints > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 animate-pulse font-cairo">
              النقاط: {player.statPoints}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <StatItem label="القوة" value={player?.stats.strength} icon={Sword} onAdd={() => updateStat('strength', 1)} onMinus={() => updateStat('strength', -1)} canEdit={player && player.statPoints > 0} />
          <StatItem label="السرعة" value={player?.stats.agility} icon={Zap} onAdd={() => updateStat('agility', 1)} onMinus={() => updateStat('agility', -1)} canEdit={player && player.statPoints > 0} />
          <StatItem label="الحواس" value={player?.stats.sense} icon={Activity} onAdd={() => updateStat('sense', 1)} onMinus={() => updateStat('sense', -1)} canEdit={player && player.statPoints > 0} />
          <StatItem label="الحيوية" value={player?.stats.vitality} icon={Shield} onAdd={() => updateStat('vitality', 1)} onMinus={() => updateStat('vitality', -1)} canEdit={player && player.statPoints > 0} />
          <StatItem label="الذكاء" value={player?.stats.intelligence} icon={Brain} onAdd={() => updateStat('intelligence', 1)} onMinus={() => updateStat('intelligence', -1)} canEdit={player && player.statPoints > 0} />
        </div>
      </div>
    </motion.div>
  );

  const renderQuests = () => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="hologram-panel p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-cairo flex items-center gap-2 text-blue-400">
            <ScrollText size={24} />
            المهمات اليومية
          </h3>
          <div className="flex items-center gap-2 text-red-400 font-orbitron text-sm">
            <Timer size={16} />
            {formatLongTime(questTimer)}
          </div>
        </div>
        
        <div className="space-y-4">
          {DAILY_QUESTS.map((quest) => {
            const status = acceptedQuests[quest.id];
            const duration = quest.duration;

            return (
              <div 
                key={quest.id} 
                className={`quest-item p-4 rounded-xl transition-all border-r-2 border-blue-400/30`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold font-cairo text-sm tracking-wide">{quest.title}</h4>
                    <p className="text-xs text-white/60 mt-1 font-cairo">{quest.description}</p>
                    <p className="text-[10px] text-yellow-500 font-cairo mt-1">المكافأة: {quest.rewardMoney}$</p>
                  </div>
                  {status?.active && !status.finished ? (
                    <div className="text-red-400 font-orbitron text-xs flex items-center gap-1">
                      <Timer size={12} />
                      {Math.floor(status.timeLeft / 60)}:{(status.timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <Circle className="text-blue-400/30" size={20} />
                  )}
                </div>
                
                {status?.active && !status.finished ? (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-cairo mb-1">
                      <span className="text-white/40">الوقت المتبقي</span>
                      <span className="text-blue-400">{Math.floor(status.timeLeft / 60)}د</span>
                    </div>
                    <ProgressBar current={status.timeLeft} max={status.totalTime} colorClass="bg-red-500" />
                  </div>
                ) : status?.finished ? (
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => finishQuest(quest.id, true)}
                      className="flex-1 py-2 bg-green-500 text-white rounded-lg font-cairo font-bold shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                    >
                      نجحت
                    </button>
                    <button 
                      onClick={() => finishQuest(quest.id, false)}
                      className="flex-1 py-2 bg-red-500 text-white rounded-lg font-cairo font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    >
                      فشلت
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => acceptQuest(quest.id, duration)}
                      className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-cairo font-bold hover:bg-green-500/30"
                    >
                      قبول ({duration}د)
                    </button>
                    <button 
                      onClick={() => rejectQuest(quest.id)}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-cairo font-bold hover:bg-red-500/30"
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );

  const renderShop = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="hologram-panel p-6 rounded-3xl">
        <h3 className="text-xl font-bold font-cairo mb-6 flex items-center justify-center gap-2 text-yellow-400">
          <Package size={24} />
          المتجر الملكي
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {/* Mystery Box */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Package size={40} className="text-yellow-500" />
              <div>
                <h4 className="font-bold font-cairo text-sm">صندوق الكنز العشوائي</h4>
                <p className="text-[10px] text-white/40 font-cairo">جوائز نادرة وأسلحة</p>
              </div>
            </div>
            <button 
              onClick={buyBox}
              disabled={!player || player.money < 100}
              className="px-4 py-2 bg-yellow-600/20 text-yellow-400 border border-yellow-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              100$
            </button>
          </div>

          {/* Sword */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Sword size={40} className="text-blue-400" />
              <div>
                <h4 className="font-bold font-cairo text-sm">سيف الصياد</h4>
                <p className="text-[10px] text-white/40 font-cairo">يزيد القوة الهجومية</p>
              </div>
            </div>
            <button 
              onClick={() => buyItem('sword', 250)}
              disabled={!player || player.money < 250}
              className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              250$
            </button>
          </div>

          {/* Healer */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Activity size={40} className="text-green-400" />
              <div>
                <h4 className="font-bold font-cairo text-sm">جرعة شفاء</h4>
                <p className="text-[10px] text-white/40 font-cairo">تستعيد 50% من الصحة</p>
              </div>
            </div>
            <button 
              onClick={() => buyItem('healer', 50)}
              disabled={!player || player.money < 50}
              className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              50$
            </button>
          </div>

          {/* Armor */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Shield size={40} className="text-purple-400" />
              <div>
                <h4 className="font-bold font-cairo text-sm">درع الظلال</h4>
                <p className="text-[10px] text-white/40 font-cairo">يرفع الحد الأقصى للدم</p>
              </div>
            </div>
            <button 
              onClick={() => buyItem('armor', 400)}
              disabled={!player || player.money < 400}
              className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              400$
            </button>
          </div>

          {/* Mana Potion */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Zap size={40} className="text-cyan-400" />
              <div>
                <h4 className="font-bold font-cairo text-sm">مشروب المانا</h4>
                <p className="text-[10px] text-white/40 font-cairo">يستعيد الطاقة السحرية</p>
              </div>
            </div>
            <button 
              onClick={() => buyItem('mana', 75)}
              disabled={!player || player.money < 75}
              className="px-4 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              75$
            </button>
          </div>

          {/* Double XP */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <Star size={40} className="text-orange-400" />
              <div>
                <h4 className="font-bold font-cairo text-sm">مشروب الخبرة المضاعفة</h4>
                <p className="text-[10px] text-white/40 font-cairo">يضاعف الخبرة لمدة ساعة</p>
              </div>
            </div>
            <button 
              onClick={() => buyItem('xp', 500)}
              disabled={!player || player.money < 500}
              className="px-4 py-2 bg-orange-600/20 text-orange-400 border border-orange-500/50 rounded-lg text-xs font-bold font-cairo"
            >
              500$
            </button>
          </div>
        </div>

        <AnimatePresence>
          {boxReward && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl text-center"
            >
              <p className="text-sm font-cairo text-yellow-400">!لقد حصلت على</p>
              <p className="text-2xl font-black font-cairo text-white">{boxReward}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  const renderDungeons = () => {
    if (activeDungeon) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="hologram-panel p-6 rounded-3xl border-red-500/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold font-cairo flex items-center gap-2 text-red-500">
                <Shield size={24} />
                {activeDungeon.title}
              </h3>
              <span className="text-xs px-3 py-1 bg-red-500/20 rounded-full text-red-400 font-cairo">
                {activeDungeon.difficulty}
              </span>
            </div>

            <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/10 mb-6">
              <p className="text-sm font-cairo text-red-400/80 text-center">
                أكمل جميع المهام لتطهير الديماس والحصول على المكافأة
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-cairo mb-1">
                  <span className="text-white/40">التقدم</span>
                  <span className="text-red-400">
                    {activeDungeon.tasks.filter(t => t.completed).length} / {activeDungeon.tasks.length}
                  </span>
                </div>
                <ProgressBar 
                  current={activeDungeon.tasks.filter(t => t.completed).length} 
                  max={activeDungeon.tasks.length} 
                  colorClass="bg-red-500" 
                />
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {activeDungeon.tasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={() => toggleDungeonTask(task.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${task.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10 hover:border-red-500/30'}`}
                >
                  {task.completed ? (
                    <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                  ) : (
                    <Circle size={20} className="text-white/20 shrink-0" />
                  )}
                  <span className={`text-sm font-cairo ${task.completed ? 'text-green-400 line-through' : 'text-white/80'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>

            <button 
              onClick={finishDungeon}
              className="w-full mt-8 py-4 bg-red-600 text-white rounded-2xl font-cairo font-black text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all"
            >
              تطهير الديماس
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <div className="hologram-panel p-6 rounded-3xl">
          <h3 className="text-xl font-bold font-cairo mb-6 flex items-center gap-2 text-red-500">
            <Shield size={24} />
            البوابات (الديماس)
          </h3>

          <div className="space-y-4">
            {[
              { id: 'd1', title: 'بوابة الرتبة E', difficulty: 'سهل', reward: '500 XP', cost: '1 مفتاح' },
              { id: 'd2', title: 'بوابة الرتبة D', difficulty: 'متوسط', reward: '1200 XP', cost: '2 مفتاح' },
              { id: 'd3', title: 'بوابة الرتبة C', difficulty: 'صعب', reward: '3000 XP', cost: '5 مفتاح' },
            ].map((dungeon) => (
              <div key={dungeon.id} className="p-4 bg-red-900/10 border border-red-500/20 rounded-2xl group hover:border-red-500/50 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold font-cairo text-red-400">{dungeon.title}</h4>
                  <span className="text-[10px] px-2 py-1 bg-red-500/20 rounded text-red-400 font-cairo">{dungeon.difficulty}</span>
                </div>
                <p className="text-xs text-white/50 font-cairo mb-4">مهمة قتالية صعبة تتطلب مهارة عالية</p>
                <div className="flex justify-between items-center">
                  <div className="flex gap-3 text-[10px] font-cairo text-white/40">
                    <span className="flex items-center gap-1"><Trophy size={12} className="text-yellow-500" /> {dungeon.reward}</span>
                    <span className="flex items-center gap-1"><Shield size={12} className="text-blue-400" /> {dungeon.cost}</span>
                  </div>
                  <button 
                    onClick={() => enterDungeon(dungeon)}
                    disabled={!player || player.bossKeys < parseInt(dungeon.cost)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold font-cairo transition-all ${player && player.bossKeys >= parseInt(dungeon.cost) ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                  >
                    دخول
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSocial = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="hologram-panel p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold font-cairo flex items-center gap-2 text-blue-400">
            <Users size={24} />
            {socialTab === 'friends' ? 'أصدقائي' : 'البحث عن صيادين'}
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => { setSocialTab('friends'); playSystemSound('click'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-cairo transition-all ${socialTab === 'friends' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40'}`}
            >
              أصدقائي
            </button>
            <button 
              onClick={() => { setSocialTab('search'); playSystemSound('click'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-cairo transition-all ${socialTab === 'search' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40'}`}
            >
              البحث
            </button>
          </div>
        </div>

        {socialTab === 'search' && (
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input 
              type="text" 
              placeholder="البحث عن صيادين..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm font-cairo focus:outline-none focus:border-blue-400/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-3">
          {socialTab === 'friends' ? (
            friendsList.length > 0 ? (
              friendsList.map((friend) => (
                <div key={friend.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-blue-400/30">
                      <img src={friend.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="font-bold font-cairo text-sm">{friend.displayName}</p>
                      <p className="text-[10px] text-blue-400 font-orbitron">@{friend.username}</p>
                      <p className="text-[10px] text-white/40 font-orbitron">LV. {friend.level}</p>
                    </div>
                  </div>
                  <button className="p-2 text-white/40 hover:text-white"><ChevronRight size={20} className="rotate-180" /></button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-white/40 font-cairo">
                لا يوجد أصدقاء حالياً
              </div>
            )
          ) : (
            searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div key={result.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-blue-400/30">
                      <img src={result.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="font-bold font-cairo text-sm">{result.displayName}</p>
                      <p className="text-[10px] text-blue-400 font-orbitron">@{result.username}</p>
                      <p className="text-[10px] text-white/40 font-orbitron">LV. {result.level}</p>
                    </div>
                  </div>
                  {player?.friends.includes(result.uid) ? (
                    <span className="text-[10px] text-green-400 font-cairo px-2 py-1 bg-green-400/10 rounded">صديق</span>
                  ) : (
                    <button 
                      onClick={() => addFriend(result.uid)}
                      className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                    >
                      <UserPlus size={18} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-white/40 font-cairo">
                {searchQuery ? 'لا يوجد نتائج' : 'ابدأ البحث عن صيادين لإضافتهم'}
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto relative pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[100px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      {/* Header */}
      <header className="p-6 flex justify-between items-center sticky top-0 z-30 bg-system-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <h1 className="text-lg font-black font-orbitron tracking-widest text-blue-400">SYSTEM</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={toggleSystemMonitor} 
            className={`transition-colors ${isMonitoring ? 'text-blue-400' : 'text-white/30'}`}
            title={isMonitoring ? "مراقب النظام نشط" : "تفعيل مراقب النظام"}
          >
            {isMonitoring ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button onClick={handleLogout} className="text-white/50 hover:text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'status' && renderStatus()}
          {activeTab === 'quests' && renderQuests()}
          {activeTab === 'social' && renderSocial()}
          {activeTab === 'shop' && renderShop()}
          {activeTab === 'dungeons' && renderDungeons()}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 z-40">
        <div className="hologram-panel rounded-3xl flex justify-around items-center p-2 border-t-2 border-blue-400/50">
          <NavButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={User} label="الحالة" />
          <NavButton active={activeTab === 'quests'} onClick={() => setActiveTab('quests')} icon={ScrollText} label="المهمات" />
          <NavButton active={activeTab === 'dungeons'} onClick={() => setActiveTab('dungeons')} icon={Shield} label="البوابات" />
          <NavButton active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} icon={Package} label="المتجر" />
          <NavButton active={activeTab === 'social'} onClick={() => setActiveTab('social')} icon={Users} label="الأصدقاء" />
        </div>
      </nav>

      {/* Popups & Notifications */}
      <AnimatePresence>
        {showMysteriousQuest && (
          <MysteriousQuestPopup 
            timeLeft={mysteriousTimer} 
            onClose={handleCloseMysteriousQuest} 
          />
        )}
        {levelUpNotify && (
          <LevelUpNotification level={levelUpNotify} onClose={() => setLevelUpNotify(null)} />
        )}
        {showVault && player && (
          <VaultModal player={player} onClose={() => setShowVault(false)} />
        )}
        {showTitles && player && (
          <TitlesModal player={player} onClose={() => setShowTitles(false)} onSelect={selectTitle} />
        )}
        {systemAlert === 'message' && (
          <SystemAlertModal 
            type="message" 
            onClose={() => setSystemAlert('danger')} 
          />
        )}
        {systemAlert === 'danger' && (
          <SystemAlertModal 
            type="danger" 
            onClose={() => {
              setSystemAlert(null);
              stopDangerMusic();
            }} 
            onStopMusic={stopDangerMusic}
          />
        )}
        {systemAlert === 'motivation' && (
          <SystemAlertModal 
            type="motivation" 
            message={motivationMsg}
            onClose={() => {
              setSystemAlert(null);
              stopSadnessMusic();
            }} 
            onStopMusic={stopSadnessMusic}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-blue-400 scale-110' : 'text-white/40 hover:text-white/60'}`}
  >
    <Icon size={24} />
    <span className="text-[10px] font-cairo uppercase tracking-tighter">{label}</span>
    {active && (
      <motion.div 
        layoutId="nav-active"
        className="w-1 h-1 bg-blue-400 rounded-full mt-1 shadow-[0_0_5px_#00d2ff]"
      />
    )}
  </button>
);
