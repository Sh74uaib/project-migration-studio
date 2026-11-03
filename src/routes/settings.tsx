import { createFileRoute, Link } from "@tanstack/react-router";
import { SettingsManager } from "@/components/settings-dialog";
import { ArrowLeft, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — API Key Management | ORION" },
      { name: "description", content: "Manage your API keys, pools, and failover router." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-[1160px] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">API Key Pool & Router Settings</h1>
              <p className="text-xs text-muted-foreground">ORION Personal Intelligence System</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>হোমে ফিরে যান</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-5 py-8">
        <SettingsManager />
      </main>
    </div>
  );
}
