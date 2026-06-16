import { HeroSection, PacketSealSection } from "@/components/marketing/hero-packet-sections";
import { GoldPriceSection } from "@/components/marketing/gold-price-section";
import { UpiSection } from "@/components/marketing/upi-section";
import { FeaturesSection } from "@/components/marketing/features-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <GoldPriceSection />
      <PacketSealSection />
      <UpiSection />
      <FeaturesSection />
    </>
  );
}
