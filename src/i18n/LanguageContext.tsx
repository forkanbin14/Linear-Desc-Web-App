import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'bn';
export type AppCurrency = 'BDT' | 'USD';

const DICTIONARY = {
  en: {
    brand: 'Systonic Linear Desc',
    nav: {
      builder: 'Model Studio',
      solve: 'Solve & Graphs',
      sensitivity: 'Sensitivity & IIS',
      transport: 'Transport & Assign',
      compare: 'Compare & Batch',
    },
    actions: {
      solveModel: 'Solve Model',
      solving: 'Solving...',
      newProject: 'New Project',
      aiDraft: 'AI Draft',
      examples: 'Examples',
      cancel: 'Cancel',
      saveProjectOnly: 'Save Project Only',
      createAndSolve: 'Create Project & Solve',
      creatingSolving: 'Creating & Solving...',
      executeSolve: 'Execute Solve',
      dismiss: 'Dismiss',
      exportPdf: 'Export PDF',
      exportExcel: 'Excel',
      exportCsv: 'CSV',
      exportLp: '.LP',
      share: 'Share',
    },
    sidebar: {
      language: 'Interface Language',
      capitalCurrency: 'Capital Currency',
      bdtLabel: '৳ BDT (Taka)',
      usdLabel: '$ USD (Dollar)',
      workspaceMenu: 'Navigation',
      yourProjects: 'Your Projects',
      noProjectsTitle: 'No Projects Yet',
      noProjectsDesc: 'Add your first project with custom variables, bounds, constraints, or Excel import.',
      solverLabel: 'Solver: HiGHS WASM',
      runs: 'runs',
    },
    creator: {
      kickerNew: 'New Optimization Project',
      kickerEmpty: 'Open Optimization Workspace · Ready for Input',
      title: 'Create Project & Define Mathematical Model',
      subtitle:
        'Enter your project details, decision variables, objective function, and constraints using the Visual Form, Algebraic Equations, Excel Upload, or Natural Language AI.',
      transportTool: 'Transport & Assignment Tool',
      batchTool: 'Batch & API Runner',
      section1Title: '1. Project Information',
      section1Hint: 'All fields customizable',
      projectNameLabel: 'Project Name *',
      projectNamePlaceholder: 'e.g., Factory Production Mix, Investment Portfolio, Diet Cost Minimization',
      domainLabel: 'Domain / Category',
      currencyLabel: 'Capital Currency',
      descLabel: 'Problem Description & Business Notes',
      descPlaceholder: 'Describe the goal, decision scope, units, or business rules...',
      section2Title: '2. Problem Formulation Input',
      section2Subtitle:
        'Choose the input style that matches your workflow — every method populates the full structured model below.',
      tabVisual: 'Visual Form Builder',
      tabEquations: 'Type Equations (LP-01)',
      tabExcel: 'Import Excel',
      tabAi: 'AI Problem Drafter',
      objTitle: 'Objective Direction & Constant Offset',
      objDesc: 'Choose whether to Maximize profit/utility or Minimize cost/risk.',
      maximizeZ: 'Maximize Z',
      minimizeZ: 'Minimize Z',
      offset: 'Offset',
      varsTitle: 'Decision Variables',
      addVariable: 'Add Variable',
      constraintsTitle: 'Linear Constraints',
      addConstraint: 'Add Constraint',
      readyLabel: 'Ready to Solve',
    },
    solve: {
      engineTitle: 'Solver Engine & Numerical Controls',
      engineDesc: 'Normalized SolverAdapter execution with equilibration scaling, presolve, and sensitivity ranging.',
      emptyTitle: 'No Solve Run Recorded for This Version Yet',
      emptyDesc:
        'Click Execute Solve above to compile the model into sparse CSC form and run HiGHS with full sensitivity ranging and IIS diagnostics.',
      runFirst: 'Run First Optimization',
      kpiStatus: 'Solve Status',
      kpiObjective: 'Optimal Objective',
      kpiExecution: 'Engine Execution',
      kpiBottlenecks: 'Active Bottlenecks',
      bindingAtOptimum: 'Binding constraints at optimum',
      explainerTitle: 'Executive Decision Explainer',
      explainerDesc: 'Grounded strictly in solved primal allocations, binding shadow prices, and reduced costs.',
      explainBtn: 'Explain Why Optimal',
      explainingBtn: 'Analyzing Shadow Prices...',
      viewOverview: 'Results & Visual Charts',
      viewGraphical: 'Corner Points, LaTeX, Steps & LHS=RHS',
      varsTableTitle: 'Optimal Decision Variables',
      consTableTitle: 'Constraints, Slack & Shadow Prices',
      multipleOptTitle: 'Multiple Optimal Solutions Detected',
      multipleOptAction: 'Inspect Corner Points & Edge',
    },
    builder: {
      tabular: 'Tabular Builder',
      equations: 'Equation Parser (LP-01)',
      matrix: 'Coefficient Matrix',
      indexed: 'Indexed Sets',
      code: 'JSON & LP Spec',
      excelTemplate: 'Excel Template',
      importExcel: 'Import Excel (.xlsx)',
      validOk: 'Schema & Numerics Valid',
      validErr: 'Validation Errors Found',
      latexPreview: 'Live LaTeX Formulation Preview',
    },
    transport: {
      title: 'Transportation & Assignment Optimization Engine (LP-12)',
      subtitle:
        "Balanced & unbalanced network flow (Vogel's VAM + HiGHS Exact LP) and exact Kuhn-Munkres Hungarian matching.",
      modeTransport: 'Transportation Problem',
      modeAssign: 'Hungarian Assignment',
      solveTransport: 'Solve Transportation',
      solveAssign: 'Solve Hungarian Method',
    },
    compare: {
      tabWhatIf: 'What-If & Compare',
      tabBatch: 'Batch Queue & REST API',
    },
    autopilot: {
      badge: 'Syton AI',
      title: 'Syton AI — Autonomous AI Controller',
      subtitle: 'Describe any task in Bengali, Banglish, or English — Syton AI automatically creates models, edits constraints, runs HiGHS, solves transportation/assignment, runs sensitivity sweeps, or switches views.',
      placeholder: 'Tell Syton AI in Bangla or English: e.g., "একটি ফ্যাক্টরির শার্ট ও প্যান্ট উৎপাদনের লাভ সর্বোচ্চ করার LP মডেল তৈরি করে সমাধান করো..." or "Increase labor limit to 140 and run What-If sweep"',
      runBtn: 'Ask Syton AI',
      runningBtn: 'Syton AI is automating...',
      quickPromptsLabel: 'Instant Bilingual Automation Commands',
      openStudio: 'Open Syton AI Studio',
      hideStudio: 'Collapse',
      historyTitle: 'Executed Automation Actions',
      emptyHistory: 'No Syton AI commands executed in this session yet.',
    },
    share: {
      modalTitle: 'Share Workspace & Results',
      modalSubtitle: 'Send via WhatsApp, Telegram, Facebook, Email, or copy link directly.',
      scopeReport: 'Project & Results',
      scopeApp: 'App Link Only',
      directLinkLabel: 'Direct Shareable Link',
      copyLink: 'Copy Link',
      copySummary: 'Copy Report',
      copied: 'Copied!',
      whatsappBtn: 'Share on WhatsApp',
      nativeShareBtn: 'More Apps (Share Sheet)',
      otherAppsLabel: 'Other Platforms & Direct Channels',
      messagePreviewLabel: 'Message Preview (Editable)',
    },
  },
  bn: {
    brand: 'Systonic Linear Desc',
    nav: {
      builder: 'মডেল স্টুডিও',
      solve: 'সমাধান ও গ্রাফ',
      sensitivity: 'সেন্সিটিভিটি ও IIS',
      transport: 'ট্রান্সপোর্টেশন ও অ্যাসাইনমেন্ট',
      compare: 'তুলনা ও ব্যাচ',
    },
    actions: {
      solveModel: 'মডেল সমাধান করুন',
      solving: 'সমাধান হচ্ছে...',
      newProject: 'নতুন প্রজেক্ট',
      aiDraft: 'AI ড্রাফট',
      examples: 'উদাহরণ',
      cancel: 'বাতিল',
      saveProjectOnly: 'শুধু প্রজেক্ট সেভ করুন',
      createAndSolve: 'প্রজেক্ট তৈরি ও সমাধান করুন',
      creatingSolving: 'তৈরি ও সমাধান হচ্ছে...',
      executeSolve: 'সমাধান চালান',
      dismiss: 'বন্ধ করুন',
      exportPdf: 'PDF ডাউনলোড',
      exportExcel: 'এক্সেল',
      exportCsv: 'CSV',
      exportLp: '.LP',
      share: 'শেয়ার',
    },
    sidebar: {
      language: 'ভাষা পরিবর্তন (Language)',
      capitalCurrency: 'মূলধন মুদ্রা (Capital)',
      bdtLabel: '৳ টাকা (BDT)',
      usdLabel: '$ ডলার (USD)',
      workspaceMenu: 'নেভিগেশন',
      yourProjects: 'আপনার প্রজেক্টসমূহ',
      noProjectsTitle: 'এখনো কোনো প্রজেক্ট নেই',
      noProjectsDesc: 'নিজস্ব ভেরিয়েবল, বাউন্ড, কনস্ট্রেইন্ট বা এক্সেল দিয়ে প্রথম প্রজেক্ট তৈরি করুন।',
      solverLabel: 'সলভার: HiGHS WASM',
      runs: 'রান',
    },
    creator: {
      kickerNew: 'নতুন অপটিমাইজেশন প্রজেক্ট',
      kickerEmpty: 'ওপেন অপটিমাইজেশন ওয়ার্কস্পেস · ইনপুটের জন্য প্রস্তুত',
      title: 'নতুন প্রজেক্ট তৈরি ও গাণিতিক মডেল ইনপুট',
      subtitle:
        'ভিজ্যুয়াল ফর্ম, বীজগাণিতিক সমীকরণ (LP-01), এক্সেল আপলোড অথবা ন্যাচারাল ল্যাঙ্গুয়েজ AI ব্যবহার করে আপনার প্রজেক্টের যাবতীয় তথ্য ইনপুট করুন।',
      transportTool: 'ট্রান্সপোর্টেশন ও অ্যাসাইনমেন্ট টুল',
      batchTool: 'ব্যাচ ও API রানার',
      section1Title: '১. প্রজেক্টের তথ্য (Project Info)',
      section1Hint: 'সব ফিল্ড পরিবর্তনযোগ্য',
      projectNameLabel: 'প্রজেক্টের নাম *',
      projectNamePlaceholder: 'যেমন: গার্মেন্টস উৎপাদন পরিকল্পনা, ইনভেস্টমেন্ট পোর্টফোলিও, ডায়েট কস্ট মিনিমাইজেশন',
      domainLabel: 'ক্যাটাগরি / ডোমেইন',
      currencyLabel: 'মূলধনের মুদ্রা (Capital Currency)',
      descLabel: 'সমস্যার বিবরণ ও নোটস',
      descPlaceholder: 'লক্ষ্য, সিদ্ধান্তের পরিধি, একক বা ব্যবসায়িক শর্তগুলো লিখুন...',
      section2Title: '২. গাণিতিক সমস্যা ইনপুট পদ্ধতি',
      section2Subtitle:
        'আপনার সুবিধামতো ইনপুট মাধ্যম বেছে নিন — প্রতিটি মাধ্যম নিচের পূর্ণাঙ্গ স্ট্রাকচার্ড ফর্ম পূরণ করবে।',
      tabVisual: 'ভিজ্যুয়াল ফর্ম বিল্ডার',
      tabEquations: 'সমীকরণ লিখুন (LP-01)',
      tabExcel: 'এক্সেল ইমপোর্ট',
      tabAi: 'AI প্রবলেম ড্রাফটার',
      objTitle: 'অবজেক্টিভ ডিরেকশন ও ধ্রুবক অফসেট',
      objDesc: 'মুনাফা/উপযোগিতা সর্বোচ্চ (Maximize) বা খরচ/ঝুঁকি সর্বনিম্ন (Minimize) নির্বাচন করুন।',
      maximizeZ: 'সর্বোচ্চ (Maximize Z)',
      minimizeZ: 'সর্বনিম্ন (Minimize Z)',
      offset: 'অফসেট',
      varsTitle: 'ডিসিশন ভেরিয়েবলসমূহ (Variables)',
      addVariable: 'ভেরিয়েবল যোগ করুন',
      constraintsTitle: 'লিনিয়ার কনস্ট্রেইন্টসমূহ (Constraints)',
      addConstraint: 'কনস্ট্রেইন্ট যোগ করুন',
      readyLabel: 'সমাধানের জন্য প্রস্তুত',
    },
    solve: {
      engineTitle: 'সলভার ইঞ্জিন ও নিউমেরিক্যাল কন্ট্রোল',
      engineDesc: 'স্কেলিং, প্রিসলভ এবং সেন্সিটিভিটি রেঞ্জিংসহ নর্মালাইজড SolverAdapter এক্সিকিউশন।',
      emptyTitle: 'এই ভার্সনের জন্য এখনো কোনো সমাধান রান হয়নি',
      emptyDesc:
        'HiGHS ইঞ্জিনে স্পার্স CSC ম্যাট্রিক্স কম্পাইল করে সমাধান, শ্যাডো প্রাইস এবং IIS ডায়াগনস্টিক দেখতে সমাধান চালান।',
      runFirst: 'প্রথম অপটিমাইজেশন চালান',
      kpiStatus: 'সমাধানের অবস্থা',
      kpiObjective: 'সর্বোত্তম অবজেক্টিভ',
      kpiExecution: 'ইঞ্জিন এক্সিকিউশন',
      kpiBottlenecks: 'সক্রিয় সীমাবদ্ধতা',
      bindingAtOptimum: 'অপটিমামে বাইন্ডিং কনস্ট্রেইন্ট',
      explainerTitle: 'এক্সিকিউটিভ সিদ্ধান্ত ব্যাখ্যা (AI Explainer)',
      explainerDesc: 'প্রাইমাল মান, শ্যাডো প্রাইস এবং রিডিউসড কস্টের ওপর ভিত্তি করে বিশ্লেষণ।',
      explainBtn: 'কেন এটি অপটিমাল ব্যাখ্যা করুন',
      explainingBtn: 'শ্যাডো প্রাইস বিশ্লেষণ চলছে...',
      viewOverview: 'ফলাফল ও ভিজ্যুয়াল চার্ট',
      viewGraphical: 'কর্নার পয়েন্ট, LaTeX, ধাপ ও LHS=RHS যাচাই',
      varsTableTitle: 'অপটিমাল ডিসিশন ভেরিয়েবলসমূহ',
      consTableTitle: 'কনস্ট্রেইন্ট, স্ল্যাক ও শ্যাডো প্রাইস',
      multipleOptTitle: 'একাধিক অপটিমাল সমাধান (Multiple Optimal) শনাক্ত হয়েছে',
      multipleOptAction: 'কর্নার পয়েন্ট ও এজ দেখুন',
    },
    builder: {
      tabular: 'ট্যাবুলার বিল্ডার',
      equations: 'সমীকরণ পার্সার (LP-01)',
      matrix: 'কোয়েফিশিয়েন্ট ম্যাট্রিক্স',
      indexed: 'ইনডেক্সড সেটস',
      code: 'JSON ও LP ফরম্যাট',
      excelTemplate: 'এক্সেল টেমপ্লেট',
      importExcel: 'এক্সেল ইমপোর্ট (.xlsx)',
      validOk: 'স্কিমা ও গাণিতিক তথ্য সঠিক',
      validErr: 'ভ্যালিডেশন ত্রুটি পাওয়া গেছে',
      latexPreview: 'লাইভ LaTeX গাণিতিক প্রিভিউ',
    },
    transport: {
      title: 'ট্রান্সপোর্টেশন ও অ্যাসাইনমেন্ট অপটিমাইজেশন ইঞ্জিন (LP-12)',
      subtitle:
        'ব্যালেন্সড ও আনব্যালেন্সড নেটওয়ার্ক (VAM + HiGHS অপটিমাল) এবং হাঙ্গেরিয়ান অ্যাসাইনমেন্ট পদ্ধতি।',
      modeTransport: 'ট্রান্সপোর্টেশন প্রবলেম',
      modeAssign: 'হাঙ্গেরিয়ান অ্যাসাইনমেন্ট',
      solveTransport: 'ট্রান্সপোর্টেশন সমাধান করুন',
      solveAssign: 'হাঙ্গেরিয়ান পদ্ধতিতে সমাধান করুন',
    },
    compare: {
      tabWhatIf: 'What-If ও তুলনা',
      tabBatch: 'ব্যাচ কিউ ও REST API',
    },
    autopilot: {
      badge: 'Syton AI',
      title: 'Syton AI — অটোনোমাস AI সিস্টেম কন্ট্রোলার',
      subtitle: 'বাংলা, বাংলিশ অথবা ইংরেজিতে নির্দেশনা দিন — Syton AI স্বয়ংক্রিয়ভাবে প্রজেক্ট তৈরি, কনস্ট্রেইন্ট আপডেট, HiGHS সমাধান, ট্রান্সপোর্টেশন, সেন্সিটিভিটি ও পুরো সিস্টেম পরিচালনা করবে।',
      placeholder: 'Syton AI-কে বাংলা বা ইংরেজিতে লিখুন: যেমন "একটি ফ্যাক্টরির শার্ট ও প্যান্ট বানানোর LP মডেল তৈরি ও সমাধান করো..." অথবা "শ্রম সীমা ১২০ করে সমাধান করো"',
      runBtn: 'Syton AI-কে বলুন',
      runningBtn: 'Syton AI কাজ করছে...',
      quickPromptsLabel: 'তাৎক্ষণিক বাংলা ও ইংরেজি অটোমেশন উদাহরণ',
      openStudio: 'Syton AI স্টুডিও খুলুন',
      hideStudio: 'সংকুচিত করুন',
      historyTitle: 'সম্পন্ন হওয়া অটোমেশন ধাপসমূহ',
      emptyHistory: 'এই সেশনে এখনো Syton AI-কে কোনো কমান্ড দেওয়া হয়নি।',
    },
    share: {
      modalTitle: 'প্রজেক্ট ও ফলাফল শেয়ার করুন',
      modalSubtitle: 'WhatsApp, Telegram, Facebook, Email বা সরাসরি লিংক কপি করে শেয়ার করুন।',
      scopeReport: 'প্রজেক্ট ও ফলাফলসহ',
      scopeApp: 'শুধু অ্যাপ লিংক',
      directLinkLabel: 'শেয়ারযোগ্য সরাসরি লিংক',
      copyLink: 'লিংক কপি',
      copySummary: 'রিপোর্ট কপি',
      copied: 'কপি হয়েছে!',
      whatsappBtn: 'WhatsApp-এ শেয়ার করুন',
      nativeShareBtn: 'অন্যান্য অ্যাপ (Share Sheet)',
      otherAppsLabel: 'অন্যান্য মাধ্যম ও সোশ্যাল প্ল্যাটফর্ম',
      messagePreviewLabel: 'মেসেজ প্রিভিউ (প্রয়োজনে এডিট করুন)',
    },
  },
} as const;

export type TranslationDict = (typeof DICTIONARY)['en'];

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => void;
  toggleCurrency: () => void;
  currencySymbol: string;
  t: TranslationDict;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem('a2z_lang');
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });

  const [currency, setCurrencyState] = useState<AppCurrency>(() => {
    try {
      const saved = localStorage.getItem('a2z_currency');
      return saved === 'USD' ? 'USD' : 'BDT';
    } catch {
      return 'BDT';
    }
  });

  const setLang = (next: AppLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem('a2z_lang', next);
    } catch {
      // Ignore storage errors
    }
  };

  const setCurrency = (next: AppCurrency) => {
    setCurrencyState(next);
    try {
      localStorage.setItem('a2z_currency', next);
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }, [lang]);

  const toggleLang = () => setLang(lang === 'en' ? 'bn' : 'en');
  const toggleCurrency = () => setCurrency(currency === 'BDT' ? 'USD' : 'BDT');
  const currencySymbol = currency === 'BDT' ? '৳' : '$';

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        currency,
        setCurrency,
        toggleCurrency,
        currencySymbol,
        t: DICTIONARY[lang] as TranslationDict,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
