import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function WatchLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="watch">{children}</BureauChrome>;
}
