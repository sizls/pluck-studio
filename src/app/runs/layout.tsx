import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function RunsLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="runs">{children}</BureauChrome>;
}
