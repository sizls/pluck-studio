import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function RunsLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome active="runs">{children}</StudioChrome>;
}
