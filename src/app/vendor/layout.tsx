import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function VendorLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome active="vendor">{children}</StudioChrome>;
}
