// Renders children at a fixed "real" width (e.g. 1200px desktop / 390px phone) and scales
// them down to fit, so banner previews use the same breakpoints as the storefront.
import { useLayoutEffect, useRef, useState } from "react";

export default function ScaledFrame({ width, children, className = "" }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [box, setBox] = useState({ scale: 1, height: 0, left: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const available = outer.current.clientWidth;
      const scale = Math.min(1, available / width);
      setBox({
        scale,
        height: inner.current.offsetHeight * scale,
        left: Math.max(0, (available - width * scale) / 2),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer.current);
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={className} style={{ position: "relative", height: box.height, overflow: "hidden" }}>
      <div
        ref={inner}
        style={{
          position: "absolute",
          top: 0,
          left: box.left,
          width,
          maxWidth: "none", // the storefront's global `* { max-width: 100% }` would undo the fixed width
          transform: `scale(${box.scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
