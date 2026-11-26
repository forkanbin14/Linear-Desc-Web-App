import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { ModelSpec, SolveRun } from '../shared/types.ts';
import { downloadTextFile, fmtNum } from '../utils/format.ts';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  spec: ModelSpec | null;
  activeRun: SolveRun | null;
}

export function ShareModal({ open, onClose, projectId, spec, activeRun }: ShareModalProps) {
  const { lang, currency, t } = useLanguage();
  const [shareScope, setShareScope] = useState<'report' | 'app'>(spec ? 'report' : 'app');
  const [customMessage, setCustomMessage] = useState('');
  const [copiedType, setCopiedType] = useState<'link' | 'text' | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    if (shareScope === 'report' && projectId) {
      url.searchParams.set('project', projectId);
    }
    return url.toString();
  }, [projectId, shareScope]);

  const activeCurrency = spec?.currency ?? currency;
  const symbol = activeCurrency === 'USD' ? '$' : '৳';

  const generatedMessage = useMemo(() => {
    if (shareScope === 'app' || !spec) {
      return lang === 'bn'
        ? `Systonic Linear Desc — বাংলা ও ইংরেজিতে পূর্ণাঙ্গ LP / MIP / QP / Transportation অপটিমাইজেশন ও Syston ওয়ার্কস্পেস!\n\nলিংক: ${shareUrl}`
        : `Systonic Linear Desc — Full-stack LP / MIP / QP / Transportation optimization & Syston workspace!\n\nOpen here: ${shareUrl}`;
    }

    const result = activeRun?.result;
    const senseLabel =
      spec.objective.sense === 'max'
        ? lang === 'bn'
          ? 'সর্বোচ্চ (Maximize)'
          : 'Maximize'
        : lang === 'bn'
          ? 'সর্বনিম্ন (Minimize)'
          : 'Minimize';

    const lines: string[] = [];
    if (lang === 'bn') {
      lines.push(`📊 *${spec.name}* (${spec.domain})`);
      lines.push(`লক্ষ্য: ${senseLabel} · মূলধন: ${activeCurrency} (${symbol})`);
      if (result && result.status === 'optimal' && result.objective !== null) {
        lines.push(`✅ সর্বোত্তম ফলাফল (Z*): ${symbol}${fmtNum(result.objective, 4)}`);
        const topVars = result.variableDetails
          .slice(0, 6)
          .map((v) => `• ${v.name}: ${fmtNum(v.value, 3)}`)
          .join('\n');
        if (topVars) {
          lines.push(`\nপ্রধান ভেরিয়েবল:\n${topVars}`);
        }
      } else if (result) {
        lines.push(`স্ট্যাটাস: ${result.rawStatus}`);
      } else {
        lines.push(
          `ভেরিয়েবল: ${spec.variables.length}টি · কনস্ট্রেইন্ট: ${spec.constraints.length}টি`,
        );
      }
      lines.push(`\n🔗 লিংক (${t.brand}): ${shareUrl}`);
    } else {
      lines.push(`📊 *${spec.name}* (${spec.domain})`);
      lines.push(`Objective: ${senseLabel} · Capital: ${activeCurrency} (${symbol})`);
      if (result && result.status === 'optimal' && result.objective !== null) {
        lines.push(`✅ Optimal Objective (Z*): ${symbol}${fmtNum(result.objective, 4)}`);
        const topVars = result.variableDetails
          .slice(0, 6)
          .map((v) => `• ${v.name}: ${fmtNum(v.value, 3)}`)
          .join('\n');
        if (topVars) {
          lines.push(`\nOptimal Variables:\n${topVars}`);
        }
      } else if (result) {
        lines.push(`Status: ${result.rawStatus}`);
      } else {
        lines.push(
          `Variables: ${spec.variables.length} · Constraints: ${spec.constraints.length}`,
        );
      }
      lines.push(`\n🔗 Open in ${t.brand}: ${shareUrl}`);
    }
    return lines.join('\n');
  }, [activeCurrency, activeRun, lang, shareScope, shareUrl, spec, symbol, t.brand]);

  useEffect(() => {
    setShareScope(spec ? 'report' : 'app');
  }, [spec, open]);

  useEffect(() => {
    setCustomMessage(generatedMessage);
  }, [generatedMessage, open]);

  useEffect(() => {
    if (!open) setCopiedType(null);
  }, [open]);

  const effectiveMessage = customMessage.trim() || generatedMessage;
  const shareTitle = spec && shareScope === 'report' ? `${spec.name} · ${t.brand}` : t.brand;
  const canUseWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async (text: string, type: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success(
        type === 'link'
          ? lang === 'bn'
            ? 'শেয়ার লিংক কপি হয়েছে!'
            : 'Share link copied to clipboard!'
          : lang === 'bn'
            ? 'পূর্ণাঙ্গ রিপোর্ট কপি হয়েছে!'
            : 'Full summary copied to clipboard!',
      );
      setTimeout(() => setCopiedType((cur) => (cur === type ? null : cur)), 2000);
    } catch {
      toast.error(
        lang === 'bn'
          ? 'ক্লিপবোর্ড অনুমোদিত নয় — টেক্সট বক্স থেকে কপি করুন।'
          : 'Clipboard blocked — copy directly from the preview box.',
      );
    }
  };

  const handleNativeShare = async () => {
    if (!canUseWebShare) return;
    try {
      await navigator.share({
        title: shareTitle,
        text: effectiveMessage,
        url: shareUrl,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.info(
        lang === 'bn'
          ? 'ডিভাইস শেয়ার শিট খোলা যায়নি, WhatsApp বা Copy ব্যবহার করুন।'
          : 'Native share sheet unavailable — use WhatsApp or Copy below.',
      );
    }
  };

  const encodedMessage = encodeURIComponent(effectiveMessage);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

  const channels = [
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(
        effectiveMessage.replace(shareUrl, '').trim(),
      )}`,
      external: true,
      icon: Send,
      cardClass: 'bg-sky-50/80 hover:bg-sky-100/90 border-sky-200/90 text-sky-950',
      iconClass: 'bg-sky-500/15 text-sky-700',
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`,
      external: true,
      icon: ExternalLink,
      cardClass: 'bg-blue-50/80 hover:bg-blue-100/90 border-blue-200/90 text-blue-950',
      iconClass: 'bg-blue-500/15 text-blue-700',
    },
    {
      name: 'SMS / Messages',
      href: `sms:?&body=${encodedMessage}`,
      external: false,
      icon: Smartphone,
      cardClass: 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900',
      iconClass: 'bg-slate-200/70 text-slate-700',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      external: true,
      icon: ExternalLink,
      cardClass: 'bg-indigo-50/80 hover:bg-indigo-100/90 border-indigo-200/90 text-indigo-950',
      iconClass: 'bg-indigo-500/15 text-indigo-700',
    },
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        effectiveMessage.slice(0, 240),
      )}`,
      external: true,
      icon: ExternalLink,
      cardClass: 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-900',
      iconClass: 'bg-zinc-200/70 text-zinc-800',
    },
    {
      name: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedMessage}`,
      external: false,
      icon: Mail,
      cardClass: 'bg-amber-50/80 hover:bg-amber-100/90 border-amber-200/90 text-amber-950',
      iconClass: 'bg-amber-500/15 text-amber-700',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl p-0 border-0 bg-transparent shadow-none ring-0 overflow-visible"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 620, damping: 34, mass: 0.5 }}
          className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        >
          {/* Pro Gradient Studio Header */}
          <DialogHeader className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white border-b border-white/10 shrink-0 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <motion.span
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                  className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner shrink-0"
                >
                  <Share2 className="w-4.5 h-4.5" />
                </motion.span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {t.share.modalTitle}
                    </DialogTitle>
                    <Badge className="bg-teal-500/20 text-teal-200 border-teal-400/30 font-mono text-[10px]">
                      {activeCurrency} {symbol}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-slate-300 truncate">
                    {t.share.modalSubtitle}
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label={t.actions.dismiss}
                className="text-slate-300 hover:text-white hover:bg-white/10 rounded-lg shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable Body */}
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4">
            {/* Shadcn Scope Tabs when a Project is Active */}
            {spec && (
              <Tabs
                value={shareScope}
                onValueChange={(val) => setShareScope(val as 'report' | 'app')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100 p-1 rounded-xl">
                  <TabsTrigger value="report" className="text-xs font-semibold rounded-lg">
                    {t.share.scopeReport}
                  </TabsTrigger>
                  <TabsTrigger value="app" className="text-xs font-semibold rounded-lg">
                    {t.share.scopeApp}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Live Snapshot Card if sharing active solved project */}
            {spec && shareScope === 'report' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card size="sm" className="bg-slate-50/90 ring-slate-200/90 px-3.5 py-2.5 flex-row items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span className="truncate">{spec.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                      {spec.domain} · {spec.variables.length} vars · {spec.constraints.length} cons
                    </div>
                  </div>
                  {activeRun?.result.status === 'optimal' && activeRun.result.objective !== null && (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 font-mono tabular-nums shrink-0">
                      Z* = {symbol}
                      {fmtNum(activeRun.result.objective, 2)}
                    </Badge>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Direct Link Bar */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-teal-700" />
                {t.share.directLinkLabel}
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <Input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 font-mono text-xs bg-slate-50 border-slate-200 rounded-xl text-slate-700"
                />
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    type="button"
                    onClick={() => handleCopy(shareUrl, 'link')}
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      copiedType === 'link'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {copiedType === 'link' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedType === 'link' ? t.share.copied : t.share.copyLink}</span>
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Hero Primary Channels: WhatsApp + Native Share Sheet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <motion.a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md shadow-emerald-900/15 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{t.share.whatsappBtn}</div>
                    <div className="text-[11px] text-emerald-100 truncate">
                      {lang === 'bn' ? 'সরাসরি চ্যাট বা গ্রুপে পাঠান' : 'Send to chat or group'}
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-85 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </motion.a>

              {canUseWebShare ? (
                <motion.button
                  type="button"
                  onClick={handleNativeShare}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-md shadow-slate-900/15 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{t.share.nativeShareBtn}</div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {lang === 'bn' ? 'মোবাইল / অন্যান্য অ্যাপ' : 'Apps on your device'}
                      </div>
                    </div>
                  </div>
                  <Share2 className="w-4 h-4 shrink-0 opacity-85" />
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => handleCopy(effectiveMessage, 'text')}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    copiedType === 'text'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        copiedType === 'text'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {copiedType === 'text' ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {copiedType === 'text' ? t.share.copied : t.share.copySummary}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {lang === 'bn' ? 'যেকোনো মেসেঞ্জারে পেস্ট করুন' : 'Paste in any chat app'}
                      </div>
                    </div>
                  </div>
                </motion.button>
              )}
            </div>

            <Separator />

            {/* Staggered Other Social Channels Grid */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">{t.share.otherAppsLabel}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {channels.map((ch, idx) => {
                  const Icon = ch.icon;
                  return (
                    <motion.a
                      key={ch.name}
                      href={ch.href}
                      target={ch.external ? '_blank' : undefined}
                      rel={ch.external ? 'noopener noreferrer' : undefined}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.04 + idx * 0.03 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border font-semibold transition-colors ${ch.cardClass}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${ch.iconClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="truncate">{ch.name}</span>
                    </motion.a>
                  );
                })}
              </div>
            </div>

            {/* Editable Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  {t.share.messagePreviewLabel}
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleCopy(effectiveMessage, 'text')}
                    className="text-teal-700 hover:text-teal-900 hover:bg-teal-50 font-semibold"
                  >
                    {copiedType === 'text' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedType === 'text' ? t.share.copied : t.share.copySummary}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      downloadTextFile(
                        `${(spec?.name ?? 'systonic_linear_desc').replace(/\s+/g, '_')}_share.txt`,
                        effectiveMessage,
                      );
                      toast.success(lang === 'bn' ? '.TXT ডাউনলোড হয়েছে!' : 'Downloaded .TXT share summary!');
                    }}
                    className="text-slate-600 hover:text-slate-900 font-semibold"
                  >
                    <Download className="w-3 h-3" />
                    <span>.TXT</span>
                  </Button>
                </div>
              </div>
              <Textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="text-xs leading-relaxed bg-slate-50/90 border-slate-200 rounded-xl text-slate-800 focus-visible:ring-teal-600/30"
              />
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
