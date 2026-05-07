import * as React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import { DialogTitle } from '@/components/ui/dialog'

export type ModalVariant = 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'gray'

interface ModalHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  variant?: ModalVariant
  onClose?: () => void
  className?: string
}

export function ModalHeader({
  title,
  subtitle,
  icon,
  actions,
  variant = 'blue',
  onClose,
  className,
}: ModalHeaderProps) {
  const variants = {
    blue: { gradient: 'from-blue-600 to-blue-500', subtle: 'text-blue-100', close: 'text-blue-600' },
    emerald: { gradient: 'from-emerald-600 to-emerald-500', subtle: 'text-emerald-100', close: 'text-emerald-600' },
    amber: { gradient: 'from-amber-600 to-amber-500', subtle: 'text-amber-100', close: 'text-amber-600' },
    red: { gradient: 'from-red-600 to-red-500', subtle: 'text-red-100', close: 'text-red-600' },
    purple: { gradient: 'from-purple-600 to-purple-500', subtle: 'text-purple-100', close: 'text-purple-600' },
    gray: { gradient: 'from-gray-700 to-gray-600', subtle: 'text-gray-200', close: 'text-gray-900' },
  }
  const v = variants[variant]

  return (
    <div className={cn("px-6 py-4 bg-gradient-to-r text-white", v.gradient, className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon ? (
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold truncate">{title}</DialogTitle>
            {subtitle ? (
              <p className={cn("text-sm truncate", v.subtle)}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "h-9 w-9 rounded-md border border-white/70 bg-white flex items-center justify-center hover:bg-white/90",
                v.close
              )}
              aria-label="Tutup"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn(
      "bg-gray-50 border-t px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-between",
      className
    )}>
      {children}
    </div>
  )
}

interface ModalContentWrapperProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export function ModalContentWrapper({ children, className, id }: ModalContentWrapperProps) {
  return (
    <div className={cn("px-6 py-5 space-y-6", className)} id={id}>
      {children}
    </div>
  )
}
