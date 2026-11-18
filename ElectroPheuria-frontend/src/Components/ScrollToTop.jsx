import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fbTrack } from "../utils/fbPixel";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Scroll to top of the page when route changes
    window.scrollTo(0, 0);

    // The base pixel snippet in index.html already fires the PageView
    // for the initial load, so only track subsequent route changes here.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fbTrack("PageView");
  }, [pathname]);

  return null;
}

