import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  useApiKeyStore,
  type ApiKeyItem,
} from "@/lib/api-key-store";
import { usePersisted } from "@/components/personal-tools";
import {
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Clock,
  Key,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Bot,
  Sparkles,
} from "lucide-react";

export const DEFAULT_AGENTS = [
  { name: "Bangladesh", desc: "Local coverage, every district." },
  { name: "World", desc: "Global affairs, distilled." },
  { name: "India", desc: "Regional news & analysis." },
  { name: "Politics", desc: "Policy, power, elections." },
  { name: "Business", desc: "Markets & the economy." },
  { name: "Technology", desc: "Startups, science & space." },
  { name: "Cybersecurity", desc: "Threats & breaches." },
  { name: "Developer News", desc: "Tools, launches, releases." },
  { name: "Research", desc: "Papers & discoveries." },
  { name: "Gaming", desc: "Releases & esports." },
  { name: "Health", desc: "Medicine & wellbeing." },
  { name: "Environment", desc: "Climate & nature." },
];

export const ALL_PROVIDERS = [
  "Groq",
  "Gemini",
  "OpenRouter",
  "Mistral",
  "Tavily",
  "You.com",
  "Exa",
  "Serper",
  "SerpAPI",
  "Oolostep",
  "NewsData.io",
  "Gnews",
  "NewsAPI.org",
  "FreenewsAPI.io",
  "Marketaux",
  "Currentnewsapi.services",
  "GitHub",
  "HuggingFace",
] as const;

export type ProviderName = (typeof ALL_PROVIDERS)[number] | string;

function formatRemainingTime(resetAt: number | null): string {
  if (!resetAt) return "শীঘ্রই";
  const diff = resetAt - Date.now();
  if (diff <= 0) return "এখনই সক্রিয় হবে";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours} ঘণ্টা ${mins} মিনিট পর রিসেট`;
  }
  return `${mins} মিনিট পর রিসেট`;
}

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 7)}••••${key.slice(-4)}`;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider?: string;
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialProvider,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-border bg-background">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Settings & Management
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  API কী পুল, স্মার্ট রাউটার এবং সেক্টর এজেন্ট পরিচালনা
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SettingsManager {...(initialProvider !== undefined ? { defaultSelectedProvider: initialProvider } : {})} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsManager({
  defaultSelectedProvider,
}: {
  defaultSelectedProvider?: string;
}) {
  const {
    keys,
    providers,
    alerts,
    addKey,
    updateKey,
    deleteKey,
    resetKey,
    markAlertRead,
    providerAllExhausted,
    checkQuotaReset,
  } = useApiKeyStore();

  const [customAgents, setCustomAgents] = usePersisted<{ name: string; desc: string }[]>(
    "orion.customAgents",
    [],
  );
  const [hiddenAgents, setHiddenAgents] = usePersisted<string[]>("orion.hiddenAgents", []);

  const [activeTab, setActiveTab] = useState<string>(defaultSelectedProvider || "overview");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Key form states
  const [formProvider, setFormProvider] = useState<string>("Groq");
  const [formLabel, setFormLabel] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Agent form states
  const [agentFormOpen, setAgentFormOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);

  // Auto-refresh countdown every 30 seconds
  const [, setTicker] = useState(0);
  useEffect(() => {
    checkQuotaReset();
    const interval = setInterval(() => {
      setTicker((prev) => prev + 1);
      checkQuotaReset();
    }, 30 * 1000);
    return () => clearInterval(interval);
  }, [checkQuotaReset]);

  useEffect(() => {
    if (defaultSelectedProvider) {
      setActiveTab(defaultSelectedProvider);
    }
  }, [defaultSelectedProvider]);

  const activeKeysCount = keys.filter((k) => k.status === "active").length;
  const exhaustedKeysCount = keys.filter((k) => k.status === "quota_exhausted").length;

  const handleOpenAddKey = (preselectedProvider?: string) => {
    setEditingId(null);
    setFormProvider(preselectedProvider || (activeTab !== "overview" && activeTab !== "agents" ? activeTab : "Groq"));
    setFormLabel("");
    setFormApiKey("");
    setFormEmail("");
    setShowSecret(false);
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenEditKey = (key: ApiKeyItem) => {
    setEditingId(key.id);
    setFormProvider(key.provider);
    setFormLabel(key.label);
    setFormApiKey(key.apiKey);
    setFormEmail(key.emailAccount || "");
    setShowSecret(false);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProvider.trim()) {
      setFormError("প্রোভাইডার নির্বাচন করুন");
      return;
    }
    if (!formLabel.trim()) {
      setFormError("কী-এর একটি পরিচিতিমূলক লেবেল দিন (যেমন: groq-1)");
      return;
    }
    if (!formApiKey.trim()) {
      setFormError("API Key দিন");
      return;
    }

    if (editingId) {
      updateKey(editingId, {
        provider: formProvider.trim(),
        label: formLabel.trim(),
        apiKey: formApiKey.trim(),
        emailAccount: formEmail.trim() || null,
      });
    } else {
      addKey({
        provider: formProvider.trim(),
        label: formLabel.trim(),
        apiKey: formApiKey.trim(),
        emailAccount: formEmail.trim() || null,
        status: "active",
      });
    }

    setFormOpen(false);
    setActiveTab(formProvider.trim());
  };

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    const name = agentName.trim();
    const desc = agentDesc.trim();
    if (!name) {
      setAgentError("এজেন্টের একটি নাম দিন");
      return;
    }

    // Check if matching a hidden default agent
    if (DEFAULT_AGENTS.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      const match = DEFAULT_AGENTS.find((a) => a.name.toLowerCase() === name.toLowerCase())!;
      setHiddenAgents(hiddenAgents.filter((h) => h !== match.name));
      setAgentFormOpen(false);
      setAgentName("");
      setAgentDesc("");
      return;
    }

    // Check if already in custom agents
    if (customAgents.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setAgentError("এই নামের এজেন্ট ইতোমধ্যে বিদ্যমান আছে");
      return;
    }

    setCustomAgents([...customAgents, { name, desc: desc || "Your custom intelligence agent." }]);
    setAgentFormOpen(false);
    setAgentName("");
    setAgentDesc("");
    setAgentError(null);
  };

  const handleDeleteCustomAgent = (name: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত "${name}" কাস্টম এজেন্টটি ডিলিট করতে চান?`)) {
      setCustomAgents(customAgents.filter((c) => c.name !== name));
    }
  };

  const handleToggleHideDefaultAgent = (name: string) => {
    if (hiddenAgents.includes(name)) {
      setHiddenAgents(hiddenAgents.filter((h) => h !== name));
    } else {
      setHiddenAgents([...hiddenAgents, name]);
    }
  };

  const unreadAlerts = alerts.filter((a) => !a.read);
  const exhaustedProviders = providers.filter((p) => providerAllExhausted(p));
  const totalVisibleAgents = DEFAULT_AGENTS.length + customAgents.length - hiddenAgents.length;

  return (
    <div className="space-y-6">
      {/* Active Exhausted Alerts Banner */}
      {(unreadAlerts.length > 0 || exhaustedProviders.length > 0) && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>কোটা শেষ হওয়ার সতর্কবার্তা</span>
          </div>
          <div className="space-y-2">
            {unreadAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-3 text-xs bg-background/80 rounded-lg p-2.5 border border-destructive/20 text-foreground"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-destructive">[{alert.provider}]</span>
                  <span>{alert.message}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2.5"
                    onClick={() => handleOpenAddKey(alert.provider)}
                  >
                    + নতুন কী যোগ করুন
                  </Button>
                  <button
                    onClick={() => markAlertRead(alert.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-border">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">মোট সংরক্ষিত কী</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{keys.length}</div>
            <p className="text-[11px] text-muted-foreground">{providers.length} টি সার্ভিসের আওতায়</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">সক্রিয় কী (Active)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {activeKeysCount}
            </div>
            <p className="text-[11px] text-muted-foreground">স্বয়ংক্রিয় রাউটিংয়ে যুক্ত</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">কোটা শেষ (Cooldown)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {exhaustedKeysCount}
            </div>
            <p className="text-[11px] text-muted-foreground">২৪ ঘণ্টায় স্বয়ংক্রিয় রিসেট হবে</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">সেক্টর এজেন্টসমূহ</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-brand">{totalVisibleAgents}</div>
            <p className="text-[11px] text-muted-foreground">{customAgents.length} টি কাস্টম তৈরি</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs List */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
            <div className="overflow-x-auto pb-1 flex-1">
              <TabsList className="bg-muted/50 p-1 flex h-auto min-w-max gap-1">
                <TabsTrigger value="overview" className="text-xs px-3 py-1.5">
                  সারসংক্ষেপ (Overview)
                </TabsTrigger>
                <TabsTrigger
                  value="agents"
                  className="text-xs px-3 py-1.5 flex items-center gap-1.5 font-medium"
                >
                  <Bot className="h-3.5 w-3.5 text-brand" />
                  <span>এজেন্টসমূহ (Agents)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand-soft text-brand font-bold">
                    {totalVisibleAgents}
                  </span>
                </TabsTrigger>
                {providers.map((p) => {
                  const count = keys.filter((k) => k.provider.toLowerCase() === p.toLowerCase()).length;
                  const isAllExhausted = providerAllExhausted(p);
                  return (
                    <TabsTrigger
                      key={p}
                      value={p}
                      className="text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <span>{p}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isAllExhausted
                            ? "bg-destructive/20 text-destructive font-bold"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "agents" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setAgentName("");
                    setAgentDesc("");
                    setAgentError(null);
                    setAgentFormOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>কাস্টম এজেন্ট তৈরি করুন</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleOpenAddKey(activeTab !== "overview" ? activeTab : undefined)}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>নতুন কী যোগ করুন</span>
                </Button>
              )}
            </div>
          </div>

          {/* Overview Tab Content */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Sector Agents Quick Overview Card */}
            <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">সেক্টর এজেন্ট কন্ট্রোল</div>
                  <div className="text-xs text-muted-foreground">
                    মোট {totalVisibleAgents} টি সক্রিয় এজেন্ট ({customAgents.length} টি কাস্টম এজেন্ট রয়েছে)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 flex-1 sm:flex-none"
                  onClick={() => setActiveTab("agents")}
                >
                  এজেন্ট পরিচালনা করুন →
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 flex items-center gap-1 flex-1 sm:flex-none"
                  onClick={() => {
                    setAgentName("");
                    setAgentDesc("");
                    setAgentError(null);
                    setAgentFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> কাস্টম এজেন্ট
                </Button>
              </div>
            </div>

            {/* Provider Key Pools Overview Grid */}
            <div className="grid gap-3 md:grid-cols-2">
              {providers.map((provider) => {
                const pKeys = keys.filter((k) => k.provider.toLowerCase() === provider.toLowerCase());
                const active = pKeys.filter((k) => k.status === "active").length;
                const exhausted = pKeys.filter((k) => k.status === "quota_exhausted").length;
                const isExhausted = providerAllExhausted(provider);

                return (
                  <div
                    key={provider}
                    className={`rounded-xl border p-4 space-y-3 transition-colors ${
                      isExhausted
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-card/60 hover:border-brand/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{provider}</span>
                        {isExhausted ? (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                            সব কোটা শেষ
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-green-600 border-green-500/30">
                            {active} সক্রিয়
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setActiveTab(provider)}
                      >
                        বিস্তারিত দেখুন →
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>মোট কী: {pKeys.length}</span>
                      <span>•</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">{active} টি প্রস্তুত</span>
                      {exhausted > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {exhausted} টি কোটায় আটকে আছে
                          </span>
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {pKeys.slice(0, 3).map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border border-border/60 bg-background/50"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-medium truncate">{k.label}</span>
                            {k.emailAccount && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                ({k.emailAccount})
                              </span>
                            )}
                          </div>
                          <div className="shrink-0">
                            {k.status === "active" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> সক্রিয়
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                                <Clock className="h-3 w-3" /> কোটা শেষ
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {pKeys.length > 3 && (
                        <button
                          onClick={() => setActiveTab(provider)}
                          className="text-[11px] text-brand hover:underline font-medium"
                        >
                          আরও {pKeys.length - 3} টি কী দেখতে ক্লিক করুন...
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Agents Management Tab Content */}
          <TabsContent value="agents" className="mt-4 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-brand" />
                  সেক্টর এজেন্ট কন্ট্রোল সেন্টার
                </h3>
                <p className="text-xs text-muted-foreground">
                  কাস্টম এজেন্ট তৈরি করুন, বিদ্যমান এজেন্ট পরিচালনা ও ডিলিট করুন
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setAgentName("");
                  setAgentDesc("");
                  setAgentError(null);
                  setAgentFormOpen(true);
                }}
                className="flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>কাস্টম এজেন্ট তৈরি করুন</span>
              </Button>
            </div>

            {/* Custom Agents Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand" />
                  আপনার তৈরি কাস্টম এজেন্টসমূহ ({customAgents.length})
                </h4>
              </div>

              {customAgents.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-xl border-border text-muted-foreground space-y-2">
                  <Bot className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">এখনো কোনো কাস্টম এজেন্ট তৈরি করা হয়নি।</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setAgentName("");
                      setAgentDesc("");
                      setAgentError(null);
                      setAgentFormOpen(true);
                    }}
                  >
                    + প্রথম কাস্টম এজেন্ট তৈরি করুন
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {customAgents.map((ca) => (
                    <div
                      key={ca.name}
                      className="rounded-xl border border-border bg-card/60 p-4 flex items-start justify-between gap-3 hover:border-brand/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{ca.name}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-brand border-brand/30 bg-brand-soft/40">
                            কাস্টম এজেন্ট
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {ca.desc || "Personal custom intelligence agent."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCustomAgent(ca.name)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                        title="এজেন্ট ডিলিট করুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Built-in Agents Section */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-sm font-semibold">বিল্ট-ইন সেক্টর এজেন্টসমূহ ({DEFAULT_AGENTS.length})</h4>
              <div className="grid gap-3 md:grid-cols-3">
                {DEFAULT_AGENTS.map((da) => {
                  const isHidden = hiddenAgents.includes(da.name);
                  return (
                    <div
                      key={da.name}
                      className={`rounded-xl border p-3.5 space-y-2 transition-colors ${
                        isHidden
                          ? "border-border/40 bg-muted/20 opacity-60"
                          : "border-border bg-card/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{da.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {isHidden ? "লুকানো" : "সক্রিয়"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{da.desc}</p>
                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleToggleHideDefaultAgent(da.name)}
                        >
                          {isHidden ? "পুনরুদ্ধার করুন" : "হাইড করুন"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Individual Provider Tab Content */}
          {providers.map((provider) => {
            const pKeys = keys.filter((k) => k.provider.toLowerCase() === provider.toLowerCase());
            return (
              <TabsContent key={provider} value={provider} className="mt-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-lg">{provider} API Key Pool</h3>
                    <p className="text-xs text-muted-foreground">
                      মোট {pKeys.length} টি কী সংরক্ষিত রয়েছে
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenAddKey(provider)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{provider} কী যোগ করুন</span>
                  </Button>
                </div>

                {pKeys.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-xl border-border text-muted-foreground space-y-3">
                    <Key className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm">এই প্রোভাইডারের জন্য এখনো কোনো API কী যোগ করা হয়নি।</p>
                    <Button size="sm" onClick={() => handleOpenAddKey(provider)}>
                      প্রথম কী যোগ করুন
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {pKeys.map((key) => {
                      const isExhausted = key.status === "quota_exhausted";
                      return (
                        <div
                          key={key.id}
                          className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                            isExhausted
                              ? "border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-border bg-card/60"
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm tracking-tight">{key.label}</span>
                              {isExhausted ? (
                                <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400 border-amber-300 bg-amber-100/50 dark:bg-amber-900/40 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> কোটা শেষ (Exhausted)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-green-700 dark:text-green-400 border-green-300 bg-green-100/50 dark:bg-green-900/40 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> সক্রিয় (Active)
                                </Badge>
                              )}
                              {key.failCount > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  (ব্যর্থতা: {key.failCount} বার)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="font-mono">{maskApiKey(key.apiKey)}</span>
                              {key.emailAccount && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {key.emailAccount}
                                </span>
                              )}
                              {key.lastUsedAt && (
                                <span>
                                  শেষ ব্যবহার: {new Date(key.lastUsedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                              )}
                            </div>

                            {isExhausted && key.resetAt && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>স্বয়ংক্রিয় রিসেট: <strong>{formatRemainingTime(key.resetAt)}</strong></span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isExhausted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetKey(key.id)}
                                className="h-8 text-xs border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1"
                                title="এই কী-টিকে এখনই ম্যানুয়ালি সক্রিয় করুন"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>এখনই রিসেট</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditKey(key)}
                              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`আপনি কি নিশ্চিত "${key.label}" কী-টি ডিলিট করতে চান?`)) {
                                  deleteKey(key.id);
                                }
                              }}
                              className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Add / Edit Key Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingId ? "API Key সম্পাদনা করুন" : "নতুন API Key যোগ করুন"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              আপনার ফ্রি-টায়ার একাউন্টের কী লেবেলসহ পুলে যোগ করুন
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveKey} className="space-y-4 pt-2">
            {formError && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-xs p-3 font-medium">
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">প্রোভাইডার (Provider)</label>
              <select
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-input bg-background focus:ring-1 focus:ring-ring outline-none"
              >
                {ALL_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                পরিচিতিমূলক লেবেল (Label) <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="যেমন: groq-1, gemini-account2"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                API Key <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  placeholder="gsk_... বা AQ.Ab8..."
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  className="h-10 text-sm font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">সংশ্লিষ্ট ইমেইল অ্যাকাউন্ট (ঐচ্ছিক)</label>
              <Input
                placeholder="যেমন: myaccount@gmail.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                ভিন্ন ভিন্ন জিমেইল দিয়ে খোলার ট্র্যাকিংয়ের সুবিধার্থে
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                className="text-xs"
              >
                বাতিল
              </Button>
              <Button type="submit" className="text-xs font-semibold">
                {editingId ? "আপডেট করুন" : "কী যোগ করুন"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Custom Agent Dialog */}
      <Dialog open={agentFormOpen} onOpenChange={setAgentFormOpen}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 text-brand" />
              কাস্টম সেক্টর এজেন্ট তৈরি করুন
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              আপনার পছন্দের যেকোনো বিষয় বা সেগমেন্টের জন্য নতুন পার্সোনাল এজেন্ট বানান
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAgent} className="space-y-4 pt-2">
            {agentError && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-xs p-3 font-medium">
                {agentError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                এজেন্টের নাম (Agent Name) <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="যেমন: AI Hardware, Crypto & Web3, Cricket"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">সংক্ষিপ্ত বিবরণ (Description)</label>
              <Input
                placeholder="যেমন: GPUs, AI chips, semiconductors & tech news"
                value={agentDesc}
                onChange={(e) => setAgentDesc(e.target.value)}
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                হোমপেজ ও চ্যাট হেডারে এই বিবরণটি প্রদর্শিত হবে
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAgentFormOpen(false)}
                className="text-xs"
              >
                বাতিল
              </Button>
              <Button type="submit" className="text-xs font-semibold">
                এজেন্ট তৈরি করুন
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
