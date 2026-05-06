import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function McpLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome>{children}</BureauChrome>;
}
