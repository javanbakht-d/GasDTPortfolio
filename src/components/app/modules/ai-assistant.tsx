"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/app-store";
import { faDateTime } from "@/lib/persian-date-format";
import { api as apiClient, ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Send, Sparkles, Loader2, Info, RotateCcw } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string; configured?: boolean; disclaimer?: string };

type ChatResponse = { configured: boolean; answer?: string; message?: string; disclaimer?: string };

/** دستیار هوشمند دبیرخانه — پاسخ مستند، محدود به داده‌های مجاز کاربر */
export function AiAssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const user = useAppStore((s) => s.user);
  const hasPerm = useAppStore((s) => s.hasPerm);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canUse = hasPerm("ai_assistant:use");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const sendQuestion = async (question: string, priorMessages: ChatMsg[]) => {
    if (loading || !question.trim()) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const history = priorMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await apiClient.post<ChatResponse>("/api/ai/chat", { question, history });
      if (!mounted.current) return;
      if (res.configured && res.answer) {
        setMessages((m) => [...m, { role: "assistant", content: res.answer!, configured: true, disclaimer: res.disclaimer }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.message ?? "دستیار در دسترس نیست.", configured: false }]);
      }
    } catch (e) {
      if (!mounted.current) return;
      setMessages((m) => [...m, { role: "assistant", content: e instanceof ApiClientError ? e.message : "خطا در ارتباط با دستیار هوشمند", configured: false }]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // پرسش ارسالی از میزکار روزانه (سناریوهای دبیر شورا)
  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      if (q) sendQuestion(q, messages);
    };
    window.addEventListener("nigc-ai-question", handler);
    return () => window.removeEventListener("nigc-ai-question", handler);
  }, [messages, loading]);

  const ask = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    await sendQuestion(question, messages);
  };

  const askSample = (question: string) => {
    void sendQuestion(question, messages);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-amber-500" />
            دستیار هوشمند دبیرخانه
          </SheetTitle>
          <p className="text-xs text-muted-foreground leading-5 mt-1">
            پاسخ‌ها فقط بر اساس داده‌های مجاز شما تولید می‌شود. هر پاسخ «پیش‌نویس تولیدی هوش مصنوعی» است و جایگزین تصمیم رسمی نیست.
          </p>
        </SheetHeader>

        {!canUse ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
            دسترسی به دستیار هوشمند برای نقش شما فعال نشده است.
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm leading-6">
                    سلام {user?.fullName}! درباره وضعیت اقدامات، مهلت‌ها، پروژه‌ها، اسناد و شاخص‌های برنامه بپرسید.
                  </div>
                  <div className="text-xs font-medium text-muted-foreground px-1">سناریوهای دبیر شورا (پاسخ از داده واقعی سامانه):</div>
                  {[
                    "امروز باید به چه مواردی رسیدگی کنم؟",
                    "تا پایان هفته چه مهلت‌هایی داریم؟",
                    "کدام تعهدات ۳۰روزه هنوز تکمیل نشده‌اند؟",
                    "کدام اقدامات به تصمیم من نیاز دارند؟",
                    "فهرست موارد معوق به تفکیک واحدها را تهیه کن.",
                    "برای جلسه آتی شورا، دستور جلسه پیشنهادی بساز.",
                    "گزارش پیشرفت را از آخرین گزارش تا امروز تهیه کن.",
                    "چه اطلاعاتی برای تکمیل گزارش ۹۰روزه کم داریم؟",
                    "کدام پروژه‌ها به دلیل نبود داده یا تصمیم متوقف مانده‌اند؟",
                  ].map((s) => (
                    <button key={s} onClick={() => { askSample(s); }} className="w-full text-right rounded-lg border p-2.5 text-xs hover:border-emerald-600/40 hover:bg-emerald-50/30 disabled:opacity-50" disabled={loading}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap ${m.role === "user" ? "bg-slate-900 text-white" : m.configured ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-300 text-amber-900"}`}>
                      {m.content}
                      {m.disclaimer && <div className="text-[10px] text-emerald-700/70 mt-2 border-t border-emerald-200 pt-1.5">{m.disclaimer}</div>}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-end">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
                  placeholder="پرسش خود را بنویسید… (Enter برای ارسال)"
                  rows={2}
                  className="min-h-0"
                />
                <div className="flex flex-col gap-1.5">
                  <Button size="icon" onClick={ask} disabled={loading || !input.trim()} aria-label="ارسال پرسش">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  {messages.length > 0 && (
                    <Button size="icon" variant="outline" onClick={() => setMessages([])} aria-label="پاک‌کردن گفتگو">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2">
                <Info className="h-3 w-3" />
                اگر اطلاعات کافی در سامانه نباشد، دستیار صریحاً اعلام می‌کند و از ساخت داده خودداری می‌کند.
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
