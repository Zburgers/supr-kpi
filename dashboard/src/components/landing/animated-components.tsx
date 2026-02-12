import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/** Animated counter that counts up from 0 to target value */
export function AnimatedCounter({ target, duration = 2000, prefix = '', suffix = '', decimals = 0 }: {
  target: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    // Small delay before starting
    const timer = setTimeout(() => setStarted(true), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!started) return
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(eased * target)
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [target, duration, started])

  return (
    <span className="tabular-nums">
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  )
}

/** Floating metric cards that orbit or drift */
const metricData = [
  { label: 'ROAS', value: '4.2x', color: 'from-emerald-500/20 to-emerald-500/5', borderColor: 'border-emerald-500/30', icon: '📈' },
  { label: 'Revenue', value: '$12.4K', color: 'from-blue-500/20 to-blue-500/5', borderColor: 'border-blue-500/30', icon: '💰' },
  { label: 'Orders', value: '847', color: 'from-purple-500/20 to-purple-500/5', borderColor: 'border-purple-500/30', icon: '🛒' },
  { label: 'CTR', value: '3.8%', color: 'from-amber-500/20 to-amber-500/5', borderColor: 'border-amber-500/30', icon: '🎯' },
  { label: 'Sessions', value: '24.1K', color: 'from-cyan-500/20 to-cyan-500/5', borderColor: 'border-cyan-500/30', icon: '👥' },
  { label: 'Ad Spend', value: '$2.9K', color: 'from-rose-500/20 to-rose-500/5', borderColor: 'border-rose-500/30', icon: '📊' },
]

export function FloatingMetrics() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {metricData.map((metric, i) => {
        // Positions scattered around the hero
        const positions = [
          { top: '8%', left: '5%' },
          { top: '15%', right: '8%' },
          { top: '55%', left: '3%' },
          { top: '65%', right: '5%' },
          { bottom: '15%', left: '10%' },
          { bottom: '8%', right: '12%' },
        ]
        return (
          <motion.div
            key={metric.label}
            className={`absolute hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border bg-gradient-to-br ${metric.color} ${metric.borderColor} backdrop-blur-sm shadow-lg`}
            style={positions[i]}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 0.9, 0.9, 0],
              scale: [0.8, 1, 1, 0.9],
              y: [0, -8, -8, 0],
            }}
            transition={{
              duration: 6,
              delay: i * 1.2,
              repeat: Infinity,
              repeatDelay: metricData.length * 1.2 - 6 + 2,
              ease: 'easeInOut',
            }}
          >
            <span className="text-sm">{metric.icon}</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">{metric.label}</span>
              <span className="text-sm font-bold text-foreground">{metric.value}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** Typing effect for taglines */
const taglines = [
  'all your KPIs in one sheet',
  'Meta Ads + GA4 + Shopify',
  'automated daily syncs',
  'no more copy-pasting data',
]

export function TypingTagline() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % taglines.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-8 relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={current}
          className="absolute inset-0 flex items-center justify-center text-primary font-semibold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          {taglines[current]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

/** Animated data flow visualization */
export function DataFlowVisual() {
  return (
    <div className="relative w-full max-w-2xl mx-auto py-12">
      {/* Source nodes */}
      <div className="flex justify-between items-center relative z-10">
        {[
          { name: 'Meta Ads', color: 'bg-blue-500', glow: 'shadow-blue-500/30' },
          { name: 'GA4', color: 'bg-amber-500', glow: 'shadow-amber-500/30' },
          { name: 'Shopify', color: 'bg-green-500', glow: 'shadow-green-500/30' },
        ].map((source, i) => (
          <motion.div
            key={source.name}
            className={`flex flex-col items-center gap-2`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
          >
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${source.color} shadow-lg ${source.glow} flex items-center justify-center`}>
              <div className="w-6 h-6 rounded-full bg-white/30" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{source.name}</span>
          </motion.div>
        ))}
      </div>

      {/* Animated flow lines */}
      <div className="relative h-16 my-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary"
            animate={{
              y: [0, 20],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
        {/* Center convergence line */}
        <div className="absolute top-0 left-1/2 -translate-x-px w-0.5 h-full bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0" />
      </div>

      {/* Pegasus node (center) */}
      <motion.div
        className="flex flex-col items-center gap-2 relative z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="relative">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/30 flex items-center justify-center">
            <img src="/pegasus-icon.svg" alt="Pegasus" className="w-10 h-10 sm:w-12 sm:h-12 brightness-0 invert" />
          </div>
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-indigo-400/50"
            animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Pegasus
        </span>
      </motion.div>

      {/* Output flow */}
      <div className="relative h-16 my-2">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400"
          animate={{
            y: [0, 20],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            delay: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-px w-0.5 h-full bg-gradient-to-b from-primary/0 via-emerald-400/40 to-primary/0" />
      </div>

      {/* Destination */}
      <motion.div
        className="flex flex-col items-center gap-2 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Google Sheets</span>
      </motion.div>
    </div>
  )
}

/** Mock dashboard preview with animated elements */
export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState(0)
  const tabs = ['Overview', 'Meta', 'GA4', 'Shopify']

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab(prev => (prev + 1) % tabs.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Browser chrome */}
      <div className="rounded-t-xl bg-card/80 border border-border border-b-0 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-background/60 rounded-lg px-3 py-1 text-xs text-muted-foreground font-mono">
            app.pegasus.neuratech.dev
          </div>
        </div>
      </div>

      {/* Dashboard mock */}
      <div className="rounded-b-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
        {/* Header bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500" />
            <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Pegasus</span>
          </div>
          <div className="flex gap-2">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-2 sm:px-3 py-1 text-xs rounded-md transition-all ${
                  i === activeTab
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Metric cards */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Revenue', value: '$12,847', change: '+12.3%', up: true },
              { label: 'Ad Spend', value: '$2,940', change: '-4.1%', up: false },
              { label: 'Orders', value: '847', change: '+8.7%', up: true },
              { label: 'ROAS', value: '4.37x', change: '+16.2%', up: true },
            ].map((metric, i) => (
              <motion.div
                key={metric.label}
                className="bg-background/60 rounded-xl p-3 border border-border/50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{metric.label}</div>
                <div className="text-lg font-bold text-foreground mt-1">{metric.value}</div>
                <div className={`text-xs font-medium mt-0.5 ${metric.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {metric.change}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Chart mockup */}
          <div className="mt-4 bg-background/40 rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-foreground">Revenue Over Time</span>
              <span className="text-[10px] text-muted-foreground">Last 7 days</span>
            </div>
            <div className="flex items-end gap-1 h-20">
              {[40, 55, 45, 60, 75, 65, 85].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-indigo-500/60 to-purple-500/40 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <span key={d} className="text-[8px] text-muted-foreground flex-1 text-center">{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect behind */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-2xl blur-2xl -z-10" />
    </div>
  )
}
