import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

/**
 * Compact row/card action menu (⋮) for admin tables.
 *
 * @param {object} props
 * @param {Array<{
 *   key?: string,
 *   label: string,
 *   icon?: import('react').ReactNode,
 *   onClick: () => void,
 *   variant?: 'default' | 'danger' | 'success',
 *   hidden?: boolean,
 *   disabled?: boolean,
 * }>} props.items
 * @param {string} [props.label='Actions']
 * @param {'left'|'right'} [props.align='right']
 */
export default function RowActionsMenu({ items = [], label = 'Actions', align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const visible = items.filter((item) => item && !item.hidden)

  const updatePosition = () => {
    const trigger = rootRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || 184
    const menuHeight = menuRef.current?.offsetHeight || 0
    const gap = 4
    const viewportPadding = 8

    let left = align === 'left' ? rect.left : rect.right - menuWidth
    left = Math.min(Math.max(viewportPadding, left), window.innerWidth - menuWidth - viewportPadding)

    let top = rect.bottom + gap
    if (menuHeight && top + menuHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - menuHeight - gap)
    }

    setCoords({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, align, visible.length])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      const inTrigger = rootRef.current?.contains(e.target)
      const inMenu = menuRef.current?.contains(e.target)
      if (!inTrigger && !inMenu) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!visible.length) return null

  return (
    <div
      className={`row-actions-menu${open ? ' row-actions-menu--open' : ''}`}
      ref={rootRef}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="row-actions-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} aria-hidden />
      </button>

      {open && createPortal(
        <div
          id={menuId}
          ref={menuRef}
          className="row-actions-menu__dropdown row-actions-menu__dropdown--portal"
          role="menu"
          aria-label={label}
          style={{ top: coords.top, left: coords.left }}
        >
          {visible.map((item, index) => (
            <button
              key={item.key || `${item.label}-${index}`}
              type="button"
              role="menuitem"
              className={`row-actions-menu__item${item.variant ? ` row-actions-menu__item--${item.variant}` : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                setOpen(false)
                item.onClick?.()
              }}
            >
              {item.icon ? <span className="row-actions-menu__icon">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
