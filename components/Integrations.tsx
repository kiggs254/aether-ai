import React, { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import { Modal } from './Modal';
import { Integration, Bot, ViewState } from '../types';
import { integrationService, botService } from '../services/database';
import { Globe, Plus, Trash2, Edit, Eye, Code, Search, Filter } from 'lucide-react';

interface IntegrationWithBot extends Integration {
  botName?: string;
}

interface IntegrationsProps {
  onNavigateToIntegration: (botId: string, integrationId?: string) => void;
}

const Integrations: React.FC<IntegrationsProps> = ({ onNavigateToIntegration }) => {
  const { showSuccess, showError } = useNotification();
  const [integrations, setIntegrations] = useState<IntegrationWithBot[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBot, setFilterBot] = useState<string>('all');

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
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [integrationsData, botsData] = await Promise.all([
        integrationService.getAllUserIntegrations(),
        botService.getAllBots(),
      ]);

      // Map bot names to integrations
      const integrationsWithBots = integrationsData.map((integration) => {
        const bot = botsData.find((b) => b.id === integration.botId);
        return {
          ...integration,
          botName: bot?.name || 'Unknown Bot',
        };
      });

      setIntegrations(integrationsWithBots);
      setBots(botsData);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      showError('Failed to load integrations', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string, integrationName?: string) => {
    setModal({
      isOpen: true,
      title: 'Delete Integration',
      message: `Are you sure you want to delete "${integrationName || 'this integration'}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await integrationService.deleteIntegration(integrationId);
          await loadData();
          showSuccess('Integration deleted', 'The integration has been deleted successfully.');
        } catch (error) {
          console.error('Failed to delete integration:', error);
          showError('Failed to delete integration', 'Please try again.');
        }
      },
    });
  };

  const handleEditIntegration = (integration: IntegrationWithBot) => {
    // Navigate to EmbedCode page with the bot ID and integration ID
    onNavigateToIntegration(integration.botId, integration.id);
  };

  const handleCreateIntegration = () => {
    // Navigate to create integration - user will select a bot
    if (bots.length === 0) {
      showError('No bots available', 'Please create a bot first.');
      return;
    }
    // Navigate to the first bot's integration page to create new integration
    onNavigateToIntegration(bots[0].id);
  };

  // Filter integrations
  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch = 
      !searchTerm ||
      integration.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.botName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBot = filterBot === 'all' || integration.botId === filterBot;

    return matchesSearch && matchesBot;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Integrations</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">Manage your chatbot integrations across all bots.</p>
        </div>
        <button
          onClick={handleCreateIntegration}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Integration
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-3xl">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterBot}
              onChange={(e) => setFilterBot(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-xl glass-input text-sm appearance-none bg-transparent"
            >
              <option value="all">All Bots</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Integrations Table */}
      <div className="glass-card rounded-3xl overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-slate-400">Loading integrations...</div>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Globe className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg mb-2">
              {integrations.length === 0 ? 'No integrations yet' : 'No integrations match your search'}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              {integrations.length === 0 
                ? 'Create your first integration to get started' 
                : 'Try adjusting your search or filters'}
            </p>
            {integrations.length === 0 && (
              <button
                onClick={handleCreateIntegration}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Integration
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Bot</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Theme</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Position</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Features</th>
                  <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredIntegrations.map((integration) => (
                  <tr key={integration.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-white">
                        {integration.name || 'Unnamed Integration'}
                      </div>
                      {integration.name && (
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {integration.id.substring(0, 8)}...
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-white">{integration.botName}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize bg-white/10 text-slate-300">
                        {integration.theme}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize bg-white/10 text-slate-300">
                        {integration.position}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {integration.collectLeads && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Leads
                          </span>
                        )}
                        {integration.departmentBots && integration.departmentBots.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                            {integration.departmentBots.length} Dept{integration.departmentBots.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {!integration.collectLeads && (!integration.departmentBots || integration.departmentBots.length === 0) && (
                          <span className="text-xs text-slate-500">Basic</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-400">
                        {new Date(integration.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditIntegration(integration)}
                          className="p-2 rounded-lg hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit integration"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIntegration(integration.id, integration.name)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete integration"
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

export default Integrations;

