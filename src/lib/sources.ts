import {
  Flag,
  Globe,
  Rocket,
  Atom,
  Code2,
  Briefcase,
  TrendingUp,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AgentDefinition = {
  id: string;
  name: string;
  shortName?: string;
  desc: string;
  iconName: string;
  icon: LucideIcon;
  domains: string[];
  systemPrompt: string;
  prompts: string[];
  preferredModel?: string;
  isSuperAgent?: boolean;
  instruction?: string;
};

export const DEFAULT_INTELLIGENCE_AGENTS: AgentDefinition[] = [
  {
    id: "bangladesh",
    name: "Bangladesh Intelligence",
    shortName: "BD",
    desc: "বাংলাদেশের রাজনীতি, অর্থনীতি, মেগাপ্রকল্প, ব্যবসা ও স্থানীয় শীর্ষ খবর।",
    iconName: "Flag",
    icon: Flag,
    domains: [
      "prothomalo.com",
      "thedailystar.net",
      "tbsnews.net",
      "dhakatribune.com",
      "bdnews24.com",
    ],
    systemPrompt: `You are the Bangladesh Intelligence Agent of ORION. You specialize in Bangladesh politics, macroeconomics, mega-infrastructure projects (Metro Rail, Padma Rail, Matarbari), financial reforms, and district-level breaking news. Base your answers on authoritative sources (Prothom Alo, Daily Star, TBS News, Dhaka Tribune, BDNews24). Always format with clear bullets, provide objective analysis in fluent Bengali (or English if prompted), and cite references. Current year is 2026.`,
    prompts: [
      "আজকের রাজনৈতিক পরিস্থিতি কী?",
      "অর্থনীতি ও রেমিট্যান্সের সর্বশেষ আপডেট বলো",
      "মেট্রোরেল ও মেগাপ্রকল্পের খবর কী?",
    ],
  },
  {
    id: "world",
    name: "World Intelligence",
    shortName: "World",
    desc: "ভূরাজনীতি, বিশ্ব কূটনীতি, যুদ্ধ ও সংঘাত, আন্তর্জাতিক নীতি।",
    iconName: "Globe",
    icon: Globe,
    domains: [
      "reuters.com",
      "apnews.com",
      "bbc.com",
      "aljazeera.com",
      "theguardian.com",
      "cnn.com",
    ],
    systemPrompt: `You are the World Intelligence Agent of ORION. You monitor geopolitics, international diplomacy, regional conflicts, treaties, and global elections based on verified global wire services (Reuters, AP, BBC, Al Jazeera, The Guardian). Provide balanced, factual summaries with strategic context. Current year is 2026.`,
    prompts: [
      "বিশ্বের শীর্ষ আন্তর্জাতিক খবরগুলো কী?",
      "মধ্যপ্রাচ্য ও ভূরাজনীতি আপডেট",
      "জাতিসংঘ ও বৈশ্বিক কূটনীতি",
    ],
  },
  {
    id: "tech-startup",
    name: "Tech & Startup Intelligence",
    shortName: "Tech",
    desc: "বৈশ্বিক ও দেশীয় টেক নিউজ, ভেঞ্চার ক্যাপিটাল, ফান্ডিং, নতুন গ্যাজেট ও প্রোডাক্ট লঞ্চ।",
    iconName: "Rocket",
    icon: Rocket,
    domains: [
      "techcrunch.com",
      "theverge.com",
      "arstechnica.com",
      "wired.com",
      "producthunt.com",
      "news.ycombinator.com",
    ],
    systemPrompt: `You are the Tech & Startup Intelligence Agent of ORION. You cover venture capital, startup seed rounds, Series A-D, new product launches, smartphones, hardware teardowns, and consumer tech developments. Synthesize insights clearly with metrics and company names. Current year is 2026.`,
    prompts: [
      "আজকের শীর্ষ টেক নিউজ ও ফান্ডিং রাউন্ড",
      "নতুন প্রোডাক্ট ও গ্যাজেট লঞ্চ",
      "সিলিকন ভ্যালি ও এশিয়ার স্টার্টআপ আপডেট",
    ],
  },
  {
    id: "ai-models",
    name: "AI & Models Intelligence",
    shortName: "AI",
    desc: "নতুন LLM/ফাউন্ডেশনাল মডেল রিলিজ, AI রিসার্চ পেপার, ফ্রন্টায়ার ল্যাব আপডেট।",
    iconName: "Atom",
    icon: Atom,
    domains: [
      "huggingface.co",
      "arxiv.org",
      "openai.com",
      "anthropic.com",
      "deepmind.google",
    ],
    systemPrompt: `You are the AI & Models Intelligence Agent of ORION. You specialize in artificial intelligence breakthroughs, open-weight LLMs, multimodal models, benchmark evaluations (MMLU, GSM8k), AI agents, and frontier labs (OpenAI, Anthropic, Google DeepMind, DeepSeek, Meta AI). Explain technical nuances simply yet accurately. Current year is 2026.`,
    prompts: [
      "আজকের শীর্ষ AI পেপার ও ট্রেন্ডিং মডেল",
      "OpenAI ও DeepMind এর সর্বশেষ ঘোষণা",
      "নতুন ওপেন-সোর্স LLM রিলিজ",
    ],
  },
  {
    id: "dev-github",
    name: "Dev & GitHub Intelligence",
    shortName: "Dev",
    desc: "GitHub Trending রিপোজিটরি, নতুন লাইব্রেরি ও ফ্রেমওয়ার্ক রিলিজ, ডেভেলপার ডিসকাশন।",
    iconName: "Code2",
    icon: Code2,
    domains: [
      "github.com",
      "lobste.rs",
      "dev.to",
      "reddit.com/r/programming",
    ],
    systemPrompt: `You are the Dev & GitHub Intelligence Agent of ORION. You track trending open-source GitHub repositories, major language/framework releases (TypeScript, React, Rust, Go, Python), architecture patterns, and developer ecosystem discussions. Current year is 2026.`,
    prompts: [
      "আজকে GitHub-এ কী ট্রেন্ডিং?",
      "নতুন ওয়েব ফ্রেমওয়ার্ক ও টুলস আপডেট",
      "ডেভেলপার কমিউনিটির শীর্ষ আলোচনা",
    ],
  },
  {
    id: "market-economy",
    name: "Market & Economy Intelligence",
    shortName: "Market",
    desc: "স্টক মার্কেট, মুদ্রা বিনিময় হার (USD/BDT), ক্রিপ্টো, কেন্দ্রীয় ব্যাংক ও মুদ্রাস্ফীতি।",
    iconName: "Briefcase",
    icon: Briefcase,
    domains: [
      "bloomberg.com",
      "cnbc.com",
      "ft.com",
      "finance.yahoo.com",
      "bb.org.bd",
    ],
    systemPrompt: `You are the Market & Economy Intelligence Agent of ORION. You analyze global equity indices (S&P 500, Nasdaq, DSE), currency exchange rates (USD/BDT forex reserves), interest rate decisions (Federal Reserve, Bangladesh Bank), commodities (Gold, Crude Oil), and crypto market liquidity. Current year is 2026.`,
    prompts: [
      "আজকের স্টক মার্কেট ও ডলার রেট কী?",
      "মুদ্রাস্ফীতি ও কেন্দ্রীয় ব্যাংকের নীতি",
      "ক্রিপ্টো ও গোল্ড মার্কেটের অবস্থা",
    ],
  },
  {
    id: "trends-social",
    name: "Trends & Social Signals",
    shortName: "Trends",
    desc: "গুগল ট্রেন্ডস, ভাইরাল কনটেন্ট, সোশ্যাল মিডিয়া ডিসকাশন, পপ কালচার।",
    iconName: "TrendingUp",
    icon: TrendingUp,
    domains: [
      "trends.google.com",
      "reddit.com",
      "youtube.com",
    ],
    systemPrompt: `You are the Trends & Social Signals Agent of ORION. You detect real-time viral trends, cultural memes, trending searches across Google Trends, Reddit discussions, and internet culture movements. Current year is 2026.`,
    prompts: [
      "আজকের শীর্ষ ভাইরাল ও ট্রেন্ডিং টপিক কী?",
      "সোশ্যাল মিডিয়ার সবচেয়ে আলোচিত বিষয়",
      "জনপ্রিয় কালচারাল ট্রেন্ডস",
    ],
  },
  {
    id: "cyber-intelligence",
    name: "Cyber Intelligence",
    shortName: "Cyber",
    desc: "জিরো-ডে ভালনারেবিলিটি, সাইবার অ্যাটাক, ম্যালওয়্যার অ্যানালাইসিস, সিকিউরিটি প্যাচ ও অ্যাডভাইজরি।",
    iconName: "Shield",
    icon: Shield,
    domains: [
      "thehackernews.com",
      "bleepingcomputer.com",
      "krebsonsecurity.com",
      "darkreading.com",
      "cisa.gov",
    ],
    systemPrompt: `You are the Cyber Intelligence Agent of ORION. You monitor cybersecurity advisories, zero-day CVE disclosures, ransomware campaigns, nation-state APT threats, infrastructure breaches, and patch alerts (CISA, BleepingComputer, TheHackerNews). Current year is 2026.`,
    prompts: [
      "নতুন কোনো গুরুত্বপূর্ণ জিরো-ডে বা CVE আছে?",
      "সাম্প্রতিক সাইবার হামলা ও র্যানসমওয়্যার রিপোর্ট",
      "জরুরি সিকিউরিটি প্যাচ পরামর্শ",
    ],
  },
  {
    id: "orion-super",
    name: "ORION Super Agent",
    shortName: "Omni Brain",
    desc: "সকল এজেন্টের ডেটার ওপর ক্রস-সেক্টর অ্যানালাইসিস এবং হাই-লেভেল এক্সিকিউটিভ ডাইজেস্ট।",
    iconName: "Sparkles",
    icon: Sparkles,
    domains: [
      "prothomalo.com",
      "thedailystar.net",
      "reuters.com",
      "bloomberg.com",
      "techcrunch.com",
      "thehackernews.com",
    ],
    systemPrompt: `You are the ORION Super Agent (Omni Brain), the master intelligence synthesizer. You have omni-directional awareness across Bangladesh, World Geopolitics, Technology, AI Frontiers, Markets, Cybersecurity, and Social Signals. Synthesize cross-sector implications, connect unexpected dots, and deliver executive-grade briefings with strategic clarity in Bengali and English. Current year is 2026.`,
    prompts: [
      "আজকের সমগ্র বিশ্বের ৩ মিনিটের ফুল এক্সিকিউটিভ ব্রিফিং দাও",
      "প্রযুক্তি ও অর্থনীতির ক্রস-সেক্টর বিশ্লেষণ",
      "আমার জন্য শীর্ষ ৫টি কানেক্টেড ট্রেন্ড কী?",
    ],
    isSuperAgent: true,
  },
];

export type CustomAgentItem = {
  id?: string;
  name: string;
  desc: string;
  domains?: string[];
  systemPrompt?: string;
  preferredModel?: string;
  iconName?: string;
};

export const ICON_MAP: Record<string, LucideIcon> = {
  Flag,
  Globe,
  Rocket,
  Atom,
  Code2,
  Briefcase,
  TrendingUp,
  Shield,
  Sparkles,
};

export function getAgentIcon(iconName?: string): LucideIcon {
  if (!iconName) return Sparkles;
  return ICON_MAP[iconName] || Sparkles;
}

export function findAgentConfig(nameOrId: string, customAgents: CustomAgentItem[] = []): AgentDefinition {
  const norm = nameOrId.trim().toLowerCase();

  // Check default agents
  const foundDefault = DEFAULT_INTELLIGENCE_AGENTS.find(
    (a) => a.id.toLowerCase() === norm || a.name.toLowerCase() === norm || a.shortName?.toLowerCase() === norm,
  );
  if (foundDefault) return foundDefault;

  // Check custom agents
  const foundCustom = customAgents.find(
    (c) => c.name.toLowerCase() === norm || (c.id && c.id.toLowerCase() === norm),
  );
  if (foundCustom) {
    return {
      id: foundCustom.id || foundCustom.name.toLowerCase().replace(/\s+/g, "-"),
      name: foundCustom.name,
      shortName: foundCustom.name.slice(0, 3).toUpperCase(),
      desc: foundCustom.desc || "Custom intelligence agent.",
      iconName: foundCustom.iconName || "Sparkles",
      icon: getAgentIcon(foundCustom.iconName),
      domains: foundCustom.domains && foundCustom.domains.length > 0 ? foundCustom.domains : [],
      systemPrompt:
        foundCustom.systemPrompt ||
        `You are the ${foundCustom.name} agent of ORION. Answer user questions with accurate analysis in Bengali or English. Current date is October 2026.`,
      prompts: [
        `আজকের ${foundCustom.name} সংক্রান্ত আপডেট দাও`,
        "মূল বিষয়গুলো বিশ্লেষণ করো",
      ],
      ...(foundCustom.preferredModel !== undefined ? { preferredModel: foundCustom.preferredModel } : {}),
    } as AgentDefinition;
  }

  // Fallback to Bangladesh or first agent
  return DEFAULT_INTELLIGENCE_AGENTS[0] as AgentDefinition;
}

/**
 * Builds site:domain search query string for You.com or other engines
 */
export function buildDomainFilteredQuery(query: string, domains: string[]): string {
  const cleanQ = query.trim();
  if (!domains || domains.length === 0) return cleanQ;
  const siteFilter = domains.map((d) => `site:${d.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`).join(" OR ");
  return `${cleanQ} (${siteFilter})`;
}

export type CustomSector = {
  id: string;
  name: string;
  shortName: string;
  instruction: string;
};

export function customSectorToAgent(c: CustomSector): AgentDefinition {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName || c.name.slice(0, 4),
    desc: c.instruction,
    iconName: "Sparkles",
    icon: Sparkles,
    domains: [],
    instruction: c.instruction,
    systemPrompt: `You are the "${c.name}" intelligence agent of ORION. The reader defined this topic: "${c.instruction}". Cover only news, facts and analysis relevant to this topic, and explain the context simply. Answer in fluent Bengali (or English if asked). Current year is 2026.`,
    prompts: [
      `আজকের ${c.name} সংক্রান্ত সব খবরের ব্রিফিং দাও`,
      "এই বিষয়ের মূল পয়েন্টগুলো বিশ্লেষণ করো",
    ],
  };
}
