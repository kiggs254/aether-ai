import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Zap, MessageCircle, ShoppingCart, Users, BarChart3, Code, 
  Sparkles, ArrowRight, Check, Star, TrendingUp, Globe, Shield,
  Mail, Phone, Settings, Play, ChevronDown, Rocket, Brain, 
  Workflow, ShoppingBag, Palette, CreditCard
} from 'lucide-react';
import Auth from './Auth';

interface LandingProps {
  onAuthSuccess: () => void;
}

const Landing: React.FC<LandingProps> = ({ onAuthSuccess }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadPlans();
    
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const loadPlans = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        setLoadingPlans(false);
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (!error && data) {
        setPlans(data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPrice = (plan: any) => {
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (showAuth) {
    return <Auth onAuthSuccess={onAuthSuccess} initialMode={authMode} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 relative font-sans overflow-x-hidden">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[150px] animate-pulse" style={{animationDuration: '8s'}} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[150px] animate-pulse" style={{animationDuration: '12s'}} />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-emerald-900/5 blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Aether AI</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => scrollToSection('features')} className="text-slate-400 hover:text-white transition-colors">Features</button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-slate-400 hover:text-white transition-colors">How It Works</button>
              <button onClick={() => scrollToSection('pricing')} className="text-slate-400 hover:text-white transition-colors">Pricing</button>
              <button 
                onClick={() => {
                  setAuthMode('login');
                  setShowAuth(true);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setShowAuth(true);
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
              >
                Get Started
              </button>
            </div>
            <div className="md:hidden">
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setShowAuth(true);
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">Powered by Gemini & OpenAI</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Build AI Chatbots
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              That Actually Work
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto">
            Create intelligent, conversational AI bots in minutes. No coding required. 
            Train with your knowledge base, embed anywhere, and watch your business grow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => {
                setAuthMode('signup');
                setShowAuth(true);
              }}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              See Features
            </button>
          </div>
          
          {/* Hero Visual */}
          <div className="relative max-w-5xl mx-auto mt-16">
            <div className="glass-card rounded-3xl p-8 border border-white/10 backdrop-blur-xl bg-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="space-y-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-white">Hi! I'm your AI assistant. How can I help you today?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 justify-end">
                    <div className="flex-1 bg-indigo-500/20 rounded-2xl p-4 border border-indigo-500/30">
                      <p className="text-white">I'm looking for information about your products</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-white mb-3">I'd be happy to help! Here are some popular products:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <div className="w-full h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded mb-2" />
                          <p className="text-xs text-slate-300">Product 1</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <div className="w-full h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded mb-2" />
                          <p className="text-xs text-slate-300">Product 2</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" ref={(el) => sectionRefs.current['features'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Everything You Need to <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Succeed</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to help you build, deploy, and scale AI chatbots effortlessly
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Intelligence',
                description: 'Powered by Gemini and OpenAI. Choose your model, adjust temperature, and create intelligent conversations.',
                color: 'indigo'
              },
              {
                icon: Settings,
                title: 'Easy Bot Builder',
                description: 'Visual interface to create bots in minutes. No coding required. Train with your knowledge base.',
                color: 'purple'
              },
              {
                icon: MessageCircle,
                title: 'Real-time Conversations',
                description: 'Manage all conversations in one place. Real-time messaging with lead capture and analytics.',
                color: 'emerald'
              },
              {
                icon: ShoppingBag,
                title: 'E-commerce Ready',
                description: 'Integrate product catalogs. Smart recommendations. Visual product cards in chat.',
                color: 'pink'
              },
              {
                icon: Mail,
                title: 'Lead Collection',
                description: 'Automatically capture emails and phone numbers. Build your customer database effortlessly.',
                color: 'orange'
              },
              {
                icon: Palette,
                title: 'Custom Branding',
                description: 'Add header images, custom "Powered by" text, and match your brand perfectly.',
                color: 'cyan'
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="glass-card p-6 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all group hover:scale-105"
                >
                  <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/10 border border-${feature.color}-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 text-${feature.color}-400`} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" ref={(el) => sectionRefs.current['how-it-works'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Get Started in <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">3 Simple Steps</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              From idea to deployment in minutes, not weeks
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Create Your Bot',
                description: 'Use our visual builder to define your bot\'s personality, knowledge base, and behavior.',
                icon: Bot,
                color: 'indigo'
              },
              {
                step: '2',
                title: 'Train with Knowledge',
                description: 'Upload your documents, add system instructions, and configure custom actions.',
                icon: Brain,
                color: 'purple'
              },
              {
                step: '3',
                title: 'Embed & Go Live',
                description: 'Copy the embed code, paste it on your website, and start chatting with customers.',
                icon: Rocket,
                color: 'emerald'
              },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative">
                  <div className="glass-card p-8 rounded-3xl border border-white/10 text-center relative z-10">
                    <div className={`w-16 h-16 rounded-2xl bg-${step.color}-500/10 border border-${step.color}-500/20 flex items-center justify-center mx-auto mb-6`}>
                      <Icon className={`w-8 h-8 text-${step.color}-400`} />
                    </div>
                    <div className={`absolute -top-4 -right-4 w-12 h-12 rounded-full bg-${step.color}-500 text-white flex items-center justify-center font-bold text-xl`}>
                      {step.step}
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-slate-400">{step.description}</p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-0">
                      <ArrowRight className="w-8 h-8 text-indigo-500/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section id="showcase" ref={(el) => sectionRefs.current['showcase'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-24">
          {/* AI Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-indigo-300">AI Intelligence</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Powered by Leading AI Models
              </h3>
              <p className="text-lg text-slate-400 mb-6">
                Choose between Gemini and OpenAI models. Fine-tune temperature settings, select the perfect model for your use case, and create conversations that feel natural and intelligent.
              </p>
              <ul className="space-y-3">
                {['Gemini & OpenAI Support', 'Temperature Control', 'Model Selection', 'Context-Aware Responses'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-card p-8 rounded-3xl border border-white/10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                  <Bot className="w-6 h-6 text-indigo-400" />
                  <div>
                    <p className="text-white font-medium">Model: Gemini 3 Flash</p>
                    <p className="text-sm text-slate-400">Temperature: 0.7</p>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
                  <p className="text-white">Intelligent, context-aware responses powered by cutting-edge AI</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bot Builder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 glass-card p-8 rounded-3xl border border-white/10">
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-medium">Bot Configuration</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="text-white">Customer Support Bot</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Knowledge Base:</span>
                      <span className="text-white">12 documents</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Custom Actions:</span>
                      <span className="text-white">5 configured</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-purple-300">Visual Builder</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Build Bots Visually
              </h3>
              <p className="text-lg text-slate-400 mb-6">
                No coding required. Use our intuitive interface to create bots, train them with your knowledge base, and configure custom actions like links, phone calls, and WhatsApp.
              </p>
              <ul className="space-y-3">
                {['Visual Interface', 'Knowledge Base Training', 'System Instructions', 'Custom Actions'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* E-commerce */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-6">
                <ShoppingBag className="w-4 h-4 text-pink-400" />
                <span className="text-sm text-pink-300">E-commerce</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Sell Products in Chat
              </h3>
              <p className="text-lg text-slate-400 mb-6">
                Integrate your product catalog. Enable smart product recommendations. Show visual product cards directly in chat. Turn conversations into sales.
              </p>
              <ul className="space-y-3">
                {['Product Catalog Integration', 'Smart Recommendations', 'Visual Product Cards', 'Shopping Cart'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-card p-8 rounded-3xl border border-white/10">
              <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg" />
                    <div className="flex-1">
                      <p className="text-white font-medium">Premium Product</p>
                      <p className="text-sm text-slate-400">$99.99</p>
                    </div>
                  </div>
                  <button className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-white text-sm transition-colors">
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" ref={(el) => sectionRefs.current['pricing'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Simple, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Transparent</span> Pricing
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
              Choose the plan that fits your needs. Start free, upgrade anytime.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Yearly
                <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Save 20%</span>
              </button>
            </div>
          </div>

          {loadingPlans ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan, idx) => {
                const isPopular = plan.name === 'Pro';
                const price = getPrice(plan);
                const savings = billingCycle === 'yearly' && plan.price_monthly > 0 
                  ? (plan.price_monthly * 12) - plan.price_yearly 
                  : 0;

                return (
                  <div
                    key={plan.id}
                    className={`glass-card p-8 rounded-3xl border relative ${
                      isPopular
                        ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-transparent'
                        : 'border-white/10'
                    } hover:scale-105 transition-transform`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full text-white text-sm font-medium">
                        Most Popular
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                      <div className="mb-2">
                        <span className="text-4xl font-bold text-white">{formatCurrency(price)}</span>
                        <span className="text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                      {savings > 0 && (
                        <p className="text-sm text-emerald-400">Save {formatCurrency(savings)}/year</p>
                      )}
                    </div>
                    <ul className="space-y-3 mb-8 min-h-[200px]">
                      {Array.isArray(plan.features) && plan.features.map((feature: string, fIdx: number) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        setAuthMode('signup');
                        setShowAuth(true);
                      }}
                      className={`w-full py-3 rounded-xl font-semibold transition-all ${
                        isPopular
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700'
                          : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {plan.name === 'Free' ? 'Get Started' : 'Choose Plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Social Proof */}
      <section id="social-proof" ref={(el) => sectionRefs.current['social-proof'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Trusted by <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Businesses</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Join thousands of companies using Aether AI to transform customer engagement
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="glass-card p-6 rounded-2xl border border-white/10 text-center">
              <div className="text-4xl font-bold text-white mb-2">10,000+</div>
              <div className="text-slate-400">Conversations Handled</div>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 text-center">
              <div className="text-4xl font-bold text-white mb-2">5,000+</div>
              <div className="text-slate-400">Active Bots</div>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 text-center">
              <div className="text-4xl font-bold text-white mb-2">99.9%</div>
              <div className="text-slate-400">Uptime</div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Sarah Johnson',
                role: 'CEO, TechStart',
                content: 'Aether AI transformed our customer support. Setup was effortless and results were immediate.',
                rating: 5
              },
              {
                name: 'Michael Chen',
                role: 'Founder, E-commerce Plus',
                content: 'The e-commerce integration is a game-changer. Our sales increased by 30% after implementing it.',
                rating: 5
              },
              {
                name: 'Emily Rodriguez',
                role: 'Marketing Director, Growth Co',
                content: 'Best chatbot platform we\'ve used. The lead collection feature alone paid for itself.',
                rating: 5
              },
            ].map((testimonial, idx) => (
              <div key={idx} className="glass-card p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-slate-400">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="cta" ref={(el) => sectionRefs.current['cta'] = el} className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card p-12 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses using Aether AI to create better customer experiences. 
              Start free, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setShowAuth(true);
                }}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center gap-2"
              >
                Start Building Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all"
              >
                Learn More
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-6">No credit card required • Free forever plan available</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Aether AI</span>
              </div>
              <p className="text-slate-400 text-sm">
                Build intelligent AI chatbots that transform customer engagement.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('features')} className="text-slate-400 hover:text-white text-sm transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="text-slate-400 hover:text-white text-sm transition-colors">Pricing</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="text-slate-400 hover:text-white text-sm transition-colors">How It Works</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">About</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Blog</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Terms</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} Aether AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

