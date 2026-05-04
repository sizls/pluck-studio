import { BureauChrome } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export default function WhatWeDontKnowLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <BureauChrome active="what-we-dont-know">{children}</BureauChrome>;
}
