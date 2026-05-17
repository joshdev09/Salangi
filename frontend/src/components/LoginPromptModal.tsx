import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import { X } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

const FEATURE_MESSAGES: Record<string, { title: string; description: string }> = {
  save: {
    title: 'Save Your Favorite Spots',
    description: 'Create an account to save and revisit your favorite local businesses anytime.',
  },
  review: {
    title: 'Share Your Experience',
    description: 'Sign in to leave a review and help others discover great local spots.',
  },
  'list-business': {
    title: 'List Your Business',
    description: 'Sign in or create a business account to put your business on the map.',
  },
  default: {
    title: 'Sign In to Continue',
    description: 'You need an account to access this feature. It only takes a minute to join!',
  },
};

function LoginPromptModal({ isOpen, onClose, featureName = 'default' }: LoginPromptModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const { title, description } = FEATURE_MESSAGES[featureName] ?? FEATURE_MESSAGES.default;

  const handleSignIn = () => {
    onClose();
    navigate(ROUTES.SIGN_IN);
  };

  const handleSignUp = () => {
    onClose();
    navigate('/sign-up');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm bg-[#1E1E1E] border border-white/10 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FFE2A0]/10 border border-[#FFE2A0]/20 mb-4 mx-auto">
          <span className="text-2xl">
            {featureName === 'save' ? '🔖' : featureName === 'review' ? '⭐' : '✨'}
          </span>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-[#FBFAF8] mb-2">{title}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSignIn}
            className="w-full bg-[#FFE2A0] text-[#1A1A1A] font-bold py-3 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            Sign In
          </button>
          <button
            onClick={handleSignUp}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-[#FBFAF8] font-medium py-3 rounded-xl text-sm active:scale-95 transition-all cursor-pointer"
          >
            Create Account
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-4">
          It's free and only takes a minute
        </p>
      </div>
    </div>,
    document.body
  );
}

export default LoginPromptModal;