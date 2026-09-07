import { useSeeMore } from '../../../hooks/useSeeMore'

export function SeeMoreToggle({
  expanded,
  onToggle,
  hiddenCount = 0,
  moreLabel = 'See More',
  lessLabel = 'See Less',
  showEllipsis = true,
  className = '',
}) {
  return (
    <div className={`see-more ${className}`.trim()}>
      {!expanded && showEllipsis && (
        <span className="see-more__ellipsis" aria-hidden="true">…</span>
      )}
      <button type="button" className="see-more__btn" onClick={onToggle}>
        {expanded
          ? lessLabel
          : hiddenCount > 0
            ? `${moreLabel} (${hiddenCount})`
            : moreLabel}
      </button>
    </div>
  )
}

export default function SeeMoreList({
  items = [],
  initialCount = 3,
  renderItem,
  keyFn = (item, i) => item?.id ?? item?.dbId ?? item?.key ?? i,
  as: Tag = 'ul',
  itemAs: ItemTag = 'li',
  className = '',
  moreLabel = 'See More',
  lessLabel = 'See Less',
  showEllipsis = true,
  empty = null,
}) {
  const { visible, expanded, toggle, needsToggle, hiddenCount } = useSeeMore(items, initialCount)

  if (!items?.length) return empty

  return (
    <div className="see-more-wrap">
      <Tag className={className}>
        {visible.map((item, i) => {
          const key = keyFn(item, i)
          const content = renderItem(item, i)
          if (ItemTag === null) return <span key={key}>{content}</span>
          return <ItemTag key={key}>{content}</ItemTag>
        })}
      </Tag>
      {needsToggle && (
        <SeeMoreToggle
          expanded={expanded}
          onToggle={toggle}
          hiddenCount={hiddenCount}
          moreLabel={moreLabel}
          lessLabel={lessLabel}
          showEllipsis={showEllipsis}
        />
      )}
    </div>
  )
}
