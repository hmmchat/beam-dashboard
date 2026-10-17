import { ProductAnalyticsSection } from "@/components/sections/ProductAnalyticsSection";

export default function ProductAnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Product</h1>
      <p className="text-sm text-muted-foreground mb-6">
        How the product is doing, for the team and for an investor conversation.
      </p>
      <ProductAnalyticsSection />
    </div>
  );
}
