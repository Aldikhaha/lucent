import type { ComponentProps, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../lib/shadcn/tooltip'
import { cn } from '../../lib/shadcn/utils'

interface IconButtonProps extends ComponentProps<'button'> {
  label: string
  shortcut?: string
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

const sizes = {
  sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-9 w-9 [&_svg]:h-[18px] [&_svg]:w-[18px]',
  lg: 'h-11 w-11 [&_svg]:h-5 [&_svg]:w-5',
}

/** Quiet circular icon button with a tooltip and optional "active" accent state. */
export function IconButton({
  label,
  shortcut,
  active = false,
  size = 'md',
  tooltipSide = 'top',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={props['aria-pressed']}
          className={cn(
            'lc-focus relative inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-[hsl(var(--lc-hover)/0.07)] hover:text-foreground active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40',
            sizes[size],
            active && 'lc-accent-text hover:text-[color:var(--lc-accent)]',
            className,
          )}
          {...props}
        >
          {children}
          {active && <span className="lc-accent-bg absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="lc-glass-menu border-0 px-2.5 py-1 text-xs">
        {label}
        {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
