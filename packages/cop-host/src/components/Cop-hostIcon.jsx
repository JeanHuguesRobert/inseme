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
  Share2,
  Brain,
  Share,
  Link,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
} from "lucide-react";

const iconMap = {
  // Actions
  send: Send,
  "thumbs-up": ThumbsUp,
  "thumbs-down": ThumbsDown,
  close: X,
  plus: Plus,
  minus: Minus,
  "share-2": Share2,
  share: Share,
  link: Link,

  // Status
  sparkle: Sparkles,
  lightning: Zap,
  success: CircleCheck,
  warning: CircleAlert,
  info: Info,

  // Entities
  user: User,
  bot: Bot,
  brain: Brain,

  // Navigation
  "caret-down": ChevronDown,
  "caret-up": ChevronUp,

  // Social
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  mail: Mail,
  x: X,
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
    console.warn(`Icon "${name}" not found in iconMap. Available icons:`, Object.keys(iconMap));
    return null;
  }

  return <IconComponent size={size} className={className} {...props} />;
};

export default Icon;
