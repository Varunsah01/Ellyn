"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 640;
const DESKTOP_BREAKPOINT = 1024;

function getViewportState() {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const width = window.innerWidth;
  const isMobile = width < MOBILE_BREAKPOINT;
  const isTablet = width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT;

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
  };
}

export function useResponsive() {
  const [state, setState] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  useEffect(() => {
    const handleResize = () => {
      setState(getViewportState());
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return state;
}
