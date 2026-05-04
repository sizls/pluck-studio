import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function PrivacyLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="privacy">{children}</BureauChrome>;
}
