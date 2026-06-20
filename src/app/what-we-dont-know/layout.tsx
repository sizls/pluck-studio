import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

export default function WhatWeDontKnowLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <StudioChrome active="what-we-dont-know">{children}</StudioChrome>;
}
