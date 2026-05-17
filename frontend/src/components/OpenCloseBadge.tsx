import { useIsOpen } from '@/hooks/useIsOpen';

interface OpenCloseBadgeProps {
  hours: string | null | undefined;
  className?: string;
}

export default function OpenCloseBadge({ hours, className = '' }: OpenCloseBadgeProps) {
  const isOpen = useIsOpen(hours);

  if (isOpen === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
        isOpen
          ? 'bg-green-500/15 text-green-400 border border-green-500/20'
          : 'bg-red-500/15 text-red-400 border border-red-500/20'
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'}`}
      />
      {isOpen ? 'Open' : 'Closed'}
    </span>
  );
}