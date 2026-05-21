interface LiquidGlassProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function LiquidGlass({
  className = '',
  children,
  style: externalStyle,
}: LiquidGlassProps) {
  return (
    <div
      className={className}
      style={{
        overflow: 'hidden',
        backdropFilter: 'blur(12px) saturate(180%) brightness(1.05) contrast(1.02)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%) brightness(1.05) contrast(1.02)',
        background: 'rgba(255, 255, 255, 0.72)',
        boxShadow:
          '0 0 0 0.5px rgba(255, 255, 255, 0.5), ' +
          '0 1px 3px rgba(0, 0, 0, 0.08), ' +
          '0 8px 32px rgba(0, 0, 0, 0.04)',
        ...externalStyle,
      }}
    >
      {children}
    </div>
  );
}

LiquidGlass.displayName = 'LiquidGlass';
