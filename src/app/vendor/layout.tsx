import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function VendorLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="vendor">{children}</BureauChrome>;
}
