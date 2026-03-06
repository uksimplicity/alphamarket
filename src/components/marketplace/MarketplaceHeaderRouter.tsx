"use client";

import { Link } from "react-router-dom";
import MarketplaceHeaderBase, {
  type LinkComponent,
} from "@/components/marketplace/MarketplaceHeaderBase";

const RouterLinkAdapter: LinkComponent = ({ href, ...rest }) => {
  if (href.startsWith("/dashboard")) {
    return <a href={href} {...rest} />;
  }
  return <Link to={href} {...rest} />;
};

export default function MarketplaceHeaderRouter() {
  return <MarketplaceHeaderBase LinkComponent={RouterLinkAdapter} />;
}
