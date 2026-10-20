import type { ReactNode } from "react";

/** Re-created at each page change: the new page fades in (150 ms). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}
