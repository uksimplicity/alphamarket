"use client";

import Link from "next/link";
import MarketplaceFooterBase, {
  type LinkComponent,
} from "@/components/marketplace/MarketplaceFooterBase";

const NextLinkAdapter: LinkComponent = ({ href, ...rest }) => (
  <Link href={href} {...rest} />
);

export default function MarketplaceFooterNext() {
  return <MarketplaceFooterBase LinkComponent={NextLinkAdapter} />;
}
