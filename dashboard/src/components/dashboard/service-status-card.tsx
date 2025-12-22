import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Settings, AlertCircle } from 'lucide-react'
import type { Platform } from '@/types'
import { cn } from '@/lib/utils'
import React from 'react'

interface ServiceStatusCardProps {
  platform: Platform
  status: 'configured' | 'unconfigured' | 'error'
  title: string
  description: string
  onConfigure?: () => void
  icon?: React.ReactNode
}

const platformColors: Record<Platform, string> = {
  meta: 'border-l-[var(--color-meta)]',
  ga4: 'border-l-[var(--color-ga4)]',
  shopify: 'border-l-[var(--color-shopify)]',
}

const platformBadgeVariants: Record<Platform, 'meta' | 'ga4' | 'shopify'> = {
  meta: 'meta',
  ga4: 'ga4',
  shopify: 'shopify',
}

const statusColors: Record<string, string> = {
  configured: 'bg-green-500/20 text-green-500',
  unconfigured: 'bg-yellow-500/20 text-yellow-500',
  error: 'bg-red-500/20 text-red-500',
}

const statusIcons: Record<string, React.ReactNode> = {
  configured: <Settings className="w-4 h-4" />,
  unconfigured: <AlertCircle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
}

export function ServiceStatusCard({
  platform,
  status,
  title,
  description,
  onConfigure,
  icon,
}: ServiceStatusCardProps) {
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 150,
      },
    },
    hover: {
      y: -4,
      transition: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 200,
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="h-full"
    >
      <Card className={cn(
        "relative border-l-4 h-full overflow-hidden bg-gradient-to-br from-card to-muted/30",
        platformColors[platform],
        "hover:shadow-lg transition-all duration-300 hover:shadow-xl/20"
      )}>
        {/* Animated background element */}
        <div className="absolute inset-0 opacity-5">
          <div className={`absolute top-0 right-0 w-24 h-24 bg-[var(--color-${platform})] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}></div>
        </div>
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && <span className="text-lg">{icon}</span>}
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <Badge 
              variant={platformBadgeVariants[platform]} 
              className="text-[10px] font-bold px-2 py-1"
            >
              {platform.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="relative z-10">
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
          
          <div className="flex items-center justify-between">
            <Badge className={cn("flex items-center gap-1 px-2 py-1", statusColors[status])}>
              {statusIcons[status]}
              <span className="capitalize ml-1">{status}</span>
            </Badge>
            
            {onConfigure && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onConfigure}
                className="flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Configure
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}