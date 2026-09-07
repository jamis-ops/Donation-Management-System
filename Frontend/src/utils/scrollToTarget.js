/**
 * Smooth-scroll helpers for deep links (hash / query focus targets).
 */

function getScrollParent(el) {
  let node = el.parentElement
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 1) {
      return node
    }
    node = node.parentElement
  }
  return null
}

export function scrollToTarget(target, {
  behavior = 'smooth',
  highlightMs = 2200,
  offset = 88,
} = {}) {
  if (!target) return false
  const el = typeof target === 'string'
    ? document.getElementById(target.replace(/^#/, '')) || document.querySelector(target)
    : target
  if (!el) return false

  const scrollParent = getScrollParent(el)
  if (scrollParent) {
    const parentTop = scrollParent.getBoundingClientRect().top
    const elTop = el.getBoundingClientRect().top
    const nextTop = scrollParent.scrollTop + (elTop - parentTop) - offset
    scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior })
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: Math.max(0, top), behavior })
  }

  if (highlightMs > 0) {
    el.classList.add('deep-link-focus')
    window.setTimeout(() => el.classList.remove('deep-link-focus'), highlightMs)
  }

  try {
    if (typeof el.focus === 'function' && el.tabIndex < 0) {
      el.tabIndex = -1
    }
    el.focus?.({ preventScroll: true })
  } catch {
    /* ignore */
  }

  return true
}

/**
 * Retry scroll until the element exists (useful after async list load).
 * Returns a cancel function.
 */
export function scrollToTargetWhenReady(targetId, {
  attempts = 24,
  intervalMs = 80,
  ...opts
} = {}) {
  const id = String(targetId || '').replace(/^#/, '')
  if (!id) return () => {}

  let tries = 0
  let timer = null
  let cancelled = false

  const finish = () => {
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const tick = () => {
    if (cancelled) {
      finish()
      return
    }
    tries += 1
    if (scrollToTarget(id, opts) || tries >= attempts) {
      finish()
    }
  }

  requestAnimationFrame(tick)
  timer = window.setInterval(tick, intervalMs)

  return () => {
    cancelled = true
    finish()
  }
}
