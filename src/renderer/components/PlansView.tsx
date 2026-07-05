import { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore } from "../store/uiStore";
import { Button } from "./ui/button";
import { IAP_PRODUCTS } from "../../shared/constants";
import { ProductInfo } from "../../shared/types";
import { toast } from "sonner";
import {
  ShieldCheck,
  ExternalLink,
  Zap,
  Check,
  Calendar,
  Award,
  Gem,
} from "lucide-react";

export function PlansView() {
  const { isPremium, premiumExpiresAt, premiumProductId } = useSettingsStore()
  const { setActiveView } = useUIStore()
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingProductId, setProcessingProductId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const pids = [
        IAP_PRODUCTS.PREMIUM_MONTHLY,
        IAP_PRODUCTS.PREMIUM_YEARLY,
        IAP_PRODUCTS.PREMIUM_LIFETIME,
      ];
      const storeProducts =
        (await window.electronAPI?.iap.getProducts(pids)) || [];
      setProducts(storeProducts);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (productId: string) => {
    setProcessingProductId(productId);
    const result = await window.electronAPI?.iap.purchase(productId);
    if (!result?.success) {
      toast.error(result?.error || "Failed to initiate purchase.");
    } else {
      toast.info("Purchase processing... Please follow the App Store prompts.");
    }
    setProcessingProductId(null);
  };

  const openAppStoreSubscriptions = () => {
    window.electronAPI?.openExternal("https://apps.apple.com/account/subscriptions");
  };

  const getProduct = (id: string) => products.find((p) => p.id === id);

  // Determine active plan based on specific product IDs
  const isActiveLifetime =
    isPremium &&
    (premiumProductId === IAP_PRODUCTS.PREMIUM_LIFETIME || !premiumExpiresAt);
  const isActiveMonthly =
    isPremium &&
    (premiumProductId === IAP_PRODUCTS.PREMIUM_MONTHLY ||
      (premiumProductId === undefined && premiumExpiresAt !== undefined));
  const isActiveYearly =
    isPremium && premiumProductId === IAP_PRODUCTS.PREMIUM_YEARLY;

  return (
    <div
      className="flex h-screen flex-1 flex-col items-center justify-center overflow-hidden w-full p-5 relative selection:bg-[#FF5280]/20"
      style={{
        background: `radial-gradient(circle at 0% 0%, rgba(0, 178, 255, 0.22) 0%, transparent 40%),
                     radial-gradient(circle at 100% 0%, rgba(255, 82, 128, 0.22) 0%, transparent 45%),
                     radial-gradient(circle at 10% 100%, rgba(0, 178, 255, 0.15) 0%, transparent 45%),
                     radial-gradient(circle at 100% 100%, rgba(255, 82, 128, 0.25) 0%, transparent 40%),
                     linear-gradient(135deg, #e5eeff 0%, #f4eaff 45%, #e9efff 75%, #ffebf5 100%)`,
      }}
    >
      {/* ── Productivity-themed floating decoration ───────────────────────── */}
      {/* Productivity floating decorations — no third-party branding */}
      <div className="absolute bottom-16 left-8 w-28 h-28 bg-gradient-to-br from-[#1D9BF0] to-[#0a66c2] rounded-[28px] flex items-center justify-center animate-float-slow select-none z-0 hidden lg:flex shadow-2xl" style={{ transform: 'perspective(800px) rotateX(15deg) rotateY(-20deg) rotateZ(-10deg)' }}>
        <span className="text-5xl select-none">🚀</span>
      </div>
      <div className="absolute top-[12%] right-[6%] w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full shadow-lg flex items-center justify-center animate-float-medium select-none z-0 hidden md:flex text-4xl">🤖</div>
      <div className="absolute top-[25%] left-[5%] w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center animate-float-slow z-0 text-2xl select-none hidden md:flex shadow-lg">📊</div>
      <div className="absolute bottom-[28%] right-[4%] w-12 h-12 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center animate-float-fast z-0 text-xl select-none hidden md:flex shadow-md">🌐</div>
      <div className="absolute bottom-[48%] left-[2%] w-10 h-10 bg-white/70 backdrop-blur-sm border border-white/20 rounded-full shadow flex items-center justify-center animate-float-slow z-0 text-lg select-none hidden sm:flex">🎯</div>
      <span className="absolute top-[8%] left-[15%] text-[#1D9BF0] text-xl animate-pulse select-none hidden sm:inline">✨</span>
      <span className="absolute top-[20%] right-[30%] text-[#0a66c2] text-lg animate-pulse select-none hidden md:inline">⭐</span>
      <span className="absolute bottom-[15%] left-[25%] text-amber-300 text-2xl animate-pulse select-none hidden lg:inline">✨</span>
      <span className="absolute bottom-[8%] right-[25%] text-sky-300 text-xl animate-pulse select-none hidden sm:inline">⚡</span>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl w-full flex flex-col items-center gap-4 py-2 mt-0 z-10">
        <div className="text-center space-y-2">
          <div className="mx-auto bg-green-100/90 backdrop-blur-md text-green-700 px-4 py-1.5 rounded-full text-sm font-bold w-max mb-6 flex items-center gap-2 shadow-sm border border-green-200/50">
            <ShieldCheck size={16} /> PREMIUM ACTIVE
          </div>
          <h1 className="text-4xl font-extrabold text-[#1c1e21] tracking-tight sm:text-5xl">
            Productivity Features
          </h1>
          <p className="text-[#65676b] text-base font-medium max-w-lg mx-auto">
            {isActiveLifetime
              ? "You have Lifetime Access. Thank you for your support!"
              : "Your subscription is active. All productivity tools are unlocked."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-[#1877F2] border-b-2" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl mt-2 items-stretch">
            {/* Monthly Card */}
            <PlanCard
              title="Monthly"
              icon={
                <div className="w-14 h-14 rounded-2xl border border-sky-100 bg-sky-50/70 flex items-center justify-center text-[#1877F2] shadow-sm">
                  <Calendar className="w-7 h-7" />
                </div>
              }
              price={getProduct(IAP_PRODUCTS.PREMIUM_MONTHLY)?.price || "$4.99"}
              period="/month"
              features={[
                "Full App Access",
                "Multi-Account Switching",
                "Focus Mode",
                "Cancel anytime",
              ]}
              onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_MONTHLY)}
              isProcessing={
                processingProductId === IAP_PRODUCTS.PREMIUM_MONTHLY
              }
              isAnyProcessing={processingProductId !== null}
              isActive={isActiveMonthly}
              disabled={isActiveLifetime || isActiveYearly}
              buttonStyle="border-2 border-[#1877F2] text-[#1877F2] hover:bg-[#e7f3ff] bg-transparent hover:scale-105"
            />

            {/* Yearly Card (Most Popular) */}
            <PlanCard
              title="Yearly"
              icon={
                <div className="w-14 h-14 rounded-2xl bg-[#1877F2] shadow-[0_8px_20px_rgba(24,119,242,0.25)] flex items-center justify-center text-white">
                  <Award className="w-7 h-7" />
                </div>
              }
              price={getProduct(IAP_PRODUCTS.PREMIUM_YEARLY)?.price || "$14.99"}
              period="/year"
              recommended
              trialText="3 Days Free Trial"
              features={[
                "Full App Access",
                "Multi-Account Switching",
                "Focus Mode",
                "Save over 80%",
              ]}
              onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_YEARLY)}
              isProcessing={processingProductId === IAP_PRODUCTS.PREMIUM_YEARLY}
              isAnyProcessing={processingProductId !== null}
              isActive={isActiveYearly}
              disabled={isActiveLifetime || isActiveMonthly}
              buttonStyle="bg-gradient-to-r from-[#00B2FF] via-[#8A2BE2] to-[#FF5280] text-white hover:opacity-95 shadow-[0_8px_25px_rgba(138,43,226,0.3)] border-none hover:scale-105"
            />

            {/* Life-time Card */}
            <PlanCard
              title="Life-time"
              icon={
                <div className="w-14 h-14 rounded-2xl border border-sky-100 bg-sky-50/70 flex items-center justify-center text-[#1877F2] shadow-sm">
                  <Gem className="w-7 h-7" />
                </div>
              }
              price={
                getProduct(IAP_PRODUCTS.PREMIUM_LIFETIME)?.price || "$19.99"
              }
              period=" Life-time"
              features={[
                "Pay Once, Keep Forever",
                "All Future Updates",
                "Priority Support",
                "No recurring fees",
              ]}
              onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_LIFETIME)}
              isProcessing={
                processingProductId === IAP_PRODUCTS.PREMIUM_LIFETIME
              }
              isAnyProcessing={processingProductId !== null}
              isActive={isActiveLifetime}
              disabled={isActiveLifetime}
              buttonStyle="bg-gradient-to-r from-[#FF5280] to-[#8A2BE2] text-white hover:opacity-95 shadow-[0_8px_25px_rgba(255,82,128,0.25)] border-none hover:scale-105"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface PlanCardProps {
  title: string;
  icon: React.ReactNode;
  price: string;
  period: string;
  features: string[];
  recommended?: boolean;
  onSelect: () => void;
  isProcessing: boolean;
  isAnyProcessing: boolean;
  isActive: boolean;
  disabled: boolean;
  buttonStyle: string;
  trialText?: string;
}

function PlanCard({
  title,
  icon,
  price,
  period,
  features,
  recommended,
  onSelect,
  isProcessing,
  isAnyProcessing,
  isActive,
  disabled,
  buttonStyle,
  trialText,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-[24px] p-6 transition-all duration-500 hover:-translate-y-1.5 ${
        recommended
          ? "bg-white border-2 border-[#1877F2] shadow-[0_25px_50px_rgba(24,119,242,0.16)] scale-105 z-10"
          : "bg-white/90 backdrop-blur-md border border-white/50 shadow-[0_15px_35px_rgba(0,0,0,0.04)]"
      }`}
    >
      {recommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-[0_6px_15px_rgba(24,119,242,0.3)] flex items-center gap-1 whitespace-nowrap">
          <Zap size={13} className="fill-white animate-pulse" />
          Most Popular
        </div>
      )}

      <div className="mb-4 mt-2 text-center flex flex-col items-center">
        <div className="h-14 flex items-center justify-center mb-2">{icon}</div>
        <h3 className="text-xl font-bold text-[#1c1e21] mb-1.5">{title}</h3>
        <div className="flex items-baseline justify-center gap-0.5">
          <span className="text-4xl font-extrabold text-[#1c1e21] tracking-tight">
            {price}
          </span>
          <span className="text-sm text-[#65676b] font-semibold">{period}</span>
        </div>
        {trialText && (
          <div className="mt-2.5 bg-green-50/95 backdrop-blur-md text-green-700 px-3.5 py-1 rounded-full text-xs font-bold border border-green-200/50 shadow-sm animate-pulse tracking-wide flex items-center gap-1.5 uppercase select-none">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
            {trialText}
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-5 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3">
            <div className="bg-[#e7f3ff] p-1 rounded-full shrink-0">
              <Check size={13} className="text-[#1877F2] stroke-[3px]" />
            </div>
            <span className="text-[#1c1e21] font-semibold text-sm leading-tight">
              {f}
            </span>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        onClick={onSelect}
        disabled={isAnyProcessing || isActive || disabled}
        className={`w-full py-5 text-sm font-bold rounded-xl transition-all duration-300 ${buttonStyle} ${
          isActive
            ? "bg-gray-100 text-gray-400 border-none cursor-not-allowed hover:scale-100 opacity-70"
            : ""
        }`}
      >
        {isProcessing
          ? "Processing..."
          : isActive
            ? "Current Plan"
            : trialText
              ? "Start Free Trial"
              : "Upgrade Plan"}
      </Button>
    </div>
  );
}
