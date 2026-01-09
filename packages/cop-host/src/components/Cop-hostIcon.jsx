/* ==========================================================================
   ICON COMPONENT
   Semantic icon wrapper using Lucide Icons.
   Maps semantic names to concrete icons for easy theme switching.
   ========================================================================== */

import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  User,
  Bot,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  CircleCheck,
  CircleAlert,
  Info,
  Plus,
  Minus,
} from "lucide-react";

const iconMap = {
  // Actions
  send: Send,
  "thumbs-up": ThumbsUp,
  "thumbs-down": ThumbsDown,
  close: X,
  plus: Plus,
  minus: Minus,

  // Status
  sparkle: Sparkles,
  lightning: Zap,
  success: CircleCheck,
  warning: CircleAlert,
  info: Info,

  // Entities
  user: User,
  bot: Bot,

  // Navigation
  "caret-down": ChevronDown,
  "caret-up": ChevronUp,
};

/**
 * Semantic Icon Component
 *
 * @param {string} name - Semantic icon name (e.g., 'send', 'user', 'success')
 * @param {number} size - Icon size in pixels (default: 24)
 * @param {string} className - Additional CSS classes
 * @param {object} props - Additional props passed to the icon
 */
export const Icon = ({ name, size = 24, className = "", ...props }) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(
      `Icon "${name}" not found in iconMap. Available icons:`,
      Object.keys(iconMap)
    );
    return null;
  }

  return <IconComponent size={size} className={className} {...props} />;
};

export default Icon;
