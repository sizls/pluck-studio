import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function MonitorsLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome active="monitors">{children}</StudioChrome>;
}
