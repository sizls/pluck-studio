import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function BureauLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome>{children}</BureauChrome>;
}
