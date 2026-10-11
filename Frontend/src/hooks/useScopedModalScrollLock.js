import { useEffect } from 'react'

const SCOPED_MODAL_SELECTOR = [
  '.admin-modal-overlay',
  '.staff-modal-overlay',
  '.staff-task-modal-overlay',
  '.approval-confirm-overlay',
].join(',')

/**
 * Locks document scrolling while a modal rendered by the supplied layout is
 * open. Global confirmation dialogs are included because ConfirmProvider
 * renders them beside the router rather than inside the portal layout.
 */
export default function useScopedModalScrollLock(layoutRef, enabled = true) {
  useEffect(() => {
    if (
      !enabled
      || typeof document === 'undefined'
      || typeof window === 'undefined'
      || typeof MutationObserver === 'undefined'
    ) return undefined

    const body = document.body
    const root = document.documentElement
    let locked = false
    let savedScrollX = 0
    let savedScrollY = 0
    let previous = null

    const hasOpenModal = () => {
      const layout = layoutRef.current
      const scopedModal = layout?.querySelector(SCOPED_MODAL_SELECTOR)
      const globalConfirmation = document.querySelector('.confirm-modal-overlay')
      return Boolean(scopedModal || globalConfirmation)
    }

    const lock = () => {
      if (locked) return

      savedScrollX = window.scrollX
      savedScrollY = window.scrollY
      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
      const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

      previous = {
        bodyOverflow: body.style.overflow,
        bodyOverscrollBehavior: body.style.overscrollBehavior,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyPaddingRight: body.style.paddingRight,
        rootOverflow: root.style.overflow,
        rootOverscrollBehavior: root.style.overscrollBehavior,
        rootScrollBehavior: root.style.scrollBehavior,
      }

      body.style.overflow = 'hidden'
      body.style.overscrollBehavior = 'none'
      body.style.position = 'fixed'
      body.style.top = `-${savedScrollY}px`
      body.style.left = `-${savedScrollX}px`
      body.style.right = '0'
      body.style.width = '100%'
      if (scrollbarWidth > 0) body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`
      body.classList.add('staff-portal-modal-open')

      root.style.overflow = 'hidden'
      root.style.overscrollBehavior = 'none'
      root.style.scrollBehavior = 'auto'
      locked = true
    }

    const unlock = () => {
      if (!locked || !previous) return

      body.style.overflow = previous.bodyOverflow
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior
      body.style.position = previous.bodyPosition
      body.style.top = previous.bodyTop
      body.style.left = previous.bodyLeft
      body.style.right = previous.bodyRight
      body.style.width = previous.bodyWidth
      body.style.paddingRight = previous.bodyPaddingRight
      body.classList.remove('staff-portal-modal-open')

      root.style.overflow = previous.rootOverflow
      root.style.overscrollBehavior = previous.rootOverscrollBehavior
      root.style.scrollBehavior = previous.rootScrollBehavior
      locked = false
      window.scrollTo(savedScrollX, savedScrollY)
    }

    const syncLock = () => {
      if (hasOpenModal()) lock()
      else unlock()
    }

    const observer = new MutationObserver(syncLock)
    observer.observe(body, { childList: true, subtree: true })
    syncLock()

    return () => {
      observer.disconnect()
      unlock()
    }
  }, [enabled, layoutRef])
}
