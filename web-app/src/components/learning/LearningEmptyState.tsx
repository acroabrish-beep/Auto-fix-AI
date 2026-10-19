import React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';

interface LearningEmptyStateProps {
  title?: string;
  message?: string;
  onAction?: () => void;
  actionText?: string;
}

export const LearningEmptyState: React.FC<LearningEmptyStateProps> = ({
  title = "No learning modules available yet.",
  message = "Check back soon for new automotive, electrical and electronics courses.",
  onAction,
  actionText
}) => {
  return (
    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
        <BookOpen className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-8">{message}</p>
      {onAction && actionText && (
        <Button onClick={onAction}>{actionText}</Button>
      )}
    </div>
  );
};
