import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import { TextArea } from '@/src/components/ui/text-area';
import { useAuth } from '@/src/hooks/use-auth';
import { fetchApprovedReviews, submitReview } from '@/src/lib/reviews';
import type { Review, ReviewTargetType } from '@/src/types/database';

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
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
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

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length
      : null;

  async function handleSubmit() {
    if (!user?.id) {
      setMessage('Sign in to leave a review.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const result = await submitReview({
      targetType,
      targetId,
      reviewerId: user.id,
      overallRating: reviewRating,
      reviewTitle,
      reviewText,
    });

    setSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setReviewTitle('');
    setReviewText('');
    setReviewRating(5);
    setMessage('Thanks! Your review was submitted for moderation.');
  }

  return (
    <View>
      <Text variant="heading" className="mb-1 mt-8">
        Reviews{reviews.length ? ` (${reviews.length})` : ''}
      </Text>
      {average != null ? (
        <View className="mb-3 flex-row items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <FontAwesome
              key={index}
              name={index < Math.round(average) ? 'star' : 'star-o'}
              size={14}
              color="#D4A017"
            />
          ))}
          <Text variant="caption" className="ml-1">
            {average.toFixed(1)} average
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="mb-4">
          <LoadingIndicator />
        </View>
      ) : reviews.length === 0 ? (
        <Text variant="caption" className="mb-4">
          No approved reviews yet.
        </Text>
      ) : (
        <View className="mb-6 gap-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <View className="mb-1 flex-row items-center gap-1">
                {Array.from({ length: review.overall_rating }).map((_, index) => (
                  <FontAwesome key={index} name="star" size={14} color="#D4A017" />
                ))}
              </View>
              {review.review_title ? (
                <Text variant="body" className="mb-1 font-semibold">
                  {review.review_title}
                </Text>
              ) : null}
              {review.review_text ? <Text variant="body">{review.review_text}</Text> : null}
              {review.response_text ? (
                <Text variant="caption" className="mt-2 italic">
                  Response: {review.response_text}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      <Card className="mb-8">
        <Text variant="heading" className="mb-3">
          Write a review
        </Text>
        <View className="mb-4 flex-row items-center gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <Pressable key={rating} onPress={() => setReviewRating(rating)} hitSlop={6}>
              <FontAwesome
                name={rating <= reviewRating ? 'star' : 'star-o'}
                size={22}
                color="#D4A017"
              />
            </Pressable>
          ))}
        </View>
        <Input
          label="Title (optional)"
          value={reviewTitle}
          onChangeText={setReviewTitle}
          placeholder="Great find"
          className="mb-3"
        />
        <TextArea
          label="Review"
          value={reviewText}
          onChangeText={setReviewText}
          placeholder="Share your experience..."
          minHeight={96}
          className="mb-4"
        />
        {message ? (
          <Text variant="caption" className="mb-3">
            {message}
          </Text>
        ) : null}
        <Button label="Submit review" loading={submitting} onPress={handleSubmit} />
      </Card>
    </View>
  );
}
