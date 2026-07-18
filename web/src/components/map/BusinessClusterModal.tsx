import { Link } from 'react-router-dom'

import type { TrackedBusiness } from '@/lib/spatial-businesses'
import { vendorPath } from '@/lib/market-routes'

type Props = {
  businesses: TrackedBusiness[]
  onClose: () => void
}

export function BusinessClusterModal({ businesses, onClose }: Props) {
  const count = businesses.length
  const title = `${count} LOCAL PRODUCER${count === 1 ? '' : 'S'} AT THIS LOCATION`

  return (
    <div
      className="business-cluster-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="business-cluster-modal__backdrop"
        aria-label="CLOSE"
        onClick={onClose}
      />
      <div className="business-cluster-modal__panel">
        <div className="business-cluster-modal__header">
          <p className="business-cluster-modal__eyebrow">CLUSTER</p>
          <h2 className="business-cluster-modal__title">{title}</h2>
          <button
            type="button"
            className="business-cluster-modal__close"
            onClick={onClose}
          >
            [ CLOSE ]
          </button>
        </div>
        <ul className="business-cluster-modal__list">
          {businesses.map((biz) => {
            const kind = (biz.entity_kind || biz.role || 'BUSINESS').toUpperCase()
            const meta = [
              kind,
              [biz.sell_city, biz.sell_state].filter(Boolean).join(', '),
            ]
              .filter(Boolean)
              .join(' · ')
            const body = (
              <>
                <span className="business-cluster-modal__name">{biz.display_name}</span>
                <span className="business-cluster-modal__meta">{meta}</span>
              </>
            )
            return (
              <li key={biz.profile_id}>
                {biz.entity_kind === 'vendor' ? (
                  <Link
                    to={vendorPath(biz.business_row_id)}
                    className="business-cluster-modal__row"
                    onClick={onClose}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="business-cluster-modal__row business-cluster-modal__row--static">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
