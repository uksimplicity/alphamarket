"use client";

import { Link } from "react-router-dom";
import NextLink from "next/link";
import MarketplaceHeaderBase, {
  type LinkComponent,
} from "@/components/marketplace/MarketplaceHeaderBase";

const RouterLinkAdapter: LinkComponent = ({ href, ...rest }) => {
  if (["/dashboard", "/admin", "/products/", "/store/", "/ads"].some(path => href.startsWith(path))) {
    return <NextLink href={href} {...rest} />;
  }
  return <Link to={href} {...rest} />;
};

export default function MarketplaceHeaderRouter() {
  return <MarketplaceHeaderBase LinkComponent={RouterLinkAdapter} />;
}
