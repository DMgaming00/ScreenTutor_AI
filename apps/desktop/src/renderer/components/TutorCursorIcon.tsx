interface Props {
  size?: number;
  className?: string;
}

export default function TutorCursorIcon({ size = 28, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 2 L20 12 L4 22 Z"
        fill="#3b82f6"
        transform="rotate(-35 12 12)"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.75))' }}
      />
    </svg>
  );
}
