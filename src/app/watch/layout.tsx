import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function WatchLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome active="watch">{children}</StudioChrome>;
}
