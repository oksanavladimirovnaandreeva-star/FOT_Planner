import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TooltipState = {
  visible: boolean;
  positioned: boolean;
  text: string;
  x: number;
  y: number;
};

function findHintElement(target: Element | null): HTMLElement | null {
  const el = target?.closest?.("[data-hint]") as HTMLElement | null;
  if (!el) return null;
  if (el.matches("select, option, input, textarea")) return null;
  if (el.tagName === "LABEL" && el.querySelector("select, input, textarea")) return null;
  return el;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function HintTooltipLayer() {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    positioned: false,
    text: "",
    x: 0,
    y: 0,
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const anchorElRef = useRef<HTMLElement | null>(null);

  const hide = () => {
    anchorRectRef.current = null;
    anchorElRef.current = null;
    setState({ visible: false, positioned: false, text: "", x: 0, y: 0 });
  };

  const show = (el: HTMLElement) => {
    const text = el.getAttribute("data-hint");
    if (!text) return;
    anchorElRef.current = el;
    anchorRectRef.current = el.getBoundingClientRect();
    setState({ visible: true, positioned: false, text, x: 0, y: 0 });
  };

  useLayoutEffect(() => {
    if (!state.visible) return;
    const tooltip = tooltipRef.current;
    const rect = anchorRectRef.current;
    if (!tooltip || !rect) return;

    const padding = 10;
    const maxWidth = 280;
    // Trigger width/height measurement for positioning after content is applied.
    tooltip.style.maxWidth = `${maxWidth}px`;

    const { width, height } = tooltip.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Default: below, centered.
    let x = rect.left + rect.width / 2 - width / 2;
    x = clamp(x, padding, viewportW - width - padding);

    const belowY = rect.bottom + 8;
    const aboveY = rect.top - 8 - height;

    let y = belowY;
    if (belowY + height > viewportH - padding && aboveY >= padding) {
      y = aboveY;
    } else {
      y = clamp(belowY, padding, viewportH - height - padding);
    }

    setState((prev) => ({ ...prev, x, y, positioned: true }));
  }, [state.visible, state.text]);

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      const hintEl = findHintElement(event.target as Element | null);
      if (!hintEl) {
        hide();
        return;
      }
      if (hintEl === anchorElRef.current) return;
      show(hintEl);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const hintEl = anchorElRef.current;
      if (!hintEl) return;
      const related = event.relatedTarget as Element | null;
      if (related && (hintEl.contains(related) || related.closest("[data-hint]") === hintEl)) return;
      hide();
    };

    const handleScroll = () => hide();
    const handleResize = () => hide();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div
      ref={tooltipRef}
      className="hint-tooltip"
      role="tooltip"
      style={{
        position: "fixed",
        left: state.positioned ? state.x : -10000,
        top: state.positioned ? state.y : -10000,
        visibility: state.positioned ? "visible" : "hidden",
      }}
    >
      {state.text}
    </div>
  );
}

