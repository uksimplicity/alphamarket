import dynamic from "next/dynamic";

const AppRouter = dynamic(() => import("@/components/AppRouter"), {
  ssr: false,
});

export default function Page() {
  return <AppRouter />;
}
