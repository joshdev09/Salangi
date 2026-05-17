import { useState } from 'react';
import { useAuth } from '@/context/authContext';

/**
 * useGuestGuard — intercepts actions that require authentication.
 *
 * Usage:
 *   const { guardAction, loginPromptProps } = useGuestGuard();
 *
 *   // Wrap any action that needs auth:
 *   <button onClick={() => guardAction('save', () => doSave())}>Save</button>
 *
 *   // Render the modal anywhere in the component tree:
 *   <LoginPromptModal {...loginPromptProps} />
 */
export function useGuestGuard() {
  const { session } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [promptFeature, setPromptFeature] = useState<string>('default');

  /**
   * Runs `action` if the user is logged in, otherwise opens the login prompt.
   * @param featureName  Key into FEATURE_MESSAGES in LoginPromptModal
   * @param action       Callback to execute when the user IS authenticated
   */
  const guardAction = (featureName: string, action: () => void) => {
    if (session) {
      action();
    } else {
      setPromptFeature(featureName);
      setShowLoginPrompt(true);
    }
  };

  const loginPromptProps = {
    isOpen: showLoginPrompt,
    onClose: () => setShowLoginPrompt(false),
    featureName: promptFeature,
  };

  return { guardAction, loginPromptProps };
}