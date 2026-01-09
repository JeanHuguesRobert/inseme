// src/components/layout/GestureHeaderMenu.jsx

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MOVEMENT_NAME, PARTY_NAME, CITY_NAME } from "../../constants.js";
import { useCurrentUser } from "@inseme/cop-host";
import { getSupabase } from "../../lib/supabase.js";
import { isFeatureEnabled, FEATURES } from "../../lib/features.js";
import FacebookPagePlugin from "../common/FacebookPagePlugin";
import { BRIQUES } from "../../generated/brique-registry.js";

// This component replaces the modal hamburger menu with a gesture-revealed header menu
// On mobile: disabled auto-trigger, shows a small hamburger button instead
// On desktop: auto-triggers after repeated scroll attempts at edge

// Directions supported: top, bottom, left, right
const DIRECTIONS = ["top", "bottom", "left", "right"];

// Detect if device is mobile (touch-primary device with small screen)
function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  return hasTouchScreen && isSmallScreen;
}

export default function GestureHeaderMenu({ activeEdges = ["top"] }) {
  const [openDirection, setOpenDirection] = useState(null); // null or "top"/"bottom"/"left"/"right"
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileButton, setShowMobileButton] = useState(false);
  const { currentUser } = useCurrentUser();

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileDevice());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On mobile: show hamburger button when user scrolls to top
  useEffect(() => {
    if (!isMobile) {
      setShowMobileButton(false);
      return;
    }

    let lastScrollY = window.scrollY;
    let scrollingUp = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      scrollingUp = currentScrollY < lastScrollY;
      lastScrollY = currentScrollY;

      // Show button when near top and scrolling up, or at very top
      if (currentScrollY < 100 && scrollingUp) {
        setShowMobileButton(true);
      } else if (currentScrollY > 200) {
        setShowMobileButton(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Gesture detection refs
  const touchStart = useRef({ x: null, y: null });
  const touchActive = useRef(false);
  const touchTotal = useRef({ x: 0, y: 0 });
  const touchAttempts = useRef({ top: 0, bottom: 0, left: 0, right: 0 });
  const touchTimeoutRef = useRef({ top: null, bottom: null, left: null, right: null });

  // Desktop: repeated scroll at edge
  const wheelAttempts = useRef({ top: 0, bottom: 0, left: 0, right: 0 });
  const wheelTimeoutRef = useRef({ top: null, bottom: null, left: null, right: null });

  // Helper: get gesture direction
  function getGestureDirection(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) return "right";
      if (dx < 0) return "left";
    } else {
      if (dy > 0) return "bottom";
      if (dy < 0) return "top";
    }
    return null;
  }

  // Touch gesture logic
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      touchStart.current = { x, y };
      touchActive.current = true;
      touchTotal.current = { x: 0, y: 0 };
    }
  };

  const handleTouchMove = (e) => {
    if (!touchActive.current || touchStart.current.x == null || touchStart.current.y == null)
      return;
    if (e.touches && e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - touchStart.current.x;
      const dy = y - touchStart.current.y;
      const direction = getGestureDirection(touchStart.current, { x, y });
      if (!activeEdges.includes(direction)) return;
      // Only trigger if at edge
      let atEdge = false;
      if (direction === "top" && window.scrollY < 100) atEdge = true;
      if (
        direction === "bottom" &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 5
      )
        atEdge = true;
      if (direction === "left" && x < 20) atEdge = true;
      if (direction === "right" && x > window.innerWidth - 20) atEdge = true;
      if (!atEdge) return;
      // Accumulate distance
      touchTotal.current.x += dx;
      touchTotal.current.y += dy;
      // Long drag (>100px) opens immediately
      if (
        !openDirection &&
        ((direction === "top" && -touchTotal.current.y > 100) ||
          (direction === "bottom" && touchTotal.current.y > 100) ||
          (direction === "left" && -touchTotal.current.x > 100) ||
          (direction === "right" && touchTotal.current.x > 100))
      ) {
        setOpenDirection(direction);
        touchAttempts.current[direction] = 0;
        touchTotal.current = { x: 0, y: 0 };
        return;
      }
      // Short drag (>30px) counts as attempt
      if (
        ((direction === "top" && -dy > 30) ||
          (direction === "bottom" && dy > 30) ||
          (direction === "left" && -dx > 30) ||
          (direction === "right" && dx > 30)) &&
        !openDirection
      ) {
        touchAttempts.current[direction] += 1;
        if (touchAttempts.current[direction] >= 3) {
          setOpenDirection(direction);
          touchAttempts.current[direction] = 0;
          touchTotal.current = { x: 0, y: 0 };
          return;
        }
        // Reset after 800ms inactivity
        if (touchTimeoutRef.current[direction]) {
          clearTimeout(touchTimeoutRef.current[direction]);
        }
        touchTimeoutRef.current[direction] = setTimeout(() => {
          touchAttempts.current[direction] = 0;
          touchTotal.current = { x: 0, y: 0 };
        }, 800);
      }
      // Reset start for next move
      touchStart.current = { x, y };
    }
  };

  const handleTouchEnd = () => {
    touchActive.current = false;
    touchStart.current = { x: null, y: null };
    touchTotal.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    // On mobile, disable automatic gesture triggers
    if (isMobile) return;

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      DIRECTIONS.forEach((dir) => {
        if (touchTimeoutRef.current[dir]) clearTimeout(touchTimeoutRef.current[dir]);
      });
    };
  }, [openDirection, activeEdges, isMobile]);

  useEffect(() => {
    // On mobile, disable automatic wheel triggers
    if (isMobile) return;

    const handleWheel = (e) => {
      if (openDirection) return;

      // Top: Trigger when at top (scrollY < 25) and scrolling UP (deltaY < 0)
      // Note: deltaY < 0 means scrolling UP (pulling down content)
      if (activeEdges.includes("top") && window.scrollY < 25 && e.deltaY < 0) {
        wheelAttempts.current.top += 1;
        if (wheelAttempts.current.top >= 3) {
          setOpenDirection("top");
          wheelAttempts.current.top = 0;
          return;
        }
        if (wheelTimeoutRef.current.top) clearTimeout(wheelTimeoutRef.current.top);
        wheelTimeoutRef.current.top = setTimeout(() => {
          wheelAttempts.current.top = 0;
        }, 800);
      }

      // Bottom: Trigger when at bottom and scrolling DOWN (deltaY > 0)
      if (
        activeEdges.includes("bottom") &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 5 &&
        e.deltaY > 0
      ) {
        wheelAttempts.current.bottom += 1;
        if (wheelAttempts.current.bottom >= 3) {
          setOpenDirection("bottom");
          wheelAttempts.current.bottom = 0;
          return;
        }
        if (wheelTimeoutRef.current.bottom) clearTimeout(wheelTimeoutRef.current.bottom);
        wheelTimeoutRef.current.bottom = setTimeout(() => {
          wheelAttempts.current.bottom = 0;
        }, 800);
      }

      // Left: Trigger when at left edge and scrolling LEFT (deltaX < 0)
      if (activeEdges.includes("left") && e.deltaX < 0 && window.scrollX < 25) {
        wheelAttempts.current.left += 1;
        if (wheelAttempts.current.left >= 3) {
          setOpenDirection("left");
          wheelAttempts.current.left = 0;
          return;
        }
        if (wheelTimeoutRef.current.left) clearTimeout(wheelTimeoutRef.current.left);
        wheelTimeoutRef.current.left = setTimeout(() => {
          wheelAttempts.current.left = 0;
        }, 800);
      }

      // Right: Trigger when at right edge and scrolling RIGHT (deltaX > 0)
      if (
        activeEdges.includes("right") &&
        e.deltaX > 0 &&
        window.scrollX > window.innerWidth - 25
      ) {
        wheelAttempts.current.right += 1;
        if (wheelAttempts.current.right >= 3) {
          setOpenDirection("right");
          wheelAttempts.current.right = 0;
          return;
        }
        if (wheelTimeoutRef.current.right) clearTimeout(wheelTimeoutRef.current.right);
        wheelTimeoutRef.current.right = setTimeout(() => {
          wheelAttempts.current.right = 0;
        }, 800);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      DIRECTIONS.forEach((dir) => {
        if (wheelTimeoutRef.current[dir]) clearTimeout(wheelTimeoutRef.current[dir]);
      });
    };
  }, [openDirection, activeEdges, isMobile]);

  // Close menu logic
  const closeMenu = () => setOpenDirection(null);

  // Mobile hamburger button handler
  const handleMobileMenuOpen = () => {
    setOpenDirection("top");
    setShowMobileButton(false);
  };

  // Render panel for open direction using Portal to escape parent container constraints
  return createPortal(
    <>
      {/* Mobile hamburger button - appears on scroll up near top */}
      {isMobile && showMobileButton && !openDirection && (
        <button
          onClick={handleMobileMenuOpen}
          aria-label="Ouvrir le menu"
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            zIndex: 999,
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "var(--color-bg-app)",
            border: "1px solid var(--color-border-medium)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            opacity: 0.9,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-content-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          style={{
            position: "fixed",
            top: dir === "top" ? 0 : undefined,
            bottom: dir === "bottom" ? 0 : undefined,
            left: dir === "left" ? 0 : undefined,
            right: dir === "right" ? 0 : undefined,
            width: dir === "top" || dir === "bottom" ? "100%" : "16rem",
            height: dir === "top" || dir === "bottom" ? "auto" : "100%",
            zIndex: 1000,
            background: "var(--color-bg-app)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "transform 0.3s var(--ease-smooth)",
            transform:
              openDirection === dir
                ? "none"
                : dir === "top"
                  ? "translateY(-100%)"
                  : dir === "bottom"
                    ? "translateY(100%)"
                    : dir === "left"
                      ? "translateX(-100%)"
                      : "translateX(100%)",
            borderBottom: dir === "top" ? "1px solid var(--color-border-medium)" : undefined,
            borderTop: dir === "bottom" ? "1px solid var(--color-border-medium)" : undefined,
            borderRight: dir === "left" ? "1px solid var(--color-border-medium)" : undefined,
            borderLeft: dir === "right" ? "1px solid var(--color-border-medium)" : undefined,
            pointerEvents: openDirection === dir ? "auto" : "none",
          }}
        >
          {openDirection === dir && (
            <nav
              style={{
                padding: "12px 10px 10px 10px", // reduced vertical padding
                maxWidth: "20rem",
                margin: "0 auto",
                width: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: "8px", // reduced
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--color-content-primary)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Navigation {MOVEMENT_NAME}
                </span>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={closeMenu}
                  aria-label="Fermer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: 18, height: 18, color: "var(--color-content-primary)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                {[
                  { to: "/", label: "Consultation", feature: FEATURES.CONSULTATIONS },
                  { to: "/kudocracy", label: "Propositions", feature: FEATURES.CONSULTATIONS },
                  { to: "/bob", label: "Ophélia", feature: FEATURES.CHATBOT },
                  { to: "/transparence", label: "Transparence", feature: FEATURES.TRANSPARENCY },
                  { to: "/social", label: "Social", feature: FEATURES.SOCIAL },
                  { to: "/actes", label: "Actes", feature: FEATURES.ACTES },
                  // Dynamic items from briques
                  ...BRIQUES.flatMap((b) =>
                    (b.menuItems || [])
                      .filter((m) => m.position === "header")
                      .map((m) => ({ to: m.path, label: m.label, feature: b.feature }))
                  ),
                ]
                  .filter((item) => !item.feature || isFeatureEnabled(item.feature, true))
                  .map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={closeMenu}
                        style={{
                          color: "var(--color-content-primary)",
                          textDecoration: "none",
                          fontWeight: 500,
                          fontSize: "0.95em",
                          padding: "2px 8px",
                          transition: "background var(--duration-fast) ease",
                          display: "inline-block",
                        }}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
              </ul>
              {/* Auth section */}
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--color-border-medium)",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px", // reduced
                }}
              >
                {currentUser ? (
                  <div
                    style={{
                      padding: "2px 0",
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <Link
                      to="/subscriptions"
                      onClick={closeMenu}
                      style={{
                        color: "var(--color-content-primary)",
                        textDecoration: "none",
                        fontWeight: 500,
                        fontSize: "0.90em",
                        padding: "2px 8px",
                        width: "100%",
                        textAlign: "center",
                      }}
                    >
                      🔔 Vos abonnements
                    </Link>
                    <button
                      onClick={async () => {
                        await getSupabase().auth.signOut();
                        closeMenu();
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--color-content-primary)",
                        color: "var(--color-content-primary)",
                        padding: "2px 8px",
                        fontSize: "0.90em",
                        fontWeight: 600,
                        cursor: "pointer",
                        width: "100%",
                        marginTop: "2px",
                      }}
                    >
                      Déconnexion
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={closeMenu}
                    style={{
                      background: "var(--color-action-primary)",
                      color: "var(--color-bg-app)",
                      border: "none",
                      padding: "2px 8px",
                      fontSize: "0.90em",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: "100%",
                      textTransform: "uppercase",
                    }}
                  >
                    🔐 Connexion / Inscription
                  </button>
                )}
              </div>
              {/* Facebook Page Plugin */}
              <div style={{ marginTop: "12px", width: "100%" }}>
                <FacebookPagePlugin />
              </div>
            </nav>
          )}
        </div>
      ))}
    </>,
    document.body
  );
}
