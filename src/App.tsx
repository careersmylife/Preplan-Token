import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Container as ContainerIcon, 
  Ticket, 
  Truck, 
  Plus, 
  Search, 
  Bell, 
  User, 
  LogOut, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Printer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  MoreVertical,
  Anchor,
  History,
  Scan,
  Calendar as CalendarIcon,
  AlertCircle,
  FileText,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, addHours, isBefore } from 'date-fns';
import { Container, Token, HistoryEntry, Notification, GateEvent } from './types';
import { MOCK_CONTAINERS, MOCK_TOKENS } from './constants';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'containers' | 'tokens' | 'gate'>('dashboard');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>(MOCK_TOKENS);
  const [gateActivity, setGateActivity] = useState<GateEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTokenForHistory, setSelectedTokenForHistory] = useState<Token | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManualGateModalOpen, setIsManualGateModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [statusUpdate, setStatusUpdate] = useState<{
    token: Token;
    newStatus: Token['status'];
  } | null>(null);
  const [tokenFilters, setTokenFilters] = useState({
    status: 'All',
    type: 'All',
    dateRange: { start: '', end: '' }
  });

  // Form state for new token
  const [newTokenForm, setNewTokenForm] = useState({
    containerNumber: '',
    truckPlate: '',
    driverName: '',
    appointmentTime: '',
    type: 'Export' as 'Import' | 'Export'
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Real-time validation
  useEffect(() => {
    const errors: Record<string, string> = {};
    if (newTokenForm.containerNumber && !/^[A-Z]{4}\d{7}$/.test(newTokenForm.containerNumber)) {
      errors.containerNumber = 'Invalid format (e.g. MSCU1234567)';
    }
    if (newTokenForm.appointmentTime) {
      const date = new Date(newTokenForm.appointmentTime);
      if (date < new Date()) {
        errors.appointmentTime = 'Appointment cannot be in the past';
      }
    }
    setFormErrors(errors);
  }, [newTokenForm]);

  // Gate Simulation: Randomly mark active tokens as Used
  useEffect(() => {
    const interval = setInterval(() => {
      const activeTokens = tokens.filter(t => t.status === 'Active');
      if (activeTokens.length > 0 && Math.random() > 0.8) {
        const randomToken = activeTokens[Math.floor(Math.random() * activeTokens.length)];
        updateTokenStatus(randomToken.id, 'Used', 'Automatic gate entry detected');
        
        const newNotification: Notification = {
          id: Math.random().toString(36).substring(7),
          type: 'success',
          message: `Gate Entry: Token ${randomToken.id} for ${randomToken.containerNumber} marked as Used.`,
          timestamp: new Date().toISOString(),
          read: false,
          tokenId: randomToken.id
        };
        setNotifications(prev => [newNotification, ...prev]);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [tokens]);

  // Expiry Warnings
  useEffect(() => {
    const checkExpiry = () => {
      const now = new Date();
      const warningThreshold = addHours(now, 1);
      
      tokens.forEach(t => {
        if (t.status === 'Active') {
          const apptTime = parseISO(t.appointmentTime);
          if (isBefore(apptTime, warningThreshold) && isBefore(now, apptTime)) {
            // Check if we already notified for this token
            const alreadyNotified = notifications.some(n => n.tokenId === t.id && n.type === 'warning');
            if (!alreadyNotified) {
              const newNotification: Notification = {
                id: Math.random().toString(36).substring(7),
                type: 'warning',
                message: `Expiry Warning: Token ${t.id} for ${t.containerNumber} expires in less than 1 hour.`,
                timestamp: new Date().toISOString(),
                read: false,
                tokenId: t.id
              };
              setNotifications(prev => [newNotification, ...prev]);
            }
          } else if (isBefore(apptTime, now)) {
            // Auto-expire
            updateTokenStatus(t.id, 'Expired', 'Token expired automatically');
          }
        }
      });
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    checkExpiry();

    return () => clearInterval(interval);
  }, [tokens, notifications]);

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(formErrors).length > 0) return;

    const id = `TKN-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    const now = new Date().toISOString();
    const expiryDate = addHours(parseISO(newTokenForm.appointmentTime), 24).toISOString();
    const token: Token = {
      id,
      ...newTokenForm,
      expiryDate,
      status: 'Active',
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`,
      history: [
        { status: 'Active', timestamp: now, user: 'Terminal Manager', note: 'Token generated' }
      ]
    };
    setTokens([token, ...tokens]);
    setIsTokenModalOpen(false);
    setNewTokenForm({
      containerNumber: '',
      truckPlate: '',
      driverName: '',
      appointmentTime: '',
      type: 'Export'
    });
  };

  const updateTokenStatus = (tokenId: string, newStatus: Token['status'], note?: string, gateId?: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    const historyEntry: HistoryEntry = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      user: 'Terminal Manager',
      note: note || `Status updated to ${newStatus}`,
      gateId
    };

    setTokens(prev => prev.map(t => {
      if (t.id === tokenId) {
        return { ...t, status: newStatus, history: [...t.history, historyEntry] };
      }
      return t;
    }));

    // Record gate activity and notification if used or cancelled
    if (newStatus === 'Used' || newStatus === 'Cancelled') {
      const gateEvent: GateEvent = {
        id: Math.random().toString(36).substring(7),
        tokenId: token.id,
        containerNumber: token.containerNumber,
        truckPlate: token.truckPlate,
        driverName: token.driverName,
        type: newStatus,
        timestamp: new Date().toISOString(),
        gateId: gateId || `GATE-${Math.floor(Math.random() * 5) + 1}`
      };
      setGateActivity(prevGate => [gateEvent, ...prevGate]);

      const newNotification: Notification = {
        id: Math.random().toString(36).substring(7),
        type: newStatus === 'Used' ? 'success' : 'warning',
        message: `${newStatus === 'Used' ? 'Gate Entry' : 'Token Cancelled'}: Token ${token.id} for ${token.containerNumber} marked as ${newStatus}.`,
        timestamp: new Date().toISOString(),
        read: false,
        tokenId: token.id
      };
      setNotifications(prev => [newNotification, ...prev]);
    }
  };

  const handleBulkAction = (action: 'Used' | 'Cancelled') => {
    selectedTokenIds.forEach(id => {
      updateTokenStatus(id, action, `Bulk action: ${action}`);
    });
    setSelectedTokenIds([]);
  };

  const filteredContainers = useMemo(() => {
    return MOCK_CONTAINERS.filter(c => 
      c.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.vessel?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      const matchesSearch = t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.containerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.truckPlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.driverName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = tokenFilters.status === 'All' || t.status === tokenFilters.status;
      const matchesType = tokenFilters.type === 'All' || t.type === tokenFilters.type;
      
      let matchesDate = true;
      if (tokenFilters.dateRange.start || tokenFilters.dateRange.end) {
        const tokenDate = parseISO(t.appointmentTime);
        const start = tokenFilters.dateRange.start ? startOfDay(parseISO(tokenFilters.dateRange.start)) : new Date(0);
        const end = tokenFilters.dateRange.end ? endOfDay(parseISO(tokenFilters.dateRange.end)) : new Date(8640000000000000);
        matchesDate = isWithinInterval(tokenDate, { start, end });
      }

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [tokens, searchQuery, tokenFilters]);

  const statusDistribution = useMemo(() => {
    const counts = tokens.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tokens]);

  const COLORS = {
    Active: '#3b82f6',
    Used: '#10b981',
    Expired: '#f59e0b',
    Cancelled: '#ef4444'
  };

  const simulateOcr = () => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      const mockOcrData = {
        containerNumber: 'DPWU' + Math.floor(1000000 + Math.random() * 9000000),
        truckPlate: 'DXB-' + ['A', 'B', 'C'][Math.floor(Math.random() * 3)] + '-' + Math.floor(10000 + Math.random() * 90000),
        driverName: ['Saeed Ahmed', 'Omar Khalid', 'Zaid Ali'][Math.floor(Math.random() * 3)],
        billOfLading: 'BL-' + Math.random().toString(36).substring(7).toUpperCase()
      };
      
      setNewTokenForm(prev => ({
        ...prev,
        containerNumber: mockOcrData.containerNumber,
        truckPlate: mockOcrData.truckPlate,
        driverName: mockOcrData.driverName
      }));
      
      setIsOcrProcessing(false);
      
      const newNotification: Notification = {
        id: Math.random().toString(36).substring(7),
        type: 'info',
        message: 'OCR Success: Extracted data from document.',
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [newNotification, ...prev]);
    }, 2000);
  };

  return (
    <div className="flex h-screen bg-[#f4f7f9]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#004b87] text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Anchor className="text-[#004b87]" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">DP WORLD</h1>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">Jebel Ali Terminal</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<ContainerIcon size={20} />} 
            label="Containers" 
            active={activeTab === 'containers'} 
            onClick={() => setActiveTab('containers')} 
          />
          <SidebarItem 
            icon={<Ticket size={20} />} 
            label="Pre-plan Tokens" 
            active={activeTab === 'tokens'} 
            onClick={() => setActiveTab('tokens')} 
          />
          <SidebarItem 
            icon={<Truck size={20} />} 
            label="Gate Activity" 
            active={activeTab === 'gate'}
            onClick={() => setActiveTab('gate')}
          />
        </nav>

        <div className="p-4 border-t border-blue-800/50">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-800/30 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Terminal Manager</p>
              <p className="text-xs text-blue-300 truncate">careers.mylife@gmail.com</p>
            </div>
            <LogOut size={16} className="text-blue-300" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search containers, tokens, or vessels..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors"
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">Notifications</h4>
                        <button 
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                          className="text-[10px] font-bold text-blue-600 uppercase hover:underline"
                        >
                          Mark all as read
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <BellRing size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-xs">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                              onClick={() => {
                                if (n.tokenId) {
                                  const token = tokens.find(t => t.id === n.tokenId);
                                  if (token) setSelectedTokenForHistory(token);
                                }
                                setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
                              }}
                            >
                              <div className="flex gap-3">
                                <div className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                                  n.type === 'warning' ? 'bg-amber-500' : 
                                  n.type === 'success' ? 'bg-emerald-500' : 
                                  'bg-blue-500'
                                }`} />
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                                  <p className="text-[10px] text-slate-400">{format(parseISO(n.timestamp), 'HH:mm')}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsTokenModalOpen(true)}
              className="flex items-center gap-2 bg-[#ff6a00] hover:bg-[#e65f00] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} />
              New Token
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Terminal Overview</h2>
                    <p className="text-slate-500">Real-time status of Jebel Ali Port operations</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Updated</p>
                    <p className="text-sm font-medium text-slate-600">March 26, 2026 - 05:23 UTC</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Total Containers" 
                    value="12,482" 
                    trend="+2.4%" 
                    trendUp={true} 
                    icon={<ContainerIcon className="text-blue-600" />} 
                  />
                  <StatCard 
                    title="Active Tokens" 
                    value={tokens.length.toString()} 
                    trend="+12" 
                    trendUp={true} 
                    icon={<Ticket className="text-orange-600" />} 
                  />
                  <StatCard 
                    title="Gate Activity" 
                    value="428" 
                    trend="-5.1%" 
                    trendUp={false} 
                    icon={<Truck className="text-emerald-600" />} 
                  />
                  <StatCard 
                    title="Yard Capacity" 
                    value="78%" 
                    trend="+1.2%" 
                    trendUp={true} 
                    icon={<LayoutDashboard className="text-purple-600" />} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Recent Gate Activity */}
                  <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800">Recent Gate Activity</h3>
                      <button 
                        onClick={() => setActiveTab('gate')}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View All <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Token ID</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Container</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event</th>
                            <th className="px-6 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gateActivity.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                                No recent gate activity recorded
                              </td>
                            </tr>
                          ) : (
                            gateActivity.slice(0, 5).map((event) => (
                              <tr key={event.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {format(parseISO(event.timestamp), 'HH:mm:ss')}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono font-bold text-blue-600">{event.tokenId}</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-bold text-slate-900">{event.containerNumber}</span>
                                    <span className="text-[10px] text-slate-500">{event.truckPlate}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    event.type === 'Used' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {event.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      const token = tokens.find(t => t.id === event.tokenId);
                                      if (token) setSelectedTokenForHistory(token);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <History size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Token Quick View */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800">Active Tokens</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {tokens.slice(0, 3).map((t) => (
                        <div key={t.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:border-blue-200 transition-all cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{t.type}</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">{t.id}</span>
                          </div>
                          <p className="font-mono font-bold text-slate-900 mb-1">{t.containerNumber}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Truck size={12} />
                            <span>{t.truckPlate}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                              <Clock size={12} />
                              {new Date(t.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <button className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Printer size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => setActiveTab('tokens')}
                        className="w-full py-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        View All Tokens
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'containers' && (
              <motion.div 
                key="containers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Container Inventory</h2>
                    <p className="text-slate-500">Manage and track all containers in the terminal</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                      <Filter size={18} />
                      Filter
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Container ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type & Size</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vessel Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Yard Location</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredContainers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-slate-900">{c.number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-700 font-medium">{c.size}</span>
                              <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">{c.type}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{c.vessel || '--'}</td>
                          <td className="px-6 py-4">
                            <span className={`status-badge ${
                              c.status === 'In Yard' ? 'bg-blue-100 text-blue-700' : 
                              c.status === 'Discharged' ? 'bg-emerald-100 text-emerald-700' :
                              c.status === 'At Sea' ? 'bg-slate-100 text-slate-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-mono">{c.location || 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredContainers.length === 0 && (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="text-slate-300" size={32} />
                      </div>
                      <h4 className="font-bold text-slate-900">No containers found</h4>
                      <p className="text-sm text-slate-500">Try adjusting your search query</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'tokens' && (
              <motion.div 
                key="tokens"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Pre-plan Tokens</h2>
                    <p className="text-slate-500">Manage gate entry tokens for trucks and drivers</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={simulateOcr}
                      disabled={isOcrProcessing}
                      className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                      <FileText size={18} className={isOcrProcessing ? 'animate-pulse' : ''} />
                      {isOcrProcessing ? 'Processing...' : 'OCR Scan'}
                    </button>
                    <button 
                      onClick={() => setIsScannerOpen(true)}
                      className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Scan size={18} />
                      Scan QR
                    </button>
                    <button 
                      onClick={() => setIsTokenModalOpen(true)}
                      className="flex items-center gap-2 bg-[#004b87] hover:bg-[#003a6a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                    >
                      <Plus size={18} />
                      Generate Token
                    </button>
                  </div>
                </div>

                {/* Status Overview Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-800">Token Status Distribution</h3>
                      <div className="flex gap-4">
                        {Object.entries(COLORS).map(([status, color]) => (
                          <div key={status} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusDistribution}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                          />
                          <RechartsTooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#cbd5e1'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusDistribution}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#cbd5e1'} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">Utilization Rate</h4>
                    <p className="text-3xl font-bold text-blue-600">
                      {Math.round((tokens.filter(t => t.status === 'Used').length / tokens.length) * 100) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Percentage of tokens successfully processed at gate</p>
                  </div>
                </div>

                {/* Filters & Bulk Actions */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase">Filters:</span>
                  </div>
                  
                  <select 
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={tokenFilters.status}
                    onChange={e => setTokenFilters({...tokenFilters, status: e.target.value})}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Used">Used</option>
                    <option value="Expired">Expired</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  <select 
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={tokenFilters.type}
                    onChange={e => setTokenFilters({...tokenFilters, type: e.target.value})}
                  >
                    <option value="All">All Types</option>
                    <option value="Import">Import</option>
                    <option value="Export">Export</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-slate-400" />
                    <input 
                      type="date" 
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={tokenFilters.dateRange.start}
                      onChange={e => setTokenFilters({...tokenFilters, dateRange: {...tokenFilters.dateRange, start: e.target.value}})}
                    />
                    <span className="text-slate-400">to</span>
                    <input 
                      type="date" 
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={tokenFilters.dateRange.end}
                      onChange={e => setTokenFilters({...tokenFilters, dateRange: {...tokenFilters.dateRange, end: e.target.value}})}
                    />
                  </div>

                  <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedTokenIds.length === filteredTokens.length && filteredTokens.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTokenIds(filteredTokens.map(t => t.id));
                          } else {
                            setSelectedTokenIds([]);
                          }
                        }}
                      />
                      <span className="text-xs font-bold text-slate-500 uppercase">Select All</span>
                    </div>

                    <div className="relative group">
                      <button 
                        disabled={selectedTokenIds.length === 0}
                        className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-all"
                      >
                        Bulk Actions ({selectedTokenIds.length})
                        <ChevronRight size={14} className="rotate-90" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 hidden group-hover:block">
                        <button 
                          onClick={() => handleBulkAction('Used')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                        >
                          <CheckCircle2 size={14} />
                          Mark as Used
                        </button>
                        <button 
                          onClick={() => handleBulkAction('Cancelled')}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-rose-600 flex items-center gap-2"
                        >
                          <XCircle size={14} />
                          Cancel Tokens
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setTokenFilters({ status: 'All', type: 'All', dateRange: { start: '', end: '' } });
                      setSelectedTokenIds([]);
                    }}
                    className="ml-auto text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredTokens.map((t) => (
                    <TokenCard 
                      key={t.id} 
                      token={t} 
                      isSelected={selectedTokenIds.includes(t.id)}
                      onSelect={(selected) => {
                        if (selected) {
                          setSelectedTokenIds([...selectedTokenIds, t.id]);
                        } else {
                          setSelectedTokenIds(selectedTokenIds.filter(id => id !== t.id));
                        }
                      }}
                      onUpdateStatus={(token, status) => setStatusUpdate({ token, newStatus: status })}
                      onViewHistory={() => setSelectedTokenForHistory(t)}
                    />
                  ))}
                </div>

                {filteredTokens.length === 0 && (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ticket className="text-slate-300" size={32} />
                    </div>
                    <h4 className="font-bold text-slate-900">No active tokens</h4>
                    <p className="text-sm text-slate-500 mb-6">Create a new pre-plan token to get started</p>
                    <button 
                      onClick={() => setIsTokenModalOpen(true)}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Create Token Now
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'gate' && (
              <motion.div 
                key="gate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gate Activity Log</h2>
                    <p className="text-slate-500">Real-time monitoring of terminal gate entries and cancellations</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsManualGateModalOpen(true)}
                      className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Plus size={18} />
                      Manual Log
                    </button>
                    <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Live System Connected</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Recent Gate Events</h3>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Events: {gateActivity.length}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gate ID</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Token ID</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Container</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Truck Plate</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gateActivity.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                              No gate activity recorded yet. Simulation running...
                            </td>
                          </tr>
                        ) : (
                          gateActivity.map((event) => (
                            <motion.tr 
                              key={event.id}
                              initial={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                              animate={{ backgroundColor: 'transparent' }}
                              transition={{ duration: 2 }}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                {format(parseISO(event.timestamp), 'HH:mm:ss')}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{event.gateId}</span>
                              </td>
                              <td className="px-6 py-4 text-xs font-mono font-bold text-blue-600">{event.tokenId}</td>
                              <td className="px-6 py-4 text-xs font-mono font-bold text-slate-900">{event.containerNumber}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700">{event.truckPlate}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  event.type === 'Used' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {event.type}
                                </span>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Token Creation Modal */}
      <AnimatePresence>
        {isTokenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTokenModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#004b87] text-white">
                <h3 className="text-xl font-bold">New Pre-plan Token</h3>
                <button onClick={() => setIsTokenModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateToken} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Container Number</label>
                    <div className="relative">
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. MSCU1234567"
                        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono transition-all ${
                          formErrors.containerNumber ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                        }`}
                        value={newTokenForm.containerNumber}
                        onChange={e => setNewTokenForm({...newTokenForm, containerNumber: e.target.value.toUpperCase()})}
                      />
                      {formErrors.containerNumber && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 flex items-center gap-1">
                          <AlertCircle size={16} />
                          <span className="text-[10px] font-bold">{formErrors.containerNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Truck Plate</label>
                    <input 
                      required
                      type="text" 
                      placeholder="DXB-A-12345"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={newTokenForm.truckPlate}
                      onChange={e => setNewTokenForm({...newTokenForm, truckPlate: e.target.value.toUpperCase()})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Token Type</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={newTokenForm.type}
                      onChange={e => setNewTokenForm({...newTokenForm, type: e.target.value as 'Import' | 'Export'})}
                    >
                      <option value="Export">Export (Drop-off)</option>
                      <option value="Import">Import (Pick-up)</option>
                    </select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Driver Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Full Name"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={newTokenForm.driverName}
                      onChange={e => setNewTokenForm({...newTokenForm, driverName: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Appointment Time</label>
                    <div className="relative">
                      <input 
                        required
                        type="datetime-local" 
                        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                          formErrors.appointmentTime ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                        }`}
                        value={newTokenForm.appointmentTime}
                        onChange={e => setNewTokenForm({...newTokenForm, appointmentTime: e.target.value})}
                      />
                      {formErrors.appointmentTime && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 flex items-center gap-1">
                          <AlertCircle size={16} />
                          <span className="text-[10px] font-bold">{formErrors.appointmentTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsTokenModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#ff6a00] hover:bg-[#e65f00] text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                  >
                    Generate Token
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTokenForHistory && (
          <HistoryModal 
            token={selectedTokenForHistory} 
            onClose={() => setSelectedTokenForHistory(null)} 
          />
        )}
        {isScannerOpen && (
          <ScannerModal 
            onClose={() => setIsScannerOpen(false)}
            onScan={(id) => {
              const token = tokens.find(t => t.id === id);
              if (token) {
                setSelectedTokenForHistory(token);
                setIsScannerOpen(false);
              } else {
                alert('Token not found');
              }
            }}
          />
        )}
        {statusUpdate && (
          <StatusUpdateModal 
            token={statusUpdate.token}
            newStatus={statusUpdate.newStatus}
            onClose={() => setStatusUpdate(null)}
            onConfirm={(note, gateId) => {
              updateTokenStatus(statusUpdate.token.id, statusUpdate.newStatus, note, gateId);
              setStatusUpdate(null);
            }}
          />
        )}
        {isManualGateModalOpen && (
          <ManualGateEventModal 
            tokens={tokens}
            onClose={() => setIsManualGateModalOpen(false)}
            onLog={(tokenId, type, note) => {
              updateTokenStatus(tokenId, type, note);
              setIsManualGateModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusUpdateModal({ 
  token, 
  newStatus, 
  onClose, 
  onConfirm 
}: { 
  token: Token, 
  newStatus: Token['status'], 
  onClose: () => void, 
  onConfirm: (note: string, gateId?: string) => void 
}) {
  const [note, setNote] = useState('');
  const [gateId, setGateId] = useState('');
  const needsConfirmation = newStatus === 'Cancelled' || newStatus === 'Used';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${
          newStatus === 'Cancelled' ? 'bg-rose-50 text-rose-900' : 
          newStatus === 'Used' ? 'bg-blue-50 text-blue-900' : 
          'bg-slate-50 text-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              newStatus === 'Cancelled' ? 'bg-rose-100' : 
              newStatus === 'Used' ? 'bg-blue-100' : 
              'bg-slate-100'
            }`}>
              {newStatus === 'Cancelled' ? <XCircle size={20} /> : 
               newStatus === 'Used' ? <CheckCircle2 size={20} /> : 
               <Clock size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold">Update Token Status</h3>
              <p className="text-xs opacity-70 font-mono">{token.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {needsConfirmation && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-amber-900">Confirmation Required</p>
                <p className="text-xs text-amber-700">Are you sure you want to mark this token as <span className="font-bold uppercase">{newStatus}</span>? This action might be irreversible.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {newStatus === 'Used' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Associated Gate</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  value={gateId}
                  onChange={e => setGateId(e.target.value)}
                >
                  <option value="">Select a Gate (Optional)</option>
                  <option value="GATE-1">Gate 1</option>
                  <option value="GATE-2">Gate 2</option>
                  <option value="GATE-3">Gate 3</option>
                  <option value="GATE-4">Gate 4</option>
                  <option value="GATE-5">Gate 5</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Optional Note</label>
              <textarea 
                placeholder="Add context for this status change..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px] text-sm"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(note, gateId)}
              className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${
                newStatus === 'Cancelled' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 
                newStatus === 'Used' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 
                'bg-slate-800 hover:bg-slate-900 shadow-slate-500/20'
              }`}
            >
              Confirm Update
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ManualGateEventModal({ 
  tokens, 
  onClose, 
  onLog 
}: { 
  tokens: Token[], 
  onClose: () => void, 
  onLog: (tokenId: string, type: 'Used' | 'Cancelled', note: string) => void 
}) {
  const [tokenId, setTokenId] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [type, setType] = useState<'Used' | 'Cancelled'>('Used');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokens.find(t => t.id === tokenId);
    
    if (!token) {
      setError('Invalid Token ID');
      return;
    }

    if (token.truckPlate.toLowerCase() !== truckPlate.toLowerCase()) {
      setError('Truck Plate mismatch for this Token ID');
      return;
    }

    if (token.status !== 'Active') {
      setError(`Token is already ${token.status}`);
      return;
    }

    onLog(tokenId, type, note || `Manual gate log: ${type}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manual Gate Log</h3>
            <p className="text-xs text-slate-500">Record a gate event manually</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-600 text-xs font-bold">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Token ID</label>
              <input 
                required
                type="text" 
                placeholder="e.g. TKN-1234-AB"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm uppercase"
                value={tokenId}
                onChange={e => {
                  setTokenId(e.target.value.toUpperCase());
                  setError('');
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Truck Plate</label>
              <input 
                required
                type="text" 
                placeholder="e.g. DXB-A-12345"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm uppercase"
                value={truckPlate}
                onChange={e => {
                  setTruckPlate(e.target.value.toUpperCase());
                  setError('');
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Event Type</label>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all hover:bg-slate-50 border-slate-200 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-700">
                  <input 
                    type="radio" 
                    name="eventType" 
                    className="hidden" 
                    checked={type === 'Used'} 
                    onChange={() => setType('Used')} 
                  />
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-bold">Used</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all hover:bg-slate-50 border-slate-200 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50 has-[:checked]:text-rose-700">
                  <input 
                    type="radio" 
                    name="eventType" 
                    className="hidden" 
                    checked={type === 'Cancelled'} 
                    onChange={() => setType('Cancelled')} 
                  />
                  <XCircle size={16} />
                  <span className="text-sm font-bold">Cancel</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Note (Optional)</label>
              <textarea 
                placeholder="Reason for manual entry..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px] text-sm"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
            >
              Log Event
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-white text-[#004b87] shadow-lg shadow-blue-900/20' 
          : 'text-blue-100 hover:bg-blue-800/50'
      }`}
    >
      {icon}
      <span className="font-semibold text-sm">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ff6a00]"></div>}
    </button>
  );
}

function StatCard({ title, value, trend, trendUp, icon }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  );
}

interface TokenCardProps {
  key?: string | number;
  token: Token;
  onUpdateStatus: (token: Token, status: Token['status']) => void;
  onViewHistory: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

function TokenCard({ 
  token, 
  onUpdateStatus, 
  onViewHistory,
  isSelected,
  onSelect
}: TokenCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOcrExpanded, setIsOcrExpanded] = useState(false);

  const isExpiringSoon = useMemo(() => {
    if (token.status !== 'Active') return false;
    const now = new Date();
    const apptTime = parseISO(token.appointmentTime);
    const threshold = addHours(now, 24);
    return isBefore(apptTime, threshold) && isBefore(now, apptTime);
  }, [token]);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all group relative ${
      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
    }`}>
      {onSelect && (
        <div className="absolute top-4 left-4 z-10">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      <div className={`p-6 flex gap-6 ${onSelect ? 'pl-12' : ''}`}>
        <div className="shrink-0">
          <div className="p-2 bg-white border border-slate-100 rounded-xl shadow-sm relative">
            <img src={token.qrCode} alt="QR Code" className="w-24 h-24" />
            {isExpiringSoon && (
              <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-full shadow-lg animate-bounce" title="Expiring within 24 hours">
                <AlertCircle size={14} />
              </div>
            )}
          </div>
          <p className="text-center mt-2 font-mono text-[10px] font-bold text-slate-400">{token.id}</p>
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className={`status-badge ${
                token.status === 'Active' ? 'status-active' : 
                token.status === 'Used' ? 'status-used' :
                token.status === 'Expired' ? 'status-expired' :
                'status-cancelled'
              }`}>
                {token.status}
              </span>
              {isExpiringSoon && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  Expiring Soon
                </span>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <MoreVertical size={16} />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 overflow-hidden"
                    >
                      <p className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update Status</p>
                      <StatusMenuItem label="Mark as Used" onClick={() => { onUpdateStatus(token, 'Used'); setIsMenuOpen(false); }} />
                      <StatusMenuItem label="Mark as Expired" onClick={() => { onUpdateStatus(token, 'Expired'); setIsMenuOpen(false); }} />
                      <StatusMenuItem label="Cancel Token" onClick={() => { onUpdateStatus(token, 'Cancelled'); setIsMenuOpen(false); }} />
                      <div className="border-t border-slate-100 my-1" />
                      <StatusMenuItem label="View History" icon={<History size={14} />} onClick={() => { onViewHistory(); setIsMenuOpen(false); }} />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Container</p>
            <p className="font-mono font-bold text-slate-900">{token.containerNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Truck</p>
              <p className="text-xs font-bold text-slate-700">{token.truckPlate}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointment</p>
              <p className={`text-xs font-bold ${isExpiringSoon ? 'text-amber-600' : 'text-slate-700'}`}>
                {format(parseISO(token.appointmentTime), 'HH:mm')}
              </p>
            </div>
          </div>

          {token.ocrData && (
            <div className="pt-2 border-t border-slate-100 mt-2">
              <button 
                onClick={() => setIsOcrExpanded(!isOcrExpanded)}
                className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-700 transition-colors"
              >
                <Scan size={12} />
                OCR Data Extracted
                {isOcrExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              
              <AnimatePresence>
                {isOcrExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      {token.ocrData.billOfLading && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Bill of Lading</p>
                          <p className="text-[11px] font-mono font-bold text-slate-700">{token.ocrData.billOfLading}</p>
                        </div>
                      )}
                      {token.ocrData.manifestId && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Manifest ID</p>
                          <p className="text-[11px] font-mono font-bold text-slate-700">{token.ocrData.manifestId}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-[8px] font-medium text-slate-400 italic">
                          Extracted at: {format(parseISO(token.ocrData.extractedAt), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <User size={12} className="text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-600">{token.driverName}</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onViewHistory}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="View History"
          >
            <History size={16} />
          </button>
          <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
            <Printer size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusMenuItem({ label, onClick, icon }: { label: string, onClick: () => void, icon?: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function HistoryModal({ token, onClose }: { token: Token, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Token History</h3>
            <p className="text-xs text-slate-500 font-mono">{token.id} • {token.containerNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {token.history.slice().reverse().map((entry, idx) => (
              <div key={idx} className="relative pl-8">
                <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${
                  entry.status === 'Active' ? 'bg-emerald-500' : 
                  entry.status === 'Used' ? 'bg-blue-500' :
                  entry.status === 'Expired' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`}>
                  {entry.status === 'Active' ? <CheckCircle2 size={10} className="text-white" /> : <Clock size={10} className="text-white" />}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{entry.status}</span>
                      {entry.gateId && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {entry.gateId}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{format(parseISO(entry.timestamp), 'MMM dd, HH:mm')}</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-1">{entry.note}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">By {entry.user}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (id: string) => void }) {
  const [isScanning, setIsScanning] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#004b87] text-white">
          <h3 className="text-lg font-bold">Scan Pre-plan Token</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          <div className="relative w-64 h-64 bg-slate-900 rounded-2xl overflow-hidden mb-6 flex items-center justify-center">
            {/* Simulated Camera View */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="w-48 h-48 border-2 border-blue-400 rounded-xl relative">
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"
              />
            </div>
            <p className="absolute bottom-4 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Align QR code within frame</p>
          </div>

          <p className="text-sm text-slate-500 text-center mb-8">
            Point your camera at the token's QR code to quickly retrieve details.
          </p>

          <div className="w-full space-y-3">
            <button 
              onClick={() => onScan('TKN-8821-XP')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              Simulate Scan (TKN-8821-XP)
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
