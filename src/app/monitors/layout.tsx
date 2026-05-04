import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function MonitorsLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="monitors">{children}</BureauChrome>;
}
