"use client";

import { Link } from "react-router-dom";
import MarketplaceFooterBase, {
  type LinkComponent,
} from "@/components/marketplace/MarketplaceFooterBase";

const RouterLinkAdapter: LinkComponent = ({ href, ...rest }) => (
  <Link to={href} {...rest} />
);

export default function MarketplaceFooterRouter() {
  return <MarketplaceFooterBase LinkComponent={RouterLinkAdapter} />;
}
