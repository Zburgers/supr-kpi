import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Shield,
  Zap,
  Clock,
  BarChart3,
  RefreshCw,
  Lock,
  ChevronRight,

  Check,
  Layers,
  Database,
  FileSpreadsheet,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/navigation'
import { useTheme } from '@/components/theme-provider'
import { Reveal, StaggerContainer, StaggerItem } from './reveal'
import {
  FloatingMetrics,
  TypingTagline,
  DataFlowVisual,
  DashboardPreview,
  AnimatedCounter,
} from './animated-components'

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    document.title = 'Pegasus by NeuraTech - All Your KPIs, One Dashboard'
    window.scrollTo(0, 0)
  }, [])

  const goToLogin = () => navigate('/login')
  const goToSignup = () => navigate('/signup')

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img src="/pegasus-icon.svg" alt="" className="h-8 w-auto" />
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              Pegasus
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</a>
            <a href="#security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button variant="ghost" size="sm" onClick={goToLogin}>
              Log in
            </Button>
            <Button size="sm" onClick={goToSignup} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/25">
              Get Started
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
        <FloatingMetrics />

        {/* Gradient background */}
        <div className="absolute inset-0 -z-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-indigo-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Now supporting Meta Ads, GA4 &amp; Shopify
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Stop switching tabs.
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent">
              Start seeing everything.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Pegasus pulls your Meta Ads, Google Analytics, and Shopify data into a single Google Sheet
            and a live dashboard &mdash; automatically, every day.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <TypingTagline />
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button
              size="lg"
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-xl shadow-indigo-500/25 h-12 px-8 text-base"
            >
              See How It Works
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={goToSignup}
              className="h-12 px-8 text-base"
            >
              Start Free
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF BAR ===== */}
      <Reveal>
        <section className="border-y border-border/50 bg-card/30 py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {[
                { value: 3, suffix: '+', label: 'Data Sources' },
                { value: 50, suffix: '+', label: 'Metrics Tracked' },
                { value: 99.9, suffix: '%', label: 'Uptime SLA', decimals: 1 },
                { value: 0, prefix: '$', label: 'To Get Started' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">
                    <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ===== THE PROBLEM ===== */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Sound familiar?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                If you run ads, sell online, or track website analytics, you know this pain.
              </p>
            </div>
          </Reveal>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                emoji: '😩',
                title: 'Tab Overload',
                desc: 'You open Meta, then GA4, then Shopify, then your spreadsheet. Every. Single. Morning. And the numbers never quite match.',
              },
              {
                emoji: '⏰',
                title: 'Hours Wasted',
                desc: 'Copy-pasting data across platforms eats 5-10 hours a week. That\'s time you should spend growing your business.',
              },
              {
                emoji: '🤷',
                title: 'Decisions in the Dark',
                desc: 'Without a single source of truth, you can\'t quickly answer: "Is my ad spend actually profitable?"',
              },
            ].map((pain) => (
              <StaggerItem key={pain.title}>
                <div className="bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-colors">
                  <div className="text-3xl mb-3">{pain.emoji}</div>
                  <h3 className="text-lg font-semibold mb-2">{pain.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pain.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ===== HOW IT WORKS / DEMO WALKTHROUGH ===== */}
      <section id="demo" className="py-20 sm:py-28 bg-card/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16" id="how-it-works">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <RefreshCw className="w-3.5 h-3.5" />
                How Pegasus Works
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Three steps. Zero hassle.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Connect your accounts, point to your Google Sheet, and let Pegasus handle the rest.
              </p>
            </div>
          </Reveal>

          {/* Step-by-step walkthrough */}
          <div className="space-y-20">
            {/* Step 1 */}
            <Reveal direction="left">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex-1 order-2 md:order-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-400">1</div>
                    <h3 className="text-xl font-semibold">Connect Your Data Sources</h3>
                  </div>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Securely link your Meta Ads account, Google Analytics 4 property, and Shopify store through our guided onboarding wizard. Your credentials are encrypted with AES-256-GCM &mdash; we never see them in plaintext.
                  </p>
                  <ul className="space-y-2">
                    {['Guided step-by-step setup', 'Bank-grade encryption', 'Credentials stay yours'].map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 order-1 md:order-2">
                  <DataFlowVisual />
                </div>
              </div>
            </Reveal>

            {/* Step 2 */}
            <Reveal direction="right">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex-1">
                  <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Google Sheets Integration
                    </div>
                    {/* Mock sheet */}
                    <div className="rounded-lg overflow-hidden border border-border/50">
                      <div className="bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 border-b border-border/50">
                        KPI-Data-2026.xlsx
                      </div>
                      <div className="bg-background/60 text-xs">
                        <div className="grid grid-cols-5 border-b border-border/30">
                          <div className="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 border-r border-border/30">Date</div>
                          <div className="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 border-r border-border/30">Revenue</div>
                          <div className="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 border-r border-border/30">Ad Spend</div>
                          <div className="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 border-r border-border/30">ROAS</div>
                          <div className="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30">Sessions</div>
                        </div>
                        {[
                          ['Feb 12', '$4,210', '$980', '4.30x', '8,241'],
                          ['Feb 11', '$3,890', '$1,020', '3.81x', '7,893'],
                          ['Feb 10', '$4,747', '$940', '5.05x', '9,102'],
                        ].map((row, i) => (
                          <motion.div
                            key={i}
                            className="grid grid-cols-5 border-b border-border/20 last:border-0"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 + i * 0.2 }}
                          >
                            {row.map((cell, j) => (
                              <div key={j} className={`px-2 py-1.5 ${j === 0 ? 'text-muted-foreground' : 'text-foreground'} border-r border-border/20 last:border-0`}>
                                {cell}
                              </div>
                            ))}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-populated daily at your scheduled time
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-400">2</div>
                    <h3 className="text-xl font-semibold">Auto-Sync to Google Sheets</h3>
                  </div>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Point Pegasus at any Google Sheet. Every day, your KPIs flow in automatically &mdash; revenue, ad spend, ROAS, sessions, orders, conversion rates, and 50+ more metrics. Configure the schedule that works for you.
                  </p>
                  <ul className="space-y-2">
                    {['50+ metrics across all platforms', 'Customizable sync schedules', 'Data stays in YOUR spreadsheet'].map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Step 3 */}
            <Reveal direction="left">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex-1 order-2 md:order-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-400">3</div>
                    <h3 className="text-xl font-semibold">See the Full Picture</h3>
                  </div>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Open Pegasus and see your entire business at a glance. Cross-platform revenue, ROAS trends, traffic sources, and conversion data &mdash; all in one real-time dashboard. No more guessing.
                  </p>
                  <ul className="space-y-2">
                    {['Real-time cross-platform view', 'Beautiful charts and trends', 'Compare platforms side by side'].map(item => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 order-1 md:order-2">
                  <DashboardPreview />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Built for operators who value their time
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every feature exists to save you hours and surface insights faster.
              </p>
            </div>
          </Reveal>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: RefreshCw,
                title: 'Automated Daily Syncs',
                desc: 'Set your schedule and forget about it. Pegasus pulls fresh data every day at the time you choose.',
                color: 'text-indigo-400',
                bg: 'bg-indigo-500/10',
              },
              {
                icon: FileSpreadsheet,
                title: 'Google Sheets Native',
                desc: 'Your data lives in Google Sheets, where you already build reports. No new tools to learn.',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
              },
              {
                icon: BarChart3,
                title: 'Live Dashboard',
                desc: 'A real-time overview of all your KPIs with charts, trends, and cross-platform comparisons.',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
              },
              {
                icon: Layers,
                title: 'Cross-Platform Metrics',
                desc: 'See Meta, GA4, and Shopify data side by side. Finally understand how your channels interact.',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
              },
              {
                icon: Clock,
                title: 'Cron Scheduling',
                desc: 'Fine-grained control over when syncs run. Daily, hourly, or custom cron expressions.',
                color: 'text-cyan-400',
                bg: 'bg-cyan-500/10',
              },
              {
                icon: Database,
                title: 'Activity Logging',
                desc: 'Every sync, every change logged. Full audit trail so you know exactly what happened and when.',
                color: 'text-rose-400',
                bg: 'bg-rose-500/10',
              },
            ].map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="group bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ===== INTEGRATIONS ===== */}
      <section id="integrations" className="py-20 sm:py-28 bg-card/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Integrations you already use
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Pegasus connects to the platforms you rely on and brings them all together.
              </p>
            </div>
          </Reveal>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                name: 'Meta Ads',
                desc: 'Ad spend, impressions, clicks, CTR, CPC, CPM, conversions, ROAS',
                color: 'border-blue-500/30 hover:border-blue-500/60',
                iconBg: 'bg-blue-500',
                status: 'Live',
              },
              {
                name: 'Google Analytics 4',
                desc: 'Sessions, users, page views, bounce rate, conversions, traffic sources',
                color: 'border-amber-500/30 hover:border-amber-500/60',
                iconBg: 'bg-amber-500',
                status: 'Live',
              },
              {
                name: 'Shopify',
                desc: 'Revenue, orders, AOV, cart abandonment, product performance',
                color: 'border-green-500/30 hover:border-green-500/60',
                iconBg: 'bg-green-500',
                status: 'Live',
              },
              {
                name: 'Google Sheets',
                desc: 'Your data destination. All metrics sync directly into the sheet you choose.',
                color: 'border-emerald-500/30 hover:border-emerald-500/60',
                iconBg: 'bg-emerald-600',
                status: 'Live',
              },
            ].map((integration) => (
              <StaggerItem key={integration.name}>
                <div className={`bg-card border ${integration.color} rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-lg`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${integration.iconBg} flex items-center justify-center`}>
                      <div className="w-5 h-5 rounded bg-white/30" />
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {integration.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold mb-2">{integration.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{integration.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <Reveal delay={0.3}>
            <p className="text-center text-sm text-muted-foreground mt-8">
              More integrations coming soon &mdash; TikTok Ads, LinkedIn Ads, and more.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== SECURITY ===== */}
      <section id="security" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" />
                Security First
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Your data is your data
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We built Pegasus with security at the core, not as an afterthought.
              </p>
            </div>
          </Reveal>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: Lock,
                title: 'AES-256-GCM Encryption',
                desc: 'All API credentials are encrypted at rest using military-grade AES-256-GCM encryption with user-specific keys. We never store or see your credentials in plaintext.',
              },
              {
                icon: Shield,
                title: 'Row-Level Security',
                desc: 'Database-level isolation ensures your data is completely separated from every other user. Enforced at the PostgreSQL level, not just the application.',
              },
              {
                icon: Zap,
                title: 'JWT Authentication',
                desc: 'Industry-standard JWT-based auth powered by Clerk. Every API request is verified, every session is secure, every token expires properly.',
              },
              {
                icon: BarChart3,
                title: 'Full Audit Trail',
                desc: 'Every sync, credential change, and configuration update is logged. Complete transparency into what happens with your data.',
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <div className="bg-card border border-border rounded-2xl p-6 hover:border-emerald-500/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 sm:py-28 bg-card/30 border-y border-border/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to see your KPIs clearly?
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
              Join Pegasus and start pulling all your business data into one place. Setup takes 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={goToSignup}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-xl shadow-indigo-500/25 h-12 px-8 text-base"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={goToLogin}
                className="h-12 px-8 text-base"
              >
                Log In
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src="/pegasus-icon.svg" alt="" className="w-6 h-6" />
                <span className="text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  Pegasus
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All your business KPIs in one place. Built by NeuraTech.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</a></li>
                <li><a href="#security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/privacy-policy"
                    onClick={(e) => { e.preventDefault(); navigate('/privacy-policy') }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Account</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={goToLogin} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Log In
                  </button>
                </li>
                <li>
                  <button onClick={goToSignup} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Sign Up
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} NeuraTech. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/privacy-policy"
                onClick={(e) => { e.preventDefault(); navigate('/privacy-policy') }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
