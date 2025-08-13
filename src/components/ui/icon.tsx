import React from 'react'
import { cn } from '../../lib/utils'

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type IconTone = 'default' | 'muted' | 'primary' | 'destructive' | 'success' | 'warning' | 'info'

const sizeToClass: Record<IconSize, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
}

const toneToClass: Record<IconTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-primary',
}

interface IconProps {
  icon: React.ComponentType<any>
  size?: IconSize
  tone?: IconTone
  strokeWidth?: 1 | 1.5 | 2 | 2.5 | 3
  className?: string
  spin?: boolean
  px?: number
  style?: React.CSSProperties
}

export function Icon({
  icon: IconComponent,
  size = 'md',
  tone = 'default',
  strokeWidth = 2,
  className,
  spin = false,
  px,
  style,
}: IconProps) {
  const sizeClass = sizeToClass[size]
  const toneClass = toneToClass[tone]
  const sizeStyle = px ? { width: px, height: px } : undefined

  return (
    <IconComponent
      className={cn(sizeClass, toneClass, spin && 'animate-spin', className)}
      strokeWidth={strokeWidth}
      style={{ ...sizeStyle, ...style }}
    />
  )
}

export type { IconProps, IconSize, IconTone }


