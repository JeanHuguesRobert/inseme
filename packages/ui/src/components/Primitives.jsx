import React, { useState, useRef, useEffect, createContext, useContext } from "react";

const TabsContext = createContext(null);

export const Card = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-white/10 bg-slate-900/50 shadow-sm ${className}`}>
    {children}
  </div>
);

export const Button = ({
  children,
  className = "",
  variant = "default",
  size = "default",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-95 hover:shadow-md hover:-translate-y-0.5";
  const variants = {
    default: "bg-slate-100 text-slate-900 hover:bg-white",
    outline: "border border-white/10 bg-transparent hover:bg-white/10 hover:border-white/20",
    ghost: "hover:bg-white/10 text-slate-400 hover:text-slate-100",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-8",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Badge = ({ children, className = "", variant = "default" }) => {
  const variants = {
    default: "bg-slate-100 text-slate-900",
    outline: "text-slate-100 border border-white/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
};

export const Progress = ({ value = 0, className = "" }) => (
  <div className={`relative h-2 w-full overflow-hidden rounded-full bg-slate-800 ${className}`}>
    <div
      className="h-full w-full flex-1 bg-amber-500 transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
);

export const Avatar = ({ className = "", fallback = "U", src }) => (
  <div
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-800 ${className}`}
  >
    {src ? (
      <img src={src} className="aspect-square h-full w-full" alt="Avatar" />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-700 text-xs font-medium">
        {fallback}
      </div>
    )}
  </div>
);

export const Tabs = ({ defaultValue, children, className = "", onValueChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleValueChange = (value) => {
    setActiveTab(value);
    if (onValueChange) onValueChange(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab, onValueChange: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = "" }) => (
  <div
    className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-900/50 p-1 text-slate-400 ${className}`}
  >
    {children}
  </div>
);

export const TabsTrigger = ({ value, children, className = "" }) => {
  const context = useContext(TabsContext);
  if (!context) return null;
  const { activeTab, onValueChange } = context;

  return (
    <button
      onClick={() => onValueChange(value)}
      data-state={activeTab === value ? "active" : "inactive"}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer hover:bg-white/10 active:scale-95 ${
        activeTab === value
          ? "bg-amber-500 text-slate-950 shadow-md scale-105"
          : "hover:text-slate-100 hover:scale-105"
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = "" }) => {
  const context = useContext(TabsContext);
  if (!context) return null;
  const { activeTab } = context;

  if (activeTab !== value) return null;
  return (
    <div
      data-state={activeTab === value ? "active" : "inactive"}
      className={`mt-2 ring-offset-background focus-visible:outline-none ${className}`}
    >
      {children}
    </div>
  );
};

export const Tooltip = ({ children, content, position = "top", delay = 400 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-l-transparent border-r-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-t-transparent border-b-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <div
          className={`absolute z-[100] px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-900/95 backdrop-blur-sm border border-white/5 rounded-lg shadow-xl whitespace-normal break-words max-w-[200px] pointer-events-none animate-in fade-in zoom-in duration-200 ${positionClasses[position]}`}
        >
          {content}
          <div
            className={`absolute border-4 ${arrowClasses[position]}`}
            style={{ content: '""' }}
          />
        </div>
      )}
    </div>
  );
};
