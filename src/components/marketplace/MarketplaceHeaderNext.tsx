"use client";

import Link from "next/link";
import MarketplaceHeaderBase, {
  type LinkComponent,
} from "@/components/marketplace/MarketplaceHeaderBase";

const NextLinkAdapter: LinkComponent = ({ href, ...rest }) => (
  <Link href={href} {...rest} />
);

export default function MarketplaceHeaderNext() {
  return <MarketplaceHeaderBase LinkComponent={NextLinkAdapter} />;
}
