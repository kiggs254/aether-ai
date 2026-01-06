import React, { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import { Modal } from './Modal';
import { Bot } from '../types';
import { botService } from '../services/database';
import { Bot as BotIcon, Plus, Trash2, Edit, Search, Filter } from 'lucide-react';

interface BotWithUser extends Bot {
  userEmail?: string;
}

interface BotsProps {
  onNavigateToBotBuilder: (botId?: string) => void;
  isAdmin?: boolean;
}

const Bots: React.FC<BotsProps> = ({ onNavigateToBotBuilder, isAdmin = false }) => {
  const { showSuccess, showError } = useNotification();
  const [bots, setBots] = useState<BotWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const botsData = await botService.getAllBots(isAdmin);

      setBots(botsData);
    } catch (error) {
      console.error('Failed to load bots:', error);
      showError('Failed to load bots', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBot = async (botId: string, botName?: string) => {
    setModal({
      isOpen: true,
      title: 'Delete Bot',
      message: `Are you sure you want to delete "${botName || 'this bot'}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await botService.deleteBot(botId);
          await loadData();
          showSuccess('Bot deleted', 'The bot has been deleted successfully.');
        } catch (error) {
          console.error('Failed to delete bot:', error);
          showError('Failed to delete bot', 'Please try again.');
        }
      },
    });
  };

  const handleEditBot = (bot: BotWithUser) => {
    onNavigateToBotBuilder(bot.id);
  };

  const handleCreateBot = () => {
    onNavigateToBotBuilder();
  };

  // Filter bots
  const filteredBots = bots.filter((bot) => {
    const matchesSearch = 
      !searchTerm ||
      bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bot.website.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (isAdmin && bot.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || bot.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Bots</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">Manage your chatbot bots and configurations.</p>
        </div>
        <button
          onClick={handleCreateBot}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Bot
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-3xl">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isAdmin ? "Search bots by name, website, or owner..." : "Search bots by name or website..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-xl glass-input text-sm appearance-none bg-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bots Table */}
      <div className="glass-card rounded-3xl overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-slate-400">Loading bots...</div>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <BotIcon className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg mb-2">
              {bots.length === 0 ? 'No bots yet' : 'No bots match your search'}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              {bots.length === 0 
                ? 'Create your first bot to get started' 
                : 'Try adjusting your search or filters'}
            </p>
            {bots.length === 0 && (
              <button
                onClick={handleCreateBot}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Bot
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  {isAdmin && (
                    <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                  )}
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Website</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Model</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                          {bot.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{bot.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono">
                            {bot.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <div className="text-sm text-slate-300">{bot.userEmail || 'Unknown'}</div>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="text-sm text-white truncate max-w-xs">{bot.website || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-300">{bot.model.split('-')[1] || bot.model}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        bot.status === 'active' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {bot.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-400">
                        {new Date(bot.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditBot(bot)}
                          className="p-2 rounded-lg hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit bot"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBot(bot.id, bot.name)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete bot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '' })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type="confirm"
        variant={modal.variant || 'info'}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Bots;

