import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { fetchApprovedReviews, submitReview } from '@/lib/reviews';
import type { Review, ReviewTargetType } from '@/types/database';

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span aria-label={`${rating} out of 5`} style={{ color: '#d4a017', letterSpacing: '0.05em' }}>
      {'★'.repeat(rounded)}
      {'☆'.repeat(Math.max(0, 5 - rounded))}
    </span>
  );
}

export function ReviewsSection({
  targetType,
  targetId,
}: {
  targetType: ReviewTargetType;
  targetId: string;
}) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchApprovedReviews(targetType, targetId).then((res) => {
      if (!active) return;
      setReviews(res.reviews);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [targetType, targetId]);

  const canReview = Boolean(user?.id && (user.role === 'shopper' || user.role === 'customer'));

  async function handleSubmit() {
    if (!user?.id) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: submitError } = await submitReview({
      targetType,
      targetId,
      reviewerId: user.id,
      overallRating: rating,
      reviewTitle: title,
      reviewText: text,
    });

    setSubmitting(false);

    if (submitError) {
      setError(submitError);
      return;
    }

    setShowForm(false);
    setTitle('');
    setText('');
    setRating(5);
    setMessage('Thanks! Your review will appear after it is approved.');
  }

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length
      : null;

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <div className="app-page-header" style={{ marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
          Reviews{reviews.length ? ` (${reviews.length})` : ''}
        </h2>
        {canReview ? (
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? 'Cancel' : 'Write a review'}
          </button>
        ) : null}
      </div>

      {average != null ? (
        <p className="app-row-meta" style={{ marginBottom: '0.75rem' }}>
          <Stars rating={average} /> {average.toFixed(1)} average
        </p>
      ) : null}

      {message ? <p className="app-message">{message}</p> : null}

      {showForm ? (
        <div className="app-card" style={{ marginBottom: '1rem' }}>
          <div className="app-input-group">
            <label htmlFor="review-rating">Rating</label>
            <select
              id="review-rating"
              className="app-select"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
          <div className="app-input-group">
            <label htmlFor="review-title">Title (optional)</label>
            <input
              id="review-title"
              className="app-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Great experience"
            />
          </div>
          <div className="app-input-group">
            <label htmlFor="review-text">Review</label>
            <textarea
              id="review-text"
              className="app-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share the details of your experience…"
            />
          </div>
          {error ? <p className="app-error">{error}</p> : null}
          <button
            type="button"
            className="app-btn app-btn--primary"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="app-row-meta">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="app-row-meta">No reviews yet.</p>
      ) : (
        <div className="app-list">
          {reviews.map((review) => (
            <div key={review.id} className="app-card">
              <Stars rating={review.overall_rating} />
              {review.review_title ? (
                <p className="app-row-title" style={{ marginTop: '0.375rem' }}>
                  {review.review_title}
                </p>
              ) : null}
              {review.review_text ? (
                <p className="app-row-meta">{review.review_text}</p>
              ) : null}
              {review.response_text ? (
                <p className="app-row-meta" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Response: {review.response_text}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
