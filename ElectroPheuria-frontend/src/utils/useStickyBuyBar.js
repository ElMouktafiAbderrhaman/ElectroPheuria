// Sticky "Purchase Now" bar (phones): shown only while the page's own Purchase Now
// button is off screen, and hidden when the footer is reached so it never covers it.
import { useEffect, useState } from "react";

export default function useStickyBuyBar() {
  // Callback ref: the button appears only once the product has loaded.
  const [buttonEl, setButtonEl] = useState(null);
  const [buttonVisible, setButtonVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    if (!buttonEl) return undefined;
    const observer = new IntersectionObserver(([entry]) => setButtonVisible(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(buttonEl);
    return () => observer.disconnect();
  }, [buttonEl]);

  useEffect(() => {
    const footer = document.querySelector("footer, .footer, .site-footer");
    if (!footer) return undefined;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return { purchaseRef: setButtonEl, showSticky: !footerVisible && !(buttonEl && buttonVisible) };
}
