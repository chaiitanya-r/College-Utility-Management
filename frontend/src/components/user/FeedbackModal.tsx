import React, { useState } from 'react';
import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (feedback: { rating: number; comment: string }) => void;
  loading?: boolean;
  utilityName?: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  utilityName,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (rating === 0) {
      newErrors.rating = 'Please select a star rating.';
    }
    if (!comment.trim() || comment.trim().length < 10) {
      newErrors.comment = 'Comment must be at least 10 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ rating, comment: comment.trim() });
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    setErrors({});
    onClose();
  };

  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800">
            Share Your Experience
          </DialogTitle>
          {utilityName && (
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              How was your experience with <span className="text-[#123458] font-bold">{utilityName}</span>?
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div>
            <Label className="block font-semibold text-sm text-slate-700 mb-2">
              Overall Rating *
            </Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => {
                    setRating(star);
                    setErrors((prev) => ({ ...prev, rating: '' }));
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={loading}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-9 h-9 transition-colors duration-150 ${
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
              {(hoverRating || rating) > 0 && (
                <span className="text-xs font-bold text-slate-500 ml-2 bg-slate-100 px-2 py-0.5 rounded-md">
                  {starLabels[hoverRating || rating]}
                </span>
              )}
            </div>
            {errors.rating && <p className="text-destructive text-xs mt-1 font-medium">{errors.rating}</p>}
          </div>

          <div>
            <Label htmlFor="feedback-comment" className="block font-semibold text-sm text-slate-700 mb-1.5">
              Your Review *
            </Label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setErrors((prev) => ({ ...prev, comment: '' }));
              }}
              placeholder="Share your experience — what went well, what could be improved..."
              rows={4}
              disabled={loading}
              className="text-sm resize-none focus-visible:ring-[#123458] rounded-xl"
            />
            <div className="flex justify-between mt-1">
              {errors.comment ? (
                <p className="text-destructive text-xs font-medium">{errors.comment}</p>
              ) : (
                <span className="text-[10px] text-slate-400">Minimum 10 characters</span>
              )}
              <span className={`text-[10px] font-semibold ${comment.trim().length >= 10 ? 'text-emerald-500' : 'text-slate-300'}`}>
                {comment.trim().length}
              </span>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
              className="rounded-xl font-semibold text-slate-600 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || rating === 0}
              className="rounded-xl font-bold bg-[#123458] hover:bg-[#0f2c48] text-white shadow-md transition-all">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" /> Submitting...</>
              ) : (
                'Submit Review'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
