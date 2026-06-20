import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function McpLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome>{children}</StudioChrome>;
}
