// packages/brique-cyrnea/components/Icon.jsx

import React from "react";

// Import dynamique pour optimiser le bundle
const iconMap = {
  // Navigation & Actions
  music: () => import("lucide-react").then((mod) => ({ default: mod.Music })),
  gamepad2: () => import("lucide-react").then((mod) => ({ default: mod.Gamepad2 })),
  mic: () => import("lucide-react").then((mod) => ({ default: mod.Mic })),
  micOff: () => import("lucide-react").then((mod) => ({ default: mod.MicOff })),
  heart: () => import("lucide-react").then((mod) => ({ default: mod.Heart })),
  thumbsUp: () => import("lucide-react").then((mod) => ({ default: mod.ThumbsUp })),
  home: () => import("lucide-react").then((mod) => ({ default: mod.Home })),
  map: () => import("lucide-react").then((mod) => ({ default: mod.Map })),
  moreHorizontal: () => import("lucide-react").then((mod) => ({ default: mod.MoreHorizontal })),
  phone: () => import("lucide-react").then((mod) => ({ default: mod.Phone })),
  plus: () => import("lucide-react").then((mod) => ({ default: mod.Plus })),
  settings: () => import("lucide-react").then((mod) => ({ default: mod.Settings })),
  share2: () => import("lucide-react").then((mod) => ({ default: mod.Share2 })),
  thumbsDown: () => import("lucide-react").then((mod) => ({ default: mod.ThumbsDown })),
  trash2: () => import("lucide-react").then((mod) => ({ default: mod.Trash2 })),
  user: () => import("lucide-react").then((mod) => ({ default: mod.User })),
  volume2: () => import("lucide-react").then((mod) => ({ default: mod.Volume2 })),
  wind: () => import("lucide-react").then((mod) => ({ default: mod.Wind })),
  zap: () => import("lucide-react").then((mod) => ({ default: mod.Zap })),
  activity: () => import("lucide-react").then((mod) => ({ default: mod.Activity })),
  trophy: () => import("lucide-react").then((mod) => ({ default: mod.Trophy })),
  bell: () => import("lucide-react").then((mod) => ({ default: mod.Bell })),
  briefcase: () => import("lucide-react").then((mod) => ({ default: mod.Briefcase })),
  checkCircle: () => import("lucide-react").then((mod) => ({ default: mod.CheckCircle })),
  chevronDown: () => import("lucide-react").then((mod) => ({ default: mod.ChevronDown })),
  chevronUp: () => import("lucide-react").then((mod) => ({ default: mod.ChevronUp })),
  coins: () => import("lucide-react").then((mod) => ({ default: mod.Coins })),
  coffee: () => import("lucide-react").then((mod) => ({ default: mod.Coffee })),
  copy: () => import("lucide-react").then((mod) => ({ default: mod.Copy })),
  edit: () => import("lucide-react").then((mod) => ({ default: mod.Edit })),
  externalLink: () => import("lucide-react").then((mod) => ({ default: mod.ExternalLink })),
  fileImage: () => import("lucide-react").then((mod) => ({ default: mod.FileImage })),
  handshake: () => import("lucide-react").then((mod) => ({ default: mod.Handshake })),
  edit2: () => import("lucide-react").then((mod) => ({ default: mod.Edit2 })),
  x: () => import("lucide-react").then((mod) => ({ default: mod.X })),
  send: () => import("lucide-react").then((mod) => ({ default: mod.Send })),
  camera: () => import("lucide-react").then((mod) => ({ default: mod.Camera })),
  image: () => import("lucide-react").then((mod) => ({ default: mod.Image })),
  headphones: () => import("lucide-react").then((mod) => ({ default: mod.Headphones })),
  qrCode: () => import("lucide-react").then((mod) => ({ default: mod.QrCode })),
  moon: () => import("lucide-react").then((mod) => ({ default: mod.Moon })),
  users: () => import("lucide-react").then((mod) => ({ default: mod.Users })),
  shieldCheck: () => import("lucide-react").then((mod) => ({ default: mod.ShieldCheck })),
  globe: () => import("lucide-react").then((mod) => ({ default: mod.Globe })),
  volumeX: () => import("lucide-react").then((mod) => ({ default: mod.VolumeX })),
  eye: () => import("lucide-react").then((mod) => ({ default: mod.Eye })),
  radio: () => import("lucide-react").then((mod) => ({ default: mod.Radio })),
  bookOpen: () => import("lucide-react").then((mod) => ({ default: mod.BookOpen })),
  newspaper: () => import("lucide-react").then((mod) => ({ default: mod.Newspaper })),
  logIn: () => import("lucide-react").then((mod) => ({ default: mod.LogIn })),
  logOut: () => import("lucide-react").then((mod) => ({ default: mod.LogOut })),
  sparkles: () => import("lucide-react").then((mod) => ({ default: mod.Sparkles })),
  smartphone: () => import("lucide-react").then((mod) => ({ default: mod.Smartphone })),
};

export function Icon({ name, ...props }) {
  const [IconComponent, setIconComponent] = React.useState(null);

  React.useEffect(() => {
    const iconLoader = iconMap[name];
    if (iconLoader) {
      iconLoader().then(({ default: Icon }) => {
        setIconComponent(() => Icon);
      });
    }
  }, [name]);

  if (!IconComponent) {
    // Fallback placeholder
    return <div className="inline-block w-4 h-4 bg-gray-300 rounded animate-pulse" {...props} />;
  }

  return <IconComponent {...props} />;
}

// Export pour usage direct avec les icônes les plus communes
export const CommonIcons = {
  Music: () => import("lucide-react").then((mod) => mod.Music),
  Camera: () => import("lucide-react").then((mod) => mod.Camera),
  Send: () => import("lucide-react").then((mod) => mod.Send),
  X: () => import("lucide-react").then((mod) => mod.X),
  Heart: () => import("lucide-react").then((mod) => mod.Heart),
  User: () => import("lucide-react").then((mod) => mod.User),
  Home: () => import("lucide-react").then((mod) => mod.Home),
  Settings: () => import("lucide-react").then((mod) => mod.Settings),
};
