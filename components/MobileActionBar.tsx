import React from 'react';
import { Save, X, Trash2, LogOut } from 'lucide-react';

/**
 * Mobile Action Bar
 * Sticky button bar positioned above bottom navigation
 * Touch-friendly with large buttons for mobile forms
 */

interface MobileActionBarProps {
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onCancel?: () => void;
  isPrimaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  isSecondaryDisabled?: boolean;
  variant?: 'save' | 'delete' | 'custom';
}

export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  primaryLabel = 'Save',
  secondaryLabel = 'Cancel',
  onPrimary,
  onSecondary,
  onCancel,
  isPrimaryLoading = false,
  isPrimaryDisabled = false,
  isSecondaryDisabled = false,
  variant = 'save'
}) => {
  if (!onPrimary && !onSecondary && !onCancel) return null;

  const getPrimaryIcon = () => {
    if (isPrimaryLoading) return null;
    switch (variant) {
      case 'delete':
        return <Trash2 size={20} />;
      case 'save':
      default:
        return <Save size={20} />;
    }
  };

  const getPrimaryColor = () => {
    switch (variant) {
      case 'delete':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'save':
      default:
        return isPrimaryDisabled
          ? 'bg-slate-200 text-gray-600 cursor-not-allowed'
          : 'bg-fcGold hover:bg-fcGold/90 text-white';
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t border-fcDivider shadow-lg safe-area-inset-bottom px-4 py-4 z-40">
      <div className="flex gap-3 max-w-2xl mx-auto">
        {/* Primary Action */}
        <button
          onClick={onPrimary}
          disabled={isPrimaryDisabled || isPrimaryLoading}
          className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all font-sans ${getPrimaryColor()}`}
        >
          {isPrimaryLoading ? (
            <>
              <div className="animate-spin">⟳</div>
              Saving...
            </>
          ) : (
            <>
              {getPrimaryIcon()}
              {primaryLabel}
            </>
          )}
        </button>

        {/* Secondary Actions */}
        {(onSecondary || onCancel) && (
          <button
            onClick={onSecondary || onCancel}
            disabled={isSecondaryDisabled}
            className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all font-sans ${
              isSecondaryDisabled
                ? 'bg-slate-100 text-gray-600 cursor-not-allowed'
                : 'bg-slate-100 text-fcSlate hover:bg-slate-200'
            }`}
          >
            <X size={20} />
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Mobile Single Button
 * For simple actions like "Send" or "Reserve"
 */
export const MobileActionButton: React.FC<{
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}> = ({ label, onClick, isLoading = false, isDisabled = false, variant = 'primary' }) => {
  const colorClasses = {
    primary: isDisabled ? 'bg-slate-200 text-gray-600' : 'bg-fcGold text-white hover:bg-fcGold/90',
    secondary: isDisabled ? 'bg-slate-200 text-gray-600' : 'bg-slate-100 text-fcSlate hover:bg-slate-200',
    danger: isDisabled ? 'bg-slate-200 text-gray-600' : 'bg-red-500 text-white hover:bg-red-600'
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled || isLoading}
      className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all font-sans ${colorClasses[variant]}`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin">⟳</div>
          Loading...
        </div>
      ) : (
        label
      )}
    </button>
  );
};
