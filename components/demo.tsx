import { InteractiveProductCard } from "./ui/card-7";
import { Trophy, Shield, Activity } from "lucide-react";

export default function InteractiveProductCardDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full">
        {/* Pro Football */}
        <InteractiveProductCard
          title="Pro Football"
          description="FIFA Approved Match Ball"
          price="$39"
          imageUrl="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=2835&auto=format&fit=crop"
          icon={<Activity size={24} />}
        />

        {/* Cricket Bat */}
        <InteractiveProductCard
          title="Pro Cricket Bat"
          description="Premium English Willow"
          price="$199"
          imageUrl="https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2938&auto=format&fit=crop"
          icon={<Trophy size={24} />}
        />

        {/* Cricket Helmet */}
        <InteractiveProductCard
          title="Pro Cricket Helmet"
          description="Ultimate Head Protection"
          price="$89"
          imageUrl="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2930&auto=format&fit=crop"
          icon={<Shield size={24} />}
        />

        {/* Hockey Stick */}
        <InteractiveProductCard
          title="Elite Hockey Stick"
          description="Carbon Fiber Build"
          price="$149"
          imageUrl="https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?q=80&w=2787&auto=format&fit=crop"
          icon={<Activity size={24} />}
        />
      </div>
    </div>
  );
}
