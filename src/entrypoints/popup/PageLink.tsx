import { focus } from './focus';
import { Chevron } from './icons';

// A row that opens a page of the popup. `focused` when Back just returned
// from that page, so the keyboard picks up where it left.
export function PageLink({
  label,
  focused,
  onOpen,
}: {
  label: string;
  focused: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      ref={focused ? focus : undefined}
      type="button"
      className="group flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-base-200"
      onClick={onOpen}
    >
      {label}
      <Chevron
        direction="right"
        className="text-base-content/50 group-hover:text-base-content"
      />
    </button>
  );
}
