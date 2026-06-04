import { useEffect, useMemo, useRef, useState } from "react";
import { getHealth } from "./api/health";
import { getLimits } from "./api/limits";
import { preloadChapter } from "./api/preloadChapter";
import { getProviders, setActiveProvider } from "./api/providers";
import { uploadBook } from "./api/uploadBook";
import { ApiClientError, type HealthResponse, type LimitsResponse } from "./types/api";
import type { ParsedBook, ParsedChapter } from "./types/book";
import type { ReadingPreloadRequest, ReadingPreloadViewModel } from "./types/readingPreload";

const T = {
  bg: "#F8F4EC",
  surface: "#FFFDF8",
  txtP: "#2A2520",
  txtS: "#7A6F64",
  border: "#E4D8C8",
  accent: "#8A6A43",
  soft: "#EFE3D0",
  sevHi: "#9A5A3C",
  sevMd: "#B08A5A",
  good: "#6F8D55",
};

const I18N = {
  zh: {
    productName: "Quiet Reader",
    tagline: "安静阅读，不被剧透打扰。",
    taglineDesc: "上传你的书籍，我们会在你开始阅读前，准备好无剧透的词汇预习。",
    noFlashcards: "不是背单词。不是刷题。\n只是你真正需要的词，\n在你需要的时候出现。",
    prepareTitle: "准备章节",
    prepareDesc: "上传书籍后，选择你想阅读的章节。",
    uploadTitle: "上传书籍",
    uploadDrop: "点击上传或拖拽 EPUB / TXT / Markdown 文件到这里",
    uploadHint: "上传后会调用真实后端解析目录与章节。",
    parseIdle: "尚未上传书籍",
    parseParsing: "正在解析书籍目录…",
    parseError: "解析失败",
    selectChapter: "选择章节",
    readingLevel: "阅读水平",
    readingLevelPh: "例如 IELTS 6.0 / B2 / CET-6",
    readingDiff: "阅读困难（可选）",
    readingDiffPh: "例如我经常卡在隐喻、长难句或描写性动词上。",
    prevSummary: "前情摘要（可选）",
    prevSummaryPh: "简单写下目前已经发生的内容。不要包含本章剧透。",
    ctaBtn: "生成阅读预览",
    generating: "正在生成…",
    beforeRead: "BEFORE YOU READ",
    beforeReadSub: "阅读前背景",
    noSpoilerNote: "无剧透：这里只解释阅读语境，不透露本章结果。",
    coreVocab: "CORE VOCABULARY",
    coreVocabSub: "核心词汇速览",
    safeContext: "SAFE CONTEXT",
    safeContextSub: "无剧透背景",
    statusKnown: "认识",
    statusFuzzy: "模糊",
    statusForgot: "忘记",
    startReading: "开始阅读",
    backSetup: "返回修改",
    beforeReadingLabel: "阅读前准备",
    tapHint: "点击下划线词汇\n查看详细释义。",
    panelKnown: "已认识",
    panelAddList: "加入词表",
    sectionChinese: "中文释义",
    sectionEnglish: "词汇类型",
    sectionSentence: "原句",
    sectionWhy: "为什么重要",
    backend: "后端",
    healthy: "健康",
  },
  en: {
    productName: "Quiet Reader",
    tagline: "Read smoothly, without spoilers.",
    taglineDesc: "Upload your book. We'll prepare a quiet, spoiler-free vocabulary preview before you start reading.",
    noFlashcards: "No flashcards. No quizzes.\nJust the words you actually need,\nexactly when you need them.",
    prepareTitle: "Prepare a Chapter",
    prepareDesc: "Upload a book, then choose the chapter you want to read.",
    uploadTitle: "Upload Book",
    uploadDrop: "Click to upload or drag EPUB / TXT / Markdown here",
    uploadHint: "The real backend will parse the table of contents and chapters.",
    parseIdle: "No book uploaded yet",
    parseParsing: "Parsing book contents…",
    parseError: "Failed to parse",
    selectChapter: "Select chapter",
    readingLevel: "Reading level",
    readingLevelPh: "e.g. IELTS 6.0 / B2 / CET-6",
    readingDiff: "Reading difficulties (optional)",
    readingDiffPh: "e.g. I often get stuck on metaphors, long sentences, or descriptive verbs.",
    prevSummary: "Safe previous summary (optional)",
    prevSummaryPh: "Summarize what has happened so far — no spoilers for this chapter.",
    ctaBtn: "Generate Reading Preview",
    generating: "Generating…",
    beforeRead: "BEFORE YOU READ",
    beforeReadSub: "Reading context",
    noSpoilerNote: "No spoilers: this preview only explains reading context, not chapter outcomes.",
    coreVocab: "CORE VOCABULARY",
    coreVocabSub: "Quick vocabulary preview",
    safeContext: "SAFE CONTEXT",
    safeContextSub: "Non-spoiler background",
    statusKnown: "Known",
    statusFuzzy: "Fuzzy",
    statusForgot: "Forgot",
    startReading: "Start Reading",
    backSetup: "Back to Setup",
    beforeReadingLabel: "Before reading",
    tapHint: "Tap an underlined word\nto see its meaning.",
    panelKnown: "Known",
    panelAddList: "Add to my list",
    sectionChinese: "CHINESE MEANING",
    sectionEnglish: "WORD TYPE",
    sectionSentence: "ORIGINAL SENTENCE",
    sectionWhy: "WHY IT MATTERS",
    backend: "Backend",
    healthy: "healthy",
  },
};

type Lang = keyof typeof I18N;
type Screen = "setup" | "preload" | "reader";
type ParseState = "idle" | "parsing" | "success" | "error";
type FrontendProvider = "gemini" | "deepseek";
type WordStatus = "known" | "fuzzy" | "forgot";
type ErrorState = {
  message: string;
  requestId?: string;
  code?: string;
  /** Raw provider detail — e.g. "Gemini request failed (400): SAFETY: ..." */
  detail?: string;
  retryAfterSec?: number;
};
type ApiCallStatus = {
  label: string;
  state: "idle" | "loading" | "success" | "error";
  detail?: string;
};

function Button({
  children,
  variant = "primary",
  onClick,
  full,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  onClick?: () => void;
  full?: boolean;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    padding: "0 24px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none",
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.45 : 1,
  };

  if (variant === "primary") {
    return (
      <button
        style={{ ...base, background: T.accent, color: "#fff" }}
        onClick={!disabled ? onClick : undefined}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      style={{
        ...base,
        background: "transparent",
        color: T.txtS,
        border: `1px solid ${T.border}`,
      }}
      onClick={!disabled ? onClick : undefined}
    >
      {children}
    </button>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={fieldStyle(44)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  placeholder,
  height = 88,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  height?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          ...fieldStyle(height),
          padding: "12px 14px",
          resize: "none",
          lineHeight: 1.6,
        }}
      />
    </div>
  );
}

function fieldStyle(height: number): React.CSSProperties {
  return {
    height,
    padding: "0 14px",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontSize: 15,
    color: T.txtP,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          ...fieldStyle(44),
          color: value ? T.txtP : T.txtS,
          appearance: "none",
          cursor: "pointer",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LanguageSwitcher({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        padding: 3,
      }}
    >
      {(["zh", "en"] as Lang[]).map((item) => (
        <button
          key={item}
          onClick={() => setLang(item)}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: "none",
            background: lang === item ? T.soft : "transparent",
            color: lang === item ? T.accent : T.txtS,
            fontSize: 12,
            fontWeight: lang === item ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {item === "zh" ? "中文" : "English"}
        </button>
      ))}
    </div>
  );
}

function ProviderSelector({
  selectedProvider,
  setSelectedProvider,
  availableProviders,
}: {
  selectedProvider: FrontendProvider;
  setSelectedProvider: (provider: FrontendProvider) => void | Promise<void>;
  /** Which providers have API keys configured on the backend. null = still loading. */
  availableProviders: FrontendProvider[] | null;
}) {
  const ALL_PROVIDERS: Array<{ key: FrontendProvider; label: string }> = [
    { key: "deepseek", label: "DeepSeek" },
    { key: "gemini",   label: "Gemini"   },
  ];

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 9,
        background: T.bg,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: T.txtS, marginBottom: 6 }}>
        Language model
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {ALL_PROVIDERS.map(({ key, label }) => {
          const isSelected  = selectedProvider === key;
          // grey out if we know it's not configured; always allow mock
          const isAvailable =
            availableProviders === null || availableProviders.includes(key);
          const isDisabled  = !isAvailable;

          return (
            <button
              key={key}
              onClick={() => {
                if (!isDisabled) void setSelectedProvider(key);
              }}
              title={isDisabled ? `${label} API key not configured in .env` : undefined}
              style={{
                border: `1px solid ${isSelected ? T.accent : T.border}`,
                borderRadius: 5,
                background: isSelected ? T.soft : T.surface,
                color: isSelected ? T.accent : isDisabled ? T.border : T.txtS,
                cursor: isDisabled ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                padding: "4px 10px",
                opacity: isDisabled ? 0.45 : 1,
                transition: "all .12s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {availableProviders !== null &&
        !availableProviders.includes(selectedProvider) && (
          <div style={{ fontSize: 11, color: T.sevHi, marginTop: 6 }}>
            {providerDisplayName(selectedProvider)} API key not found in .env —
            add {selectedProvider.toUpperCase()}_API_KEY and restart the server once.
          </div>
        )}
    </div>
  );
}

function EpubUploader({
  t,
  parseState,
  onFileSelect,
  book,
  error,
  limits,
}: {
  t: (typeof I18N)[Lang];
  parseState: ParseState;
  onFileSelect: (file: File) => void;
  book: ParsedBook | null;
  error: ErrorState | null;
  limits: LimitsResponse | null;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isParsing = parseState === "parsing";
  const isError = parseState === "error";

  const handleFile = (file?: File) => {
    if (file && !isParsing) {
      onFileSelect(file);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{t.uploadTitle}</label>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files[0]);
        }}
        style={{
          background: T.surface,
          border: `1px solid ${isError ? T.sevHi : T.border}`,
          borderRadius: 10,
          padding: "28px 20px",
          textAlign: "center",
          cursor: isParsing ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.md,.markdown,text/plain,text/markdown,application/epub+zip"
          style={{ display: "none" }}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <div style={{ marginBottom: 12, opacity: 0.62, color: T.sevMd, fontSize: 22 }}>
          {isParsing ? "◌" : "↑"}
        </div>
        <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.6 }}>
          {isParsing ? t.parseParsing : t.uploadDrop}
        </div>
      </div>
      <div style={{ fontSize: 12, color: T.txtS, lineHeight: 1.6 }}>
        {t.uploadHint}
        {limits?.maxUploadBytes ? ` · max ${formatBytes(limits.maxUploadBytes)}` : ""}
      </div>
      <ParseStatus state={parseState} t={t} book={book} error={error} />
    </div>
  );
}

function ParseStatus({
  state,
  t,
  book,
  error,
}: {
  state: ParseState;
  t: (typeof I18N)[Lang];
  book: ParsedBook | null;
  error: ErrorState | null;
}) {
  if (state === "idle") return null;

  const color = state === "error" ? T.sevHi : state === "success" ? T.accent : T.txtS;
  const dot = state === "error" ? T.sevHi : state === "success" ? T.good : T.sevMd;
  const text =
    state === "success" && book
      ? `Parsed: ${book.title} · ${book.chapters.length} chapters`
      : state === "error"
        ? `${t.parseError}: ${error?.message ?? ""}`
        : t.parseParsing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dot,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        {text}
      </div>
      {error?.requestId && (
        <div style={{ fontSize: 11, color: T.txtS }}>requestId: {error.requestId}</div>
      )}
    </div>
  );
}

function ErrorNotice({ error }: { error: ErrorState | null }) {
  if (!error) return null;

  return (
    <div
      style={{
        border: `1px solid ${T.sevHi}`,
        background: "#FFF8F3",
        borderRadius: 8,
        padding: "12px 14px",
        color: T.sevHi,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <div>{error.message}</div>
      {error.detail && (
        <div style={{ color: T.txtS, marginTop: 6, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
          {error.detail}
        </div>
      )}
      {(error.code === "VALIDATION_ERROR" || error.code === "BODY_TOO_LARGE") && (
        <div style={{ color: T.txtS, marginTop: 4 }}>
          Try a shorter chapter, smaller file, or check that all required fields are filled.
        </div>
      )}
      {error.code === "RATE_LIMITED" && (
        <div style={{ color: T.txtS, marginTop: 4 }}>
          The language model is rate-limiting requests — wait a moment and try again.
        </div>
      )}
      {error.code === "LLM_RATE_LIMITED" && (
        <div style={{ color: T.txtS, marginTop: 4 }}>
          Gemini/DeepSeek quota or rate limit was reached
          {error.retryAfterSec ? ` — wait about ${error.retryAfterSec}s` : ""}. You can retry later or restart the backend with another provider.
        </div>
      )}
      {error.code === "LLM_BILLING_ERROR" && (
        <div style={{ color: T.txtS, marginTop: 4 }}>
          DeepSeek/OpenAI billing is unavailable or the account balance is insufficient. Switch to Mock/Gemini, or add balance in the provider dashboard.
        </div>
      )}
      {error.code === "LLM_PROVIDER_ERROR" && (
        <div style={{ color: T.txtS, marginTop: 4 }}>
          The provider rejected this request. Check the backend provider, model access, and provider dashboard limits.
        </div>
      )}
      {error.requestId && (
        <div style={{ color: T.txtS, marginTop: 4 }}>requestId: {error.requestId}</div>
      )}
    </div>
  );
}

function VocabPreviewCard({
  item,
  status,
  onStatusChange,
  t,
}: {
  item: ReadingPreloadViewModel["previewCards"]["vocabulary"][number];
  status: WordStatus;
  onStatusChange: (id: string, status: WordStatus) => void;
  t: (typeof I18N)[Lang];
}) {
  const statuses: Array<{ key: WordStatus; label: string }> = [
    { key: "known", label: t.statusKnown },
    { key: "fuzzy", label: t.statusFuzzy },
    { key: "forgot", label: t.statusForgot },
  ];

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif" }}>
            {item.text}
          </span>
          <span style={{ fontSize: 12, color: T.txtS }}>{item.wordType}</span>
          <span style={{ fontSize: 11, color: severityColor(item.severity), marginLeft: "auto" }}>
            {item.severity}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 14, color: T.txtP, marginBottom: 2, lineHeight: 1.55 }}>
        {item.meaningInContextZh}
      </div>
      <div style={{ fontSize: 13, color: T.txtS, lineHeight: 1.5, marginBottom: 14 }}>
        {item.whyItMatters}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {statuses.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onStatusChange(item.id, key)}
            style={{
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 5,
              border: `1px solid ${status === key ? T.accent : T.border}`,
              background: status === key ? T.soft : "transparent",
              color: status === key ? T.accent : T.txtS,
              cursor: "pointer",
              fontWeight: status === key ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BeforeYouReadCard({
  t,
  preload,
}: {
  t: (typeof I18N)[Lang];
  preload: ReadingPreloadViewModel;
}) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.accent }}>
          {t.beforeRead}
        </div>
        <div style={{ fontSize: 12, color: T.txtS }}>{t.beforeReadSub}</div>
      </div>
      <p style={{ fontSize: 16, color: T.txtP, lineHeight: 1.85, fontFamily: "Georgia, serif", marginBottom: 20 }}>
        {preload.chapterHeader.nonSpoilerPreview}
      </p>
      <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: 18 }} />
      <p style={{ fontSize: 14, color: T.txtS, lineHeight: 1.8, marginBottom: 14 }}>
        {preload.safety.timelineBoundaryNote}
      </p>
      <div style={{ fontSize: 12, color: T.txtS, borderTop: `1px solid ${T.border}`, paddingTop: 14, fontStyle: "italic" }}>
        {t.noSpoilerNote}
      </div>
    </div>
  );
}

function ContextCard({
  item,
}: {
  item: ReadingPreloadViewModel["previewCards"]["context"][number];
}) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif" }}>
          {item.topic}
        </span>
        <span style={{ fontSize: 11, color: T.txtS }}>{item.category}</span>
      </div>
      <div style={{ fontSize: 14, color: T.txtP, lineHeight: 1.7, marginBottom: 8 }}>
        {item.explanationZh}
      </div>
      <div style={{ fontSize: 13, color: T.txtS, lineHeight: 1.65 }}>{item.whyUsefulNow}</div>
    </div>
  );
}

function AnnotationPanel({
  annotation,
  knownSet,
  listSet,
  onToggleKnown,
  onToggleList,
  t,
}: {
  annotation: ReadingPreloadViewModel["inlineAnnotations"][number] | null;
  knownSet: Set<string>;
  listSet: Set<string>;
  onToggleKnown: (id: string) => void;
  onToggleList: (id: string) => void;
  t: (typeof I18N)[Lang];
}) {
  if (!annotation) {
    return (
      <div style={{ width: 280, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 14, color: T.border }}>✦</div>
          <p style={{ fontSize: 14, color: T.txtS, lineHeight: 1.8, margin: 0, whiteSpace: "pre-line" }}>
            {t.tapHint}
          </p>
        </div>
      </div>
    );
  }

  const isKnown = knownSet.has(annotation.id);
  const isInList = listSet.has(annotation.id);

  return (
    <div style={{ width: 280, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif" }}>
            {annotation.text}
          </span>
          <span style={{ fontSize: 13, color: severityColor(annotation.severity) }}>{annotation.severity}</span>
        </div>
        <PanelSection label={t.sectionChinese}>{annotation.meaningInContextZh}</PanelSection>
        <PanelSection label={t.sectionSentence} italic>{annotation.sentence}</PanelSection>
      </div>
      <div style={{ padding: "16px 28px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        <PanelButton active={isKnown} onClick={() => onToggleKnown(annotation.id)}>
          {t.panelKnown}
        </PanelButton>
        <PanelButton active={isInList} onClick={() => onToggleList(annotation.id)}>
          {t.panelAddList}
        </PanelButton>
      </div>
    </div>
  );
}

function PanelSection({
  label,
  children,
  italic,
}: {
  label: string;
  children: React.ReactNode;
  italic?: boolean;
}) {
  return (
    <>
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.txtS, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.7, fontFamily: italic ? "Georgia, serif" : undefined, fontStyle: italic ? "italic" : undefined }}>
        {children}
      </div>
    </>
  );
}

function PanelButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 36,
        borderRadius: 6,
        border: `1px solid ${active ? T.accent : T.border}`,
        background: active ? T.soft : "transparent",
        color: active ? T.accent : T.txtS,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function AnnotatedWord({
  children,
  annotationId,
  severity,
  selectedId,
  onSelect,
}: {
  children: string;
  annotationId: string;
  severity: "low" | "medium" | "high";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const selected = selectedId === annotationId;

  return (
    <span
      onClick={() => onSelect(selected ? null : annotationId)}
      style={{
        cursor: "pointer",
        borderBottom: `1.5px solid ${selected ? T.accent : severityColor(severity)}`,
        paddingBottom: 1,
        background: selected ? T.soft : "transparent",
        borderRadius: selected ? 2 : 0,
      }}
    >
      {children}
    </span>
  );
}

function ChapterBar({ label, progress }: { label: string; progress: number }) {
  return (
    <div style={{ height: 48, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: T.txtS }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: T.txtS }}>{Math.round(progress * 100)}%</span>
        <div style={{ width: 100, height: 3, background: T.soft, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: T.accent }} />
        </div>
      </div>
    </div>
  );
}

function ReaderNavigation({
  onOpenToc,
  previousChapter,
  nextChapter,
  onChapterSwitch,
  isBusy,
}: {
  onOpenToc: () => void;
  previousChapter: ParsedChapter | null;
  nextChapter: ParsedChapter | null;
  onChapterSwitch: (chapter: ParsedChapter) => void;
  isBusy?: boolean;
}) {
  return (
    <div
      style={{
        height: 42,
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <QuietNavButton disabled={isBusy} onClick={onOpenToc}>Table of contents</QuietNavButton>
      <QuietNavButton
        disabled={isBusy || !previousChapter}
        onClick={() => previousChapter && onChapterSwitch(previousChapter)}
      >
        Previous chapter
      </QuietNavButton>
      <QuietNavButton
        disabled={isBusy || !nextChapter}
        onClick={() => nextChapter && onChapterSwitch(nextChapter)}
      >
        Next chapter
      </QuietNavButton>
    </div>
  );
}

function QuietNavButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        background: T.surface,
        color: disabled ? "#B8AA9B" : T.txtS,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 600,
        height: 28,
        opacity: disabled ? 0.58 : 1,
        padding: "0 11px",
      }}
    >
      {children}
    </button>
  );
}

function TableOfContentsDrawer({
  book,
  currentChapterId,
  onClose,
  onSelectChapter,
}: {
  book: ParsedBook;
  currentChapterId: string;
  onClose: () => void;
  onSelectChapter: (chapter: ParsedChapter) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 400,
        background: "rgba(42, 37, 32, 0.16)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 380,
          height: "100%",
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          boxShadow: "-18px 0 36px rgba(42, 37, 32, 0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "22px 24px 16px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div
                style={{
                  color: T.accent,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Table of contents
              </div>
              <div
                style={{
                  color: T.txtP,
                  fontFamily: "Georgia, serif",
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                {book.title}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                background: T.bg,
                color: T.txtS,
                cursor: "pointer",
                height: 28,
                padding: "0 9px",
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 22px" }}>
          {book.chapters.map((chapter) => {
            const current = chapter.id === currentChapterId;
            const muted = !isUsableChapter(chapter);

            return (
              <button
                key={chapter.id}
                onClick={() => {
                  if (!current) {
                    onSelectChapter(chapter);
                  }
                }}
                style={{
                  width: "100%",
                  border: `1px solid ${current ? T.accent : "transparent"}`,
                  borderRadius: 7,
                  background: current ? T.soft : "transparent",
                  color: muted ? "#AA9D8E" : T.txtP,
                  cursor: current ? "default" : "pointer",
                  display: "block",
                  marginBottom: 4,
                  opacity: muted ? 0.64 : 1,
                  padding: "10px 12px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: current ? 700 : 500 }}>
                  {chapter.index}. {chapter.title}
                </div>
                <div style={{ color: T.txtS, fontSize: 12, marginTop: 3 }}>
                  {chapter.wordCount.toLocaleString()} words
                  {muted ? " · likely front matter" : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SetupScreen({
  lang,
  setLang,
  onPreloadReady,
  book,
  setBook,
  selectedChapterId,
  setSelectedChapterId,
  health,
  limits,
  setLastApiStatus,
  selectedProvider,
  setSelectedProvider,
  availableProviders,
  readingLevel,
  setReadingLevel,
  readingDiff,
  setReadingDiff,
  prevSummary,
  setPrevSummary,
  onGenerateChapter,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onPreloadReady: (data: { preload: ReadingPreloadViewModel; chapter: ParsedChapter }) => void;
  book: ParsedBook | null;
  setBook: (book: ParsedBook | null) => void;
  selectedChapterId: string;
  setSelectedChapterId: (id: string) => void;
  health: HealthResponse | null;
  limits: LimitsResponse | null;
  setLastApiStatus: (status: ApiCallStatus) => void;
  selectedProvider: FrontendProvider;
  setSelectedProvider: (provider: FrontendProvider) => void | Promise<void>;
  availableProviders: FrontendProvider[] | null;
  readingLevel: string;
  setReadingLevel: (value: string) => void;
  readingDiff: string;
  setReadingDiff: (value: string) => void;
  prevSummary: string;
  setPrevSummary: (value: string) => void;
  onGenerateChapter: (chapter: ParsedChapter) => Promise<ReadingPreloadViewModel>;
}) {
  const t = I18N[lang];
  const [parseState, setParseState] = useState<ParseState>(book ? "success" : "idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedChapter = useMemo(
    () => book?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [book, selectedChapterId]
  );

  const handleProviderChange = async (provider: FrontendProvider) => {
    setError(null);

    try {
      await setSelectedProvider(provider);
    } catch (caught) {
      const nextError = toErrorState(caught);
      setError(nextError);
      setLastApiStatus({
        label: "switchProvider",
        state: "error",
        detail: nextError.requestId
          ? `${nextError.message} · ${nextError.requestId}`
          : nextError.message,
      });
    }
  };

  const handleFileSelect = async (file: File) => {
    setParseState("parsing");
    setError(null);
    setBook(null);
    setSelectedChapterId("");
    setLastApiStatus({
      label: "uploadBook",
      state: "loading",
      detail: file.name,
    });

    try {
      const parsed = await uploadBook(file);
      setBook(parsed);
      const firstChapter = findFirstUsableChapter(parsed.chapters);
      setSelectedChapterId(firstChapter?.id ?? "");
      setParseState("success");
      setLastApiStatus({
        label: "uploadBook",
        state: "success",
        detail: `${parsed.title} · ${parsed.chapters.length} chapters`,
      });
    } catch (caught) {
      const nextError = toErrorState(caught);
      setError(nextError);
      setParseState("error");
      setLastApiStatus({
        label: "uploadBook",
        state: "error",
        detail: nextError.requestId
          ? `${nextError.message} · ${nextError.requestId}`
          : nextError.message,
      });
    }
  };

  const handleGenerate = async () => {
    if (!book || !selectedChapter) {
      return;
    }

    setError(null);
    setIsGenerating(true);
    setLastApiStatus({
      label: "preloadChapter",
      state: "loading",
      detail: selectedChapter.title,
    });

    try {
      const preload = await onGenerateChapter(selectedChapter);
      onPreloadReady({ preload, chapter: selectedChapter });
    } catch (caught) {
      const nextError = toErrorState(caught);
      setError(nextError);
      setLastApiStatus({
        label: "preloadChapter",
        state: "error",
        detail: nextError.requestId
          ? `${nextError.message} · ${nextError.requestId}`
          : nextError.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceed = parseState === "success" && !!selectedChapter && !isGenerating;

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", top: 18, right: 24, zIndex: 10 }}>
        <LanguageSwitcher lang={lang} setLang={setLang} />
      </div>
      <div style={{ width: 440, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px", background: T.bg }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: T.accent, marginBottom: 20 }}>
          {t.productName}
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: T.txtP, lineHeight: 1.25, marginBottom: 16, fontFamily: "Georgia, serif" }}>
          {t.tagline}
        </h1>
        <p style={{ fontSize: 15, color: T.txtS, lineHeight: 1.85, marginBottom: 26 }}>
          {t.taglineDesc}
        </p>
        <BackendStatus health={health} t={t} />
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 28, marginTop: 28 }}>
          <p style={{ fontSize: 14, color: T.txtS, lineHeight: 1.85, whiteSpace: "pre-line" }}>
            {t.noFlashcards}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto", padding: "64px 64px" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.txtP, marginBottom: 6 }}>
            {t.prepareTitle}
          </div>
          <div style={{ fontSize: 14, color: T.txtS, marginBottom: 36 }}>{t.prepareDesc}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <EpubUploader
              t={t}
              parseState={parseState}
              onFileSelect={handleFileSelect}
              book={book}
              error={error}
              limits={limits}
            />

            <ProviderSelector
            selectedProvider={selectedProvider}
            setSelectedProvider={handleProviderChange}
            availableProviders={availableProviders}
          />

            {book && (
              <BookSummary book={book} />
            )}

            {parseState === "success" && book && (
              <SelectField
                label={t.selectChapter}
                value={selectedChapterId}
                onChange={setSelectedChapterId}
                options={book.chapters.map((chapter) => ({
                  value: chapter.id,
                  label: `${chapter.index}. ${chapter.title} · ${chapter.wordCount} words`,
                }))}
                placeholder={lang === "zh" ? "请选择章节…" : "Choose a chapter…"}
              />
            )}

            <InputField label={t.readingLevel} placeholder={t.readingLevelPh} value={readingLevel} onChange={setReadingLevel} />
            <TextAreaField label={t.readingDiff} placeholder={t.readingDiffPh} height={84} value={readingDiff} onChange={setReadingDiff} />
            <TextAreaField label={t.prevSummary} placeholder={t.prevSummaryPh} height={84} value={prevSummary} onChange={setPrevSummary} />
            <ErrorNotice error={error} />
            {limits?.maxChapterContentChars && (
              <div style={{ fontSize: 12, color: T.txtS }}>
                Max chapter length: {limits.maxChapterContentChars.toLocaleString()} characters
              </div>
            )}
            <div style={{ paddingTop: 4 }}>
              <Button full disabled={!canProceed} onClick={handleGenerate}>
                {isGenerating ? t.generating : t.ctaBtn}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackendStatus({ health, t }: { health: HealthResponse | null; t: (typeof I18N)[Lang] }) {
  if (!health?.ok) return null;

  return (
    <div style={{ fontSize: 13, color: T.txtS }}>
      {t.backend}: {t.healthy} · provider: {health.llmProvider}
    </div>
  );
}

function BookSummary({ book }: { book: ParsedBook }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.txtP, marginBottom: 4 }}>{book.title}</div>
      <div style={{ fontSize: 12, color: T.txtS, lineHeight: 1.6 }}>
        {book.author ? `${book.author} · ` : ""}
        {book.sourceType} · {book.chapters.length} chapters
      </div>
    </div>
  );
}

function ChapterPreloadScreen({
  lang,
  preload,
  onNext,
  onBack,
}: {
  lang: Lang;
  preload: ReadingPreloadViewModel;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = I18N[lang];
  const [statusMap, setStatusMap] = useState<Record<string, WordStatus>>(() =>
    Object.fromEntries(
      preload.previewCards.vocabulary.map((item) => [item.id, defaultStatus(item.severity)])
    )
  );

  const handleStatus = (id: string, status: WordStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  return (
    <div style={{ height: "100%", background: T.bg, display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ height: 48, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.txtS }}>{preload.chapterHeader.progressLabel}</span>
        <span style={{ fontSize: 13, color: T.txtS }}>{t.beforeReadingLabel}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "52px 40px 120px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.accent, marginBottom: 10 }}>
              {preload.chapterHeader.progressLabel}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif", marginBottom: 10 }}>
              {preload.chapterHeader.title}
            </h1>
            <div style={{ fontSize: 14, color: T.txtS }}>
              {preload.previewCards.vocabulary.length} flagged words · {preload.previewCards.context.length} context cards
            </div>
          </div>
          <div style={{ marginBottom: 52 }}>
            <BeforeYouReadCard t={t} preload={preload} />
          </div>
          <SectionTitle label={t.coreVocab} sub={t.coreVocabSub} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40 }}>
            {preload.previewCards.vocabulary.map((item) => (
              <VocabPreviewCard
                key={item.id}
                item={item}
                status={statusMap[item.id] ?? defaultStatus(item.severity)}
                onStatusChange={handleStatus}
                t={t}
              />
            ))}
          </div>
          {preload.previewCards.context.length > 0 && (
            <>
              <SectionTitle label={t.safeContext} sub={t.safeContextSub} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {preload.previewCards.context.map((item) => (
                  <ContextCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 0 32px", background: `linear-gradient(to top, ${T.bg} 60%, transparent)`, display: "flex", justifyContent: "center", gap: 12, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "all" }}><Button variant="ghost" onClick={onBack}>{t.backSetup}</Button></div>
        <div style={{ pointerEvents: "all" }}><Button onClick={onNext}>{t.startReading}</Button></div>
      </div>
    </div>
  );
}

function SectionTitle({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.txtS }}>{label}</div>
      <div style={{ fontSize: 12, color: T.txtS }}>{sub}</div>
    </div>
  );
}

function ImmersiveReaderScreen({
  lang,
  chapter,
  preload,
  book,
  onChapterSwitch,
  transition,
}: {
  lang: Lang;
  chapter: ParsedChapter;
  preload: ReadingPreloadViewModel;
  book: ParsedBook | null;
  onChapterSwitch: (chapter: ParsedChapter) => void;
  transition: {
    chapterTitle: string;
    direction: "previous" | "next" | "toc";
  } | null;
}) {
  const t = I18N[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [knownSet, setKnownSet] = useState(new Set<string>());
  const [listSet, setListSet] = useState(new Set<string>());
  const [tocOpen, setTocOpen] = useState(false);
  const selectedAnnotation =
    preload.inlineAnnotations.find((item) => item.id === selectedId) ?? null;
  const hasAnnotationMatches = hasAnyAnnotationMatch(
    chapter.content,
    preload.inlineAnnotations
  );
  const usableChapters = useMemo(
    () => book?.chapters.filter(isUsableChapter) ?? [],
    [book]
  );
  const currentUsableIndex = usableChapters.findIndex(
    (item) => item.id === chapter.id
  );
  const previousChapter =
    currentUsableIndex > 0 ? usableChapters[currentUsableIndex - 1] : null;
  const nextChapter =
    currentUsableIndex >= 0 && currentUsableIndex < usableChapters.length - 1
      ? usableChapters[currentUsableIndex + 1]
      : null;

  useEffect(() => {
    setSelectedId(null);
  }, [chapter.id]);

  const toggleKnown = (id: string) =>
    setKnownSet((prev) => toggleSet(prev, id));

  const toggleList = (id: string) =>
    setListSet((prev) => toggleSet(prev, id));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <ChapterBar label={`${preload.chapterHeader.progressLabel} · ${chapter.title}`} progress={0.18} />
      <ReaderNavigation
        onOpenToc={() => setTocOpen(true)}
        previousChapter={previousChapter}
        nextChapter={nextChapter}
        onChapterSwitch={onChapterSwitch}
        isBusy={!!transition}
      />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "64px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 40px" }}>
            {!hasAnnotationMatches && (
              <div
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  color: T.txtS,
                  fontSize: 13,
                  marginBottom: 28,
                  padding: "10px 12px",
                  background: T.surface,
                }}
              >
                No inline annotations matched this passage.
              </div>
            )}
            {renderAnnotatedParagraphs(chapter.content, preload.inlineAnnotations, selectedId, setSelectedId)}
          </div>
        </div>
        <AnnotationPanel
          annotation={selectedAnnotation}
          knownSet={knownSet}
          listSet={listSet}
          onToggleKnown={toggleKnown}
          onToggleList={toggleList}
          t={t}
        />
      </div>
      {tocOpen && book && (
        <TableOfContentsDrawer
          book={book}
          currentChapterId={chapter.id}
          onClose={() => setTocOpen(false)}
          onSelectChapter={(nextChapter) => {
            setTocOpen(false);
            onChapterSwitch(nextChapter);
          }}
        />
      )}
      {transition && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(248,244,236,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 180,
          }}
        >
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              background: T.surface,
              padding: "16px 20px",
              color: T.txtP,
              boxShadow: "0 18px 48px rgba(82,63,42,.12)",
              minWidth: 260,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: T.txtS, marginBottom: 4 }}>
              {transition.direction === "previous"
                ? "Preparing previous chapter"
                : transition.direction === "next"
                  ? "Preparing next chapter"
                  : "Preparing chapter"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {transition.chapterTitle}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuietReader() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [lang, setLang] = useState<Lang>("zh");
  const [selectedProvider, setSelectedProvider] =
    useState<FrontendProvider>("deepseek");
  // null = still loading; populated from GET /api/providers once on mount
  const [availableProviders, setAvailableProviders] =
    useState<FrontendProvider[] | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  const [book, setBook] = useState<ParsedBook | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [preload, setPreload] = useState<ReadingPreloadViewModel | null>(null);
  const [preloadSource, setPreloadSource] =
    useState<"not-loaded" | "real-api" | "stale">("not-loaded");
  const [readerChapter, setReaderChapter] = useState<ParsedChapter | null>(null);
  const [navHint, setNavHint] = useState("");
  const [lastApiStatus, setLastApiStatus] = useState<ApiCallStatus>({
    label: "none",
    state: "idle",
  });
  const [readingLevel, setReadingLevel] = useState("IELTS 6.0");
  const [readingDiff, setReadingDiff] = useState("");
  const [prevSummary, setPrevSummary] = useState("");
  const [readerTransition, setReaderTransition] = useState<{
    chapterTitle: string;
    direction: "previous" | "next" | "toc";
  } | null>(null);

  const selectedChapter = useMemo(
    () => book?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [book, selectedChapterId]
  );

  useEffect(() => {
    setLastApiStatus({
      label: "health",
      state: "loading",
    });
    void getHealth()
      .then((nextHealth) => {
        setHealth(nextHealth);
        if (isFrontendProvider(nextHealth.llmProvider)) {
          setSelectedProvider(nextHealth.llmProvider);
        }
        setLastApiStatus({
          label: "health",
          state: "success",
          detail: `provider: ${nextHealth.llmProvider}`,
        });
        // If the health response already carries availableProviders, use it
        // (new server format). Otherwise fall through to /api/providers.
        if (
          Array.isArray(
            (nextHealth as unknown as { availableProviders?: unknown })
              .availableProviders
          )
        ) {
          setAvailableProviders(
            (
              nextHealth as unknown as {
                availableProviders: string[];
              }
            ).availableProviders.filter(isFrontendProvider)
          );
        }
      })
      .catch((error: unknown) => {
        setHealth(null);
        setLastApiStatus({
          label: "health",
          state: "error",
          detail: error instanceof Error ? error.message : "health failed",
        });
      });
    // Fetch available providers (which have API keys configured)
    void getProviders()
      .then((providers) => {
        setAvailableProviders(providers.available.filter(isFrontendProvider));
        if (isFrontendProvider(providers.active)) {
          setSelectedProvider(providers.active);
        }
      })
      .catch(() => {
        // If the endpoint doesn't exist yet (old server), allow all providers
        setAvailableProviders(["deepseek", "gemini"]);
      });
    void getLimits().then(setLimits).catch(() => setLimits(null));
  }, []);

  const markPreloadStale = () => {
    setPreload(null);
    setReaderChapter(null);
    setPreloadSource(preload ? "stale" : "not-loaded");
    setLastApiStatus({
      label: "preloadChapter",
      state: "idle",
      detail: "Generate a reading preview for the selected chapter.",
    });
  };

  const handleSelectedChapterId = (id: string) => {
    setSelectedChapterId(id);
    markPreloadStale();
  };

  const handleBook = (nextBook: ParsedBook | null) => {
    setBook(nextBook);
    setSelectedChapterId("");
    setPreload(null);
    setReaderChapter(null);
    setPreloadSource("not-loaded");
    setScreen("setup");
  };

  const handleProviderChange = async (provider: FrontendProvider) => {
    if (provider === selectedProvider) {
      return;
    }

    setLastApiStatus({
      label: "switchProvider",
      state: "loading",
      detail: provider,
    });

    const providerStatus = await setActiveProvider(provider);
    setSelectedProvider(providerStatus.llmProvider);
    setAvailableProviders(providerStatus.availableProviders.filter(isFrontendProvider));
    setHealth({
      ok: true,
      message: "Reading Assistant API is healthy.",
      llmProvider: providerStatus.llmProvider,
      availableProviders: providerStatus.availableProviders,
    });
    setLastApiStatus({
      label: "switchProvider",
      state: "success",
      detail: `provider: ${providerStatus.llmProvider}`,
    });
  };

  const generateChapterPreload = async (
    chapter: ParsedChapter
  ): Promise<ReadingPreloadViewModel> => {
    if (!book) {
      throw new Error("Upload a book before generating a reading preview.");
    }

    setLastApiStatus({
      label: "preloadChapter",
      state: "loading",
      detail: chapter.title,
    });

    const payload: ReadingPreloadRequest = {
      userInput: {
        testScore: readingLevel,
        selfReportedDifficulties: readingDiff
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        testSentenceFeedback: [],
      },
      chapterInput: {
        title: chapter.title,
        content: chapter.content,
      },
      readingProgress: {
        bookTitle: book.title,
        currentChapterIndex: chapter.index,
        currentChapterTitle: chapter.title,
        safePreviousSummary: prevSummary,
      },
    };

    const nextPreload = await preloadChapter(payload, {
      provider: selectedProvider,
    });
    setLastApiStatus({
      label: "preloadChapter",
      state: "success",
      detail: `${nextPreload.previewCards.vocabulary.length} vocab · ${nextPreload.previewCards.context.length} context`,
    });

    return nextPreload;
  };

  const handleReaderChapterSwitch = (chapter: ParsedChapter) => {
    void (async () => {
      const currentIndex = readerChapter?.index ?? selectedChapter?.index ?? 0;
      setReaderTransition({
        chapterTitle: chapter.title,
        direction:
          chapter.index > currentIndex
            ? "next"
            : chapter.index < currentIndex
              ? "previous"
              : "toc",
      });
      setNavHint("");

      try {
        const nextPreload = await generateChapterPreload(chapter);
        setSelectedChapterId(chapter.id);
        setPreload(nextPreload);
        setReaderChapter(chapter);
        setPreloadSource("real-api");
        setScreen("reader");
      } catch (caught) {
        const nextError = toErrorState(caught);
        setLastApiStatus({
          label: "preloadChapter",
          state: "error",
          detail: nextError.requestId
            ? `${nextError.message} · ${nextError.requestId}`
            : nextError.message,
        });
        setNavHint(
          nextError.requestId
            ? `${nextError.message} (${nextError.requestId})`
            : nextError.message
        );
      } finally {
        setReaderTransition(null);
      }
    })();
  };

  return (
    <div style={{ width: "100%", minWidth: 1100, height: "100%", overflow: "hidden", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', color: T.txtP, background: T.bg, position: "relative" }}>
      <ScreenNav
        screen={screen}
        setScreen={setScreen}
        canOpenPreload={!!preload}
        canOpenReader={!!preload && !!readerChapter}
        setHint={setNavHint}
      />
      {navHint && <NavHint message={navHint} onDismiss={() => setNavHint("")} />}
      <div style={{ height: "100%" }}>
        {screen === "setup" && (
          <SetupScreen
            lang={lang}
            setLang={setLang}
            book={book}
            setBook={handleBook}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={handleSelectedChapterId}
            health={health}
            limits={limits}
            setLastApiStatus={setLastApiStatus}
            selectedProvider={selectedProvider}
            setSelectedProvider={handleProviderChange}
            availableProviders={availableProviders}
            readingLevel={readingLevel}
            setReadingLevel={setReadingLevel}
            readingDiff={readingDiff}
            setReadingDiff={setReadingDiff}
            prevSummary={prevSummary}
            setPrevSummary={setPrevSummary}
            onGenerateChapter={generateChapterPreload}
            onPreloadReady={({ preload: nextPreload, chapter }) => {
              setPreload(nextPreload);
              setPreloadSource("real-api");
              setReaderChapter(chapter);
              setScreen("preload");
              setNavHint("");
            }}
          />
        )}
        {screen === "preload" &&
          (preload ? (
            <ChapterPreloadScreen
              lang={lang}
              preload={preload}
              onNext={() => setScreen("reader")}
              onBack={() => setScreen("setup")}
            />
          ) : (
            <EmptyState
              title="No reading preview loaded"
              message="Go back to setup and generate a preview from a real uploaded chapter."
              onBack={() => setScreen("setup")}
            />
          ))}
        {screen === "reader" &&
          (preload && readerChapter ? (
            <ImmersiveReaderScreen
              lang={lang}
              preload={preload}
              chapter={readerChapter}
              book={book}
              onChapterSwitch={handleReaderChapterSwitch}
              transition={readerTransition}
            />
          ) : (
            <EmptyState
              title="No reader content loaded"
              message="The reader needs a selected chapter and a real preload response."
              onBack={() => setScreen("setup")}
            />
          ))}
      </div>
      <DevStatusPanel
        health={health}
        selectedProvider={selectedProvider}
        book={book}
        selectedChapter={selectedChapter}
        lastApiStatus={lastApiStatus}
        preloadSource={preloadSource}
        preload={preload}
      />
    </div>
  );
}

function EmptyState({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
      }}
    >
      <div
        style={{
          width: 420,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          background: T.surface,
          padding: 28,
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            color: T.txtP,
            fontFamily: "Georgia, serif",
            fontSize: 24,
          }}
        >
          {title}
        </h2>
        <p style={{ margin: "0 0 22px", color: T.txtS, lineHeight: 1.7 }}>
          {message}
        </p>
        <Button variant="ghost" onClick={onBack}>
          Back to setup
        </Button>
      </div>
    </div>
  );
}

function ScreenNav({
  screen,
  setScreen,
  canOpenPreload,
  canOpenReader,
  setHint,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  canOpenPreload: boolean;
  canOpenReader: boolean;
  setHint: (message: string) => void;
}) {
  const items: Array<{
    key: Screen;
    label: string;
    enabled: boolean;
    hint?: string;
  }> = [
    { key: "setup", label: "01 Setup", enabled: true },
    {
      key: "preload",
      label: "02 Preload",
      enabled: canOpenPreload,
      hint: "Generate a reading preview first.",
    },
    {
      key: "reader",
      label: "03 Reader",
      enabled: canOpenReader,
      hint: "Generate a reading preview first.",
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 132,
        zIndex: 260,
        display: "flex",
        gap: 3,
        background: "rgba(255,253,248,.96)",
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: 3,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            if (!item.enabled) {
              setHint(item.hint ?? "Generate a reading preview first.");
              return;
            }

            setScreen(item.key);
            setHint("");
          }}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            border: "none",
            background: screen === item.key ? T.accent : "transparent",
            color:
              screen === item.key ? "#fff" : item.enabled ? T.txtS : "#B8AA9B",
            fontSize: 12,
            fontWeight: 600,
            cursor: item.enabled ? "pointer" : "not-allowed",
            opacity: item.enabled ? 1 : 0.62,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function NavHint({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 132,
        zIndex: 260,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        background: "rgba(255,253,248,.98)",
        color: T.txtS,
        fontSize: 12,
        lineHeight: 1.5,
        padding: "8px 11px",
        boxShadow: "0 8px 20px rgba(42, 37, 32, 0.08)",
      }}
    >
      {message}
    </div>
  );
}

function DevStatusPanel({
  health,
  selectedProvider,
  book,
  selectedChapter,
  lastApiStatus,
  preloadSource,
  preload,
}: {
  health: HealthResponse | null;
  selectedProvider: FrontendProvider;
  book: ParsedBook | null;
  selectedChapter: ParsedChapter | null;
  lastApiStatus: ApiCallStatus;
  preloadSource: "not-loaded" | "real-api" | "stale";
  preload: ReadingPreloadViewModel | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        bottom: 14,
        zIndex: 300,
        width: 280,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        background: "rgba(255, 253, 248, 0.94)",
        color: T.txtS,
        fontSize: 11,
        lineHeight: 1.55,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(42, 37, 32, 0.08)",
      }}
    >
      <div style={{ color: T.accent, fontWeight: 700, marginBottom: 4 }}>
        Dev status
      </div>
      <StatusRow label="backend" value={health?.ok ? "healthy" : "error"} />
      <StatusRow label="provider" value={health?.llmProvider ?? "unknown"} />
      <StatusRow label="selected provider" value={selectedProvider} />
      <StatusRow label="book" value={book?.title ?? "not-loaded"} />
      <StatusRow label="chapter" value={selectedChapter?.title ?? "not-selected"} />
      <StatusRow
        label="wordCount"
        value={selectedChapter ? String(selectedChapter.wordCount) : "-"}
      />
      <StatusRow
        label="last API"
        value={`${lastApiStatus.label}: ${lastApiStatus.state}${
          lastApiStatus.detail ? ` · ${lastApiStatus.detail}` : ""
        }`}
      />
      <StatusRow label="preload source" value={preloadSource} />
      <StatusRow
        label="vocab/context/ann"
        value={
          preload
            ? `${preload.previewCards.vocabulary.length}/${preload.previewCards.context.length}/${preload.inlineAnnotations.length}`
            : "0/0/0"
        }
      />
      {health?.llmProvider === "mock" && (
        <div style={{ marginTop: 5, color: T.sevMd }}>
          Provider: mock means LLM content is canned by the backend mock client.
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ minWidth: 82, color: T.txtS }}>{label}</span>
      <span style={{ color: T.txtP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function renderAnnotatedParagraphs(
  content: string,
  annotations: ReadingPreloadViewModel["inlineAnnotations"],
  selectedId: string | null,
  onSelect: (id: string | null) => void
) {
  return content.split(/\n{2,}/).filter(Boolean).map((paragraph, paragraphIndex) => (
    <p
      key={paragraphIndex}
      style={{
        fontSize: 20,
        lineHeight: "36px",
        color: T.txtP,
        fontFamily: "Georgia, serif",
        marginBottom: 28,
        whiteSpace: "pre-wrap",
      }}
    >
      {annotateText(paragraph, annotations, selectedId, onSelect)}
    </p>
  ));
}

function annotateText(
  text: string,
  annotations: ReadingPreloadViewModel["inlineAnnotations"],
  selectedId: string | null,
  onSelect: (id: string | null) => void
) {
  const matches: Array<{ start: number; end: number; annotation: ReadingPreloadViewModel["inlineAnnotations"][number] }> = [];
  const claimed = new Set<number>();

  for (const annotation of annotations) {
    const needle = annotation.text.trim();
    if (!needle) continue;

    const regex = new RegExp(escapeRegExp(needle), "gi");
    for (const match of text.matchAll(regex)) {
      const start = match.index ?? -1;
      const end = start + match[0].length;

      if (start >= 0 && !rangeClaimed(start, end, claimed)) {
        for (let index = start; index < end; index += 1) claimed.add(index);
        matches.push({ start, end, annotation });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.start > cursor) {
      nodes.push(<span key={`text-${index}`}>{text.slice(cursor, match.start)}</span>);
    }

    nodes.push(
      <AnnotatedWord
        key={`${match.annotation.id}-${match.start}`}
        annotationId={match.annotation.id}
        severity={match.annotation.severity}
        selectedId={selectedId}
        onSelect={onSelect}
      >
        {text.slice(match.start, match.end)}
      </AnnotatedWord>
    );
    cursor = match.end;
  });

  if (cursor < text.length) {
    nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return nodes;
}

function rangeClaimed(start: number, end: number, claimed: Set<number>): boolean {
  for (let index = start; index < end; index += 1) {
    if (claimed.has(index)) {
      return true;
    }
  }

  return false;
}

function hasAnyAnnotationMatch(
  content: string,
  annotations: ReadingPreloadViewModel["inlineAnnotations"]
): boolean {
  const lowerContent = content.toLowerCase();

  return annotations.some((annotation) => {
    const text = annotation.text.trim().toLowerCase();
    return text.length > 0 && lowerContent.includes(text);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function severityColor(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return T.sevHi;
  if (severity === "medium") return T.sevMd;
  return T.accent;
}

function defaultStatus(severity: "low" | "medium" | "high"): WordStatus {
  if (severity === "high") return "forgot";
  if (severity === "medium") return "fuzzy";
  return "known";
}

function toggleSet<TValue>(set: Set<TValue>, value: TValue): Set<TValue> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

function toErrorState(error: unknown): ErrorState {
  if (error instanceof ApiClientError) {
    // Extract the provider-level detail (httpStatus + raw error message)
    // added by the backend in error.details.detail
    const detail =
      error.details &&
      typeof error.details === "object" &&
      "detail" in error.details &&
      typeof (error.details as Record<string, unknown>).detail === "string"
        ? (error.details as Record<string, string>).detail
        : undefined;
    const retryAfterSec =
      error.details &&
      typeof error.details === "object" &&
      "retryAfterSec" in error.details &&
      typeof (error.details as Record<string, unknown>).retryAfterSec === "number"
        ? (error.details as Record<string, number>).retryAfterSec
        : undefined;

    return {
      message: error.message,
      requestId: error.requestId,
      code: error.code,
      detail,
      retryAfterSec,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

function findFirstUsableChapter(chapters: ParsedChapter[]): ParsedChapter | null {
  const contentChapters = chapters.filter(isUsableChapter);

  return (
    contentChapters.find((chapter) => chapter.wordCount > 100) ??
    contentChapters[0] ??
    chapters.find((chapter) => chapter.content.trim().length > 0) ??
    null
  );
}

function isUsableChapter(chapter: ParsedChapter): boolean {
  const title = chapter.title.toLowerCase();

  return (
    chapter.content.trim().length > 0 &&
    !/\b(table of contents|contents|cover|copyright|title page)\b/.test(title) &&
    chapter.wordCount >= 20
  );
}

function providerDisplayName(provider: FrontendProvider): string {
  if (provider === "gemini") return "Gemini";
  return "DeepSeek";
}

function isFrontendProvider(value: unknown): value is FrontendProvider {
  return value === "gemini" || value === "deepseek";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} bytes`;
}
