import { useState, useRef, useEffect } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#F8F4EC",
  surface: "#FFFDF8",
  txtP:    "#2A2520",
  txtS:    "#7A6F64",
  border:  "#E4D8C8",
  accent:  "#8A6A43",
  soft:    "#EFE3D0",
  sevHi:   "#9A5A3C",
  sevMd:   "#B08A5A",
};

// ─── i18n ─────────────────────────────────────────────────────────────────────
const I18N = {
  zh: {
    lang: "zh",
    // Setup — left panel
    productName: "Quiet Reader",
    tagline: "安静阅读，不被剧透打扰。",
    taglineDesc: "上传你的 EPUB 书籍，我们会在你开始阅读前，准备好无剧透的词汇预习。",
    noFlashcards: "不是背单词。不是刷题。\n只是你真正需要的词，\n在你需要的时候出现。",
    // Setup — right panel
    prepareTitle: "准备章节",
    prepareDesc: "上传书籍后，选择你想阅读的章节。",
    uploadTitle: "上传 EPUB 书籍",
    uploadDrop: "点击上传或拖拽 EPUB 文件到这里",
    uploadHint: "支持 .epub 格式。上传后将自动解析目录。",
    parseIdle: "尚未上传书籍",
    parseParsing: "正在解析书籍目录…",
    parseSuccess: "已解析：《小王子》",
    parseError: "解析失败，请重新上传 EPUB 文件",
    selectChapter: "选择章节",
    readingLevel: "阅读水平",
    readingLevelPh: "例如 IELTS 6.0 / B2 / CET-6",
    readingDiff: "阅读困难（可选）",
    readingDiffPh: "例如我经常卡在隐喻、长难句或描写性动词上。",
    prevSummary: "前情摘要（可选）",
    prevSummaryPh: "简单写下目前已经发生的内容。不要包含本章剧透。",
    ctaBtn: "生成阅读预览",
    // Preload
    beforeRead: "BEFORE YOU READ",
    beforeReadSub: "阅读前背景",
    noSpoilerNote: "无剧透：这里只解释阅读语境，不透露本章结果。",
    coreVocab: "CORE VOCABULARY",
    coreVocabSub: "核心词汇速览",
    statusKnown: "认识",
    statusFuzzy: "模糊",
    statusForgot: "忘记",
    startReading: "开始阅读",
    backSetup: "返回修改",
    beforeReadingLabel: "阅读前准备",
    // Reader
    tapHint: "点击下划线词汇\n查看详细释义。",
    panelKnown: "已认识",
    panelAddList: "加入词表",
    sectionChinese: "中文释义",
    sectionEnglish: "英文释义",
    sectionSentence: "原句",
    sectionWhy: "为什么重要",
    chapterLabel: (ch) => `小王子 · ${ch}`,
  },
  en: {
    lang: "en",
    productName: "Quiet Reader",
    tagline: "Read smoothly, without spoilers.",
    taglineDesc: "Upload your EPUB book. We'll prepare a quiet, spoiler-free vocabulary preview before you start reading.",
    noFlashcards: "No flashcards. No quizzes.\nJust the words you actually need,\nexactly when you need them.",
    prepareTitle: "Prepare a Chapter",
    prepareDesc: "Upload a book, then choose the chapter you want to read.",
    uploadTitle: "Upload EPUB Book",
    uploadDrop: "Click to upload or drag an EPUB file here",
    uploadHint: "Supports .epub files. The table of contents will be parsed automatically.",
    parseIdle: "No book uploaded yet",
    parseParsing: "Parsing book contents…",
    parseSuccess: "Parsed: The Little Prince",
    parseError: "Failed to parse. Please upload the EPUB again.",
    selectChapter: "Select chapter",
    readingLevel: "Reading level",
    readingLevelPh: "e.g. IELTS 6.0 / B2 / CET-6",
    readingDiff: "Reading difficulties (optional)",
    readingDiffPh: "e.g. I often get stuck on metaphors, long sentences, or descriptive verbs.",
    prevSummary: "Safe previous summary (optional)",
    prevSummaryPh: "Summarize what has happened so far — no spoilers for this chapter.",
    ctaBtn: "Generate Reading Preview",
    beforeRead: "BEFORE YOU READ",
    beforeReadSub: "Reading context",
    noSpoilerNote: "No spoilers: this preview only explains the reading context, not the outcome of the chapter.",
    coreVocab: "CORE VOCABULARY",
    coreVocabSub: "Quick vocabulary preview",
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
    sectionEnglish: "ENGLISH DEFINITION",
    sectionSentence: "ORIGINAL SENTENCE",
    sectionWhy: "WHY IT MATTERS",
    chapterLabel: (ch) => `The Little Prince · ${ch}`,
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHAPTERS = [
  { id: "ch1", index: 1, titleEn: "Chapter 1 · The Drawing of the Boa Constrictor", titleZh: "第 1 章 · 蟒蛇图画" },
  { id: "ch2", index: 2, titleEn: "Chapter 2 · The Little Prince Appears",           titleZh: "第 2 章 · 小王子出现" },
  { id: "ch3", index: 3, titleEn: "Chapter 3 · The Prince's Planet",                  titleZh: "第 3 章 · 小王子的星球" },
  { id: "ch4", index: 4, titleEn: "Chapter 4 · The Asteroid B-612",                   titleZh: "第 4 章 · 小行星 B-612" },
  { id: "ch5", index: 5, titleEn: "Chapter 5 · The Baobabs",                          titleZh: "第 5 章 · 猴面包树" },
  { id: "ch6", index: 6, titleEn: "Chapter 6 · The Sunset",                           titleZh: "第 6 章 · 日落" },
];

const VOCAB_DATA = [
  {
    id: "scarcely",
    word: "scarcely",
    partOfSpeech: "adv.",
    phonetic: "/ˈskeəsli/",
    chineseMeaning: "几乎不；刚刚",
    englishDefinition: "almost not; only just",
    whyItMatters: "提示叙述者几乎没有时间反应，强化了小王子突然出现带来的措手不及感。",
    originalSentence: "I had scarcely had time to drink the water, when I noticed an extraordinary little fellow.",
    defaultStatus: "forgot",
  },
  {
    id: "extraordinary",
    word: "extraordinary",
    partOfSpeech: "adj.",
    phonetic: "/ɪkˈstrɔːrdəneri/",
    chineseMeaning: "非凡的；出乎意料的",
    englishDefinition: "very unusual or surprising",
    whyItMatters: "叙述者对小王子的第一印象词，暗示他与普通世界截然不同。",
    originalSentence: "I noticed an extraordinary little fellow who was looking at me very seriously.",
    defaultStatus: "fuzzy",
  },
  {
    id: "apparition",
    word: "apparition",
    partOfSpeech: "n.",
    phonetic: "/ˌæpəˈrɪʃən/",
    chineseMeaning: "幽灵般出现的人或物；幻影",
    englishDefinition: "a strange or ghostly figure that appears suddenly",
    whyItMatters: "暗示小王子的出现带有超现实色彩，几乎像沙漠中凭空而来的幻觉。",
    originalSentence: "He seemed less like a real child and more like an apparition from another world.",
    defaultStatus: "forgot",
  },
  {
    id: "examine",
    word: "examine",
    partOfSpeech: "v.",
    phonetic: "/ɪɡˈzæmɪn/",
    chineseMeaning: "仔细查看；检查",
    englishDefinition: "to look at or consider something carefully",
    whyItMatters: "叙述者用理性动作回应超现实场景，体现了成人视角的习惯性逻辑。",
    originalSentence: "I took a moment to examine him more carefully, as he seemed utterly out of place.",
    defaultStatus: "known",
  },
  {
    id: "bewildered",
    word: "bewildered",
    partOfSpeech: "adj.",
    phonetic: "/bɪˈwɪldərd/",
    chineseMeaning: "困惑的；不知所措的",
    englishDefinition: "completely confused and unsure what to do",
    whyItMatters: "叙述者的困惑贯穿整章，与小王子沉静笃定的态度形成对比。",
    originalSentence: "I was bewildered by his reply — he spoke as if drawing a sheep were entirely ordinary.",
    defaultStatus: "fuzzy",
  },
  {
    id: "sheep",
    word: "sheep",
    partOfSpeech: "n.",
    phonetic: "/ʃiːp/",
    chineseMeaning: "羊",
    englishDefinition: "a farm animal with a woolly coat, kept for wool or meat",
    whyItMatters: "小王子的第一个请求就是要一只羊的图画，这只羊的意象贯穿整本书。",
    originalSentence: '"Please, draw me a sheep," he said, as if it were the most natural thing in the world.',
    defaultStatus: "known",
  },
];

// Annotated reading paragraphs — The Little Prince, Chapter 2 (mock)
const READER_PARAGRAPHS = [
  [
    { t: "text", v: "I had " },
    { t: "word", v: "scarcely", id: "scarcely" },
    { t: "text", v: " had time to drink the water, when I noticed an " },
    { t: "word", v: "extraordinary", id: "extraordinary" },
    { t: "text", v: " little fellow who was looking at me very seriously." },
  ],
  [
    { t: "text", v: "He was standing there in the desert, with no sign of fear or fatigue. I took a moment to " },
    { t: "word", v: "examine", id: "examine" },
    { t: "text", v: " him more carefully — he seemed to have appeared from nowhere, utterly out of place in the vast silence." },
  ],
  [
    { t: "text", v: "When I finally managed to speak, I asked him what he was doing there. But I was " },
    { t: "word", v: "bewildered", id: "bewildered" },
    { t: "text", v: " by his reply. He answered only with a request, made as if it were the most natural thing in the world:" },
  ],
  [
    { t: "text", v: '"Please, draw me a ' },
    { t: "word", v: "sheep", id: "sheep" },
    { t: "text", v: '," he said, tilting his head slightly, waiting with great seriousness.' },
  ],
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function Button({ children, variant = "primary", onClick, full, disabled }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 44, padding: "0 24px", borderRadius: 8,
    fontSize: 15, fontWeight: 600, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none", transition: "opacity .15s",
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.45 : 1,
  };
  if (variant === "primary")
    return <button style={{ ...base, background: T.accent, color: "#fff" }} onClick={!disabled ? onClick : undefined}>{children}</button>;
  return (
    <button style={{ ...base, background: "transparent", color: T.txtS, border: `1px solid ${T.border}` }} onClick={!disabled ? onClick : undefined}>
      {children}
    </button>
  );
}

function InputField({ label, placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>}
      <input type="text" placeholder={placeholder} style={{
        height: 44, padding: "0 14px", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 15,
        color: T.txtP, fontFamily: "inherit", outline: "none",
        width: "100%", boxSizing: "border-box",
      }} />
    </div>
  );
}

function TextAreaField({ label, placeholder, height = 88 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>}
      <textarea placeholder={placeholder} style={{
        height, padding: "12px 14px", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 15,
        color: T.txtP, fontFamily: "inherit", outline: "none", resize: "none",
        lineHeight: 1.6, width: "100%", boxSizing: "border-box",
      }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        height: 44, padding: "0 14px", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 15,
        color: value ? T.txtP : T.txtS, fontFamily: "inherit", outline: "none",
        appearance: "none", width: "100%", boxSizing: "border-box",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A6F64' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight: 36,
        cursor: "pointer",
      }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Language switcher ────────────────────────────────────────────────────────

function LanguageSwitcher({ lang, setLang }) {
  return (
    <div style={{
      display: "flex", gap: 2,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 7, padding: 3,
    }}>
      {["zh", "en"].map((l) => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: "4px 10px", borderRadius: 4, border: "none",
          background: lang === l ? T.soft : "transparent",
          color: lang === l ? T.accent : T.txtS,
          fontSize: 12, fontWeight: lang === l ? 600 : 400,
          fontFamily: "inherit", cursor: "pointer",
          transition: "all .15s",
        }}>
          {l === "zh" ? "中文" : "English"}
        </button>
      ))}
    </div>
  );
}

// ─── EPUB Uploader ────────────────────────────────────────────────────────────

function EpubUploader({ t, parseState, onFileSelect }) {
  const fileRef = useRef(null);
  const isDragging = useRef(false);

  const handleClick = () => fileRef.current?.click();

  const handleFile = () => {
    if (fileRef.current?.files?.[0]) onFileSelect();
  };

  const iconColor = T.sevMd;

  const isParsing = parseState === "parsing";
  const isError   = parseState === "error";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.txtS }}>{t.uploadTitle}</label>

      {/* Drop zone */}
      <div
        onClick={handleClick}
        style={{
          background: T.surface,
          border: `1px solid ${isError ? T.sevHi : T.border}`,
          borderRadius: 10,
          padding: "28px 20px",
          textAlign: "center",
          cursor: isParsing ? "default" : "pointer",
          transition: "border-color .15s",
          userSelect: "none",
        }}
      >
        <input ref={fileRef} type="file" accept=".epub" style={{ display: "none" }} onChange={handleFile} />

        {/* Icon */}
        <div style={{ marginBottom: 12, opacity: 0.6 }}>
          {isParsing ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 7l-4-4-4 4M12 3v13"/>
            </svg>
          )}
        </div>

        <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.6 }}>
          {isParsing ? t.parseParsing : t.uploadDrop}
        </div>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 12, color: T.txtS, lineHeight: 1.6 }}>{t.uploadHint}</div>

      {/* Parse status */}
      <ParseStatus state={parseState} t={t} />
    </div>
  );
}

function ParseStatus({ state, t }) {
  if (state === "idle") return null;

  const configs = {
    parsing: { color: T.txtS,  dot: T.sevMd,  text: t.parseParsing  },
    success: { color: T.accent, dot: "#7A9A5A", text: t.parseSuccess  },
    error:   { color: T.sevHi, dot: T.sevHi,  text: t.parseError    },
  };
  const c = configs[state];
  if (!c) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.color }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0, display: "inline-block" }} />
      {c.text}
    </div>
  );
}

// ─── Chapter selector ─────────────────────────────────────────────────────────

function ChapterSelector({ t, lang, value, onChange }) {
  const options = CHAPTERS.map((ch) => ({
    value: ch.id,
    label: lang === "zh" ? ch.titleZh : ch.titleEn,
  }));
  return (
    <SelectField
      label={t.selectChapter}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={lang === "zh" ? "请选择章节…" : "Choose a chapter…"}
    />
  );
}

// ─── Vocab preview card (Preload) ─────────────────────────────────────────────

function VocabPreviewCard({ item, status, onStatusChange, t }) {
  const statuses = [
    { key: "known",  label: t.statusKnown  },
    { key: "fuzzy",  label: t.statusFuzzy  },
    { key: "forgot", label: t.statusForgot },
  ];

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      {/* Word + POS + phonetic */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif" }}>
            {item.word}
          </span>
          <span style={{ fontSize: 12, color: T.txtS }}>{item.partOfSpeech}</span>
        </div>
        <div style={{ fontSize: 12, color: T.sevMd, letterSpacing: ".3px" }}>{item.phonetic}</div>
      </div>

      {/* Meanings */}
      <div style={{ fontSize: 14, color: T.txtP, marginBottom: 2, lineHeight: 1.55 }}>
        {item.chineseMeaning}
      </div>
      <div style={{ fontSize: 13, color: T.txtS, lineHeight: 1.5, marginBottom: 14 }}>
        {item.englishDefinition}
      </div>

      {/* Status buttons */}
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
              fontFamily: "inherit",
              cursor: "pointer",
              fontWeight: status === key ? 600 : 400,
              transition: "all .12s",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Before You Read card (Preload) ──────────────────────────────────────────

function BeforeYouReadCard({ t }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "28px 32px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.accent }}>
          {t.beforeRead}
        </div>
        <div style={{ fontSize: 12, color: T.txtS }}>{t.beforeReadSub}</div>
      </div>

      {/* English context */}
      <p style={{ fontSize: 16, color: T.txtP, lineHeight: 1.85, fontFamily: "Georgia, serif", marginBottom: 20 }}>
        In this chapter, the narrator meets a small, serious child in an impossible place: the desert. You do not need to know where the child comes from yet. Focus on the contrast between the adult narrator's practical worries and the child's quiet, unexpected request.
      </p>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: 20 }} />

      {/* Chinese context */}
      <p style={{ fontSize: 15, color: T.txtS, lineHeight: 1.9, marginBottom: 16 }}>
        这一章中，叙述者会在一个几乎不可能遇见人的地方——沙漠里——遇到一个小而认真的孩子。你暂时不需要知道他来自哪里。阅读时可以留意：成年叙述者现实而紧张的处境，和这个孩子安静却出人意料的请求之间的反差。
      </p>

      {/* No-spoiler note */}
      <div style={{
        fontSize: 12,
        color: T.txtS,
        borderTop: `1px solid ${T.border}`,
        paddingTop: 14,
        fontStyle: "italic",
      }}>
        {t.noSpoilerNote}
      </div>
    </div>
  );
}

// ─── Annotation panel (Reader) ────────────────────────────────────────────────

function AnnotationPanel({ selectedId, knownSet, listSet, onToggleKnown, onToggleList, t }) {
  const item = VOCAB_DATA.find((v) => v.id === selectedId);

  if (!item) {
    return (
      <div style={{
        width: 280, flexShrink: 0, background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 28,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 14, color: T.border }}>✦</div>
          <p style={{ fontSize: 14, color: T.txtS, lineHeight: 1.8, margin: 0, whiteSpace: "pre-line" }}>
            {t.tapHint}
          </p>
        </div>
      </div>
    );
  }

  const isKnown  = knownSet.has(selectedId);
  const isInList = listSet.has(selectedId);

  const sectionLabel = (text) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.txtS, marginBottom: 6 }}>
      {text}
    </div>
  );

  const divider = <div style={{ borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />;

  return (
    <div style={{
      width: 280, flexShrink: 0, background: T.surface,
      borderLeft: `1px solid ${T.border}`, overflowY: "auto",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
        {/* Word + POS */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: T.txtP, fontFamily: "Georgia, serif" }}>
              {item.word}
            </span>
            <span style={{ fontSize: 13, color: T.txtS, fontWeight: 400 }}>{item.partOfSpeech}</span>
          </div>
          <div style={{ fontSize: 13, color: T.sevMd, letterSpacing: ".3px" }}>{item.phonetic}</div>
        </div>

        {divider}

        {sectionLabel(t.sectionChinese)}
        <div style={{ fontSize: 15, color: T.txtP, lineHeight: 1.65, marginBottom: 0 }}>{item.chineseMeaning}</div>

        {divider}

        {sectionLabel(t.sectionEnglish)}
        <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.65 }}>{item.englishDefinition}</div>

        {divider}

        {sectionLabel(t.sectionSentence)}
        <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.75, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          "{item.originalSentence}"
        </div>

        {divider}

        {sectionLabel(t.sectionWhy)}
        <div style={{ fontSize: 14, color: T.txtS, lineHeight: 1.65 }}>{item.whyItMatters}</div>
      </div>

      {/* Actions */}
      <div style={{
        padding: "16px 28px",
        borderTop: `1px solid ${T.border}`,
        display: "flex", gap: 8,
      }}>
        <button
          onClick={() => onToggleKnown(selectedId)}
          style={{
            flex: 1, height: 36, borderRadius: 6,
            border: `1px solid ${isKnown ? T.accent : T.border}`,
            background: isKnown ? T.soft : "transparent",
            color: isKnown ? T.accent : T.txtS,
            fontSize: 13, fontWeight: isKnown ? 600 : 400,
            fontFamily: "inherit", cursor: "pointer", transition: "all .12s",
          }}
        >
          {t.panelKnown}
        </button>
        <button
          onClick={() => onToggleList(selectedId)}
          style={{
            flex: 1, height: 36, borderRadius: 6,
            border: `1px solid ${isInList ? T.accent : T.border}`,
            background: isInList ? T.soft : "transparent",
            color: isInList ? T.accent : T.txtS,
            fontSize: 13, fontWeight: isInList ? 600 : 400,
            fontFamily: "inherit", cursor: "pointer", transition: "all .12s",
          }}
        >
          {t.panelAddList}
        </button>
      </div>
    </div>
  );
}

// ─── Annotated word ───────────────────────────────────────────────────────────

function AnnotatedWord({ children, wordId, selectedId, onSelect }) {
  const selected = selectedId === wordId;
  return (
    <span
      onClick={() => onSelect(selected ? null : wordId)}
      style={{
        cursor: "pointer",
        borderBottom: `1.5px solid ${selected ? T.accent : T.sevMd}`,
        paddingBottom: 1,
        background: selected ? T.soft : "transparent",
        borderRadius: selected ? 2 : 0,
        transition: "background .12s",
      }}
    >
      {children}
    </span>
  );
}

// ─── Chapter bar ──────────────────────────────────────────────────────────────

function ChapterBar({ label, progress }) {
  return (
    <div style={{
      height: 48, background: T.surface, borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", flexShrink: 0,
    }}>
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

// ─── Screens ──────────────────────────────────────────────────────────────────

function SetupScreen({ lang, setLang, onNext }) {
  const t = I18N[lang];
  const [parseState, setParseState] = useState("idle"); // idle | parsing | success | error
  const [selectedChapter, setSelectedChapter] = useState("");
  const timerRef = useRef(null);

  const handleFileSelect = () => {
    setParseState("parsing");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setParseState("success");
      setSelectedChapter("ch2");
    }, 1600);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const canProceed = parseState === "success" && selectedChapter !== "";

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>

      {/* Language switcher — top right of whole page */}
      <div style={{ position: "absolute", top: 18, right: 24, zIndex: 10 }}>
        <LanguageSwitcher lang={lang} setLang={setLang} />
      </div>

      {/* Left panel — brand */}
      <div style={{
        width: 440, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 64px", background: T.bg,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: T.accent, marginBottom: 20 }}>
          {t.productName}
        </div>
        <h1 style={{
          fontSize: 34, fontWeight: 600, color: T.txtP, lineHeight: 1.25,
          marginBottom: 16, fontFamily: "Georgia, serif", letterSpacing: "-.4px",
        }}>
          {t.tagline}
        </h1>
        <p style={{ fontSize: 15, color: T.txtS, lineHeight: 1.85, marginBottom: 36 }}>
          {t.taglineDesc}
        </p>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 28 }}>
          <p style={{ fontSize: 14, color: T.txtS, lineHeight: 1.85, whiteSpace: "pre-line" }}>
            {t.noFlashcards}
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1, background: T.surface, borderLeft: `1px solid ${T.border}`,
        overflowY: "auto", padding: "64px 64px",
      }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.txtP, marginBottom: 6 }}>{t.prepareTitle}</div>
          <div style={{ fontSize: 14, color: T.txtS, marginBottom: 36 }}>{t.prepareDesc}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* EPUB upload */}
            <EpubUploader t={t} parseState={parseState} onFileSelect={handleFileSelect} />

            {/* Chapter selector — only after success */}
            {parseState === "success" && (
              <ChapterSelector t={t} lang={lang} value={selectedChapter} onChange={setSelectedChapter} />
            )}

            {/* Reading level */}
            <InputField label={t.readingLevel} placeholder={t.readingLevelPh} />

            {/* Reading difficulties */}
            <TextAreaField label={t.readingDiff} placeholder={t.readingDiffPh} height={84} />

            {/* Previous summary */}
            <TextAreaField label={t.prevSummary} placeholder={t.prevSummaryPh} height={84} />

            {/* CTA */}
            <div style={{ paddingTop: 4 }}>
              <Button full disabled={!canProceed} onClick={onNext}>
                {t.ctaBtn}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterPreloadScreen({ lang, onNext, onBack }) {
  const t = I18N[lang];

  // Vocab status state — keyed by vocab id
  const [statusMap, setStatusMap] = useState(() => {
    const m = {};
    VOCAB_DATA.forEach((v) => { m[v.id] = v.defaultStatus; });
    return m;
  });

  const handleStatus = (id, status) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  const topLabel = lang === "zh" ? "小王子 · 第 2 章" : "The Little Prince · Chapter 2";
  const rightLabel = t.beforeReadingLabel;

  return (
    <div style={{ height: "100%", background: T.bg, display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: T.surface, borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.txtS }}>{topLabel}</span>
        <span style={{ fontSize: 13, color: T.txtS }}>{rightLabel}</span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "52px 40px 120px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* Chapter heading */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.accent, marginBottom: 10 }}>
              {lang === "zh" ? "第 2 章" : "Chapter 2"}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: T.txtP, letterSpacing: "-.4px", fontFamily: "Georgia, serif", marginBottom: 10 }}>
              {lang === "zh" ? "小王子出现" : "The Little Prince Appears"}
            </h1>
            <div style={{ fontSize: 14, color: T.txtS }}>
              {lang === "zh"
                ? "预计阅读 8 分钟 · 5 个标注词 · 中英双语背景"
                : "Estimated read: 8 min · 5 flagged words · bilingual context"}
            </div>
          </div>

          {/* Before You Read */}
          <div style={{ marginBottom: 52 }}>
            <BeforeYouReadCard t={t} />
          </div>

          {/* Core Vocabulary */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: T.txtS }}>
                {t.coreVocab}
              </div>
              <div style={{ fontSize: 12, color: T.txtS }}>{t.coreVocabSub}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {VOCAB_DATA.map((item) => (
                <VocabPreviewCard
                  key={item.id}
                  item={item}
                  status={statusMap[item.id]}
                  onStatusChange={handleStatus}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "16px 0 32px",
        background: `linear-gradient(to top, ${T.bg} 60%, transparent)`,
        display: "flex", justifyContent: "center", gap: 12,
        pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "all" }}>
          <Button variant="ghost" onClick={onBack}>{t.backSetup}</Button>
        </div>
        <div style={{ pointerEvents: "all" }}>
          <Button onClick={onNext}>{t.startReading}</Button>
        </div>
      </div>
    </div>
  );
}

function ImmersiveReaderScreen({ lang }) {
  const t = I18N[lang];
  const [selectedId, setSelectedId] = useState(null);
  const [knownSet,   setKnownSet]   = useState(new Set());
  const [listSet,    setListSet]    = useState(new Set());

  const toggleKnown = (id) =>
    setKnownSet((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleList = (id) =>
    setListSet((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const chapterLabel = lang === "zh"
    ? "小王子 · 第 2 章 · 小王子出现"
    : "The Little Prince · Chapter 2 · The Little Prince Appears";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ChapterBar label={chapterLabel} progress={0.18} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Reading area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "64px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 40px" }}>
            {READER_PARAGRAPHS.map((para, i) => (
              <p key={i} style={{
                fontSize: 20, lineHeight: "36px", color: T.txtP,
                fontFamily: "Georgia, serif", marginBottom: 28,
              }}>
                {para.map((seg, j) =>
                  seg.t === "word" ? (
                    <AnnotatedWord key={j} wordId={seg.id} selectedId={selectedId} onSelect={setSelectedId}>
                      {seg.v}
                    </AnnotatedWord>
                  ) : (
                    <span key={j}>{seg.v}</span>
                  )
                )}
              </p>
            ))}
          </div>
        </div>

        {/* Annotation panel */}
        <AnnotationPanel
          selectedId={selectedId}
          knownSet={knownSet}
          listSet={listSet}
          onToggleKnown={toggleKnown}
          onToggleList={toggleList}
          t={t}
        />
      </div>
    </div>
  );
}

// ─── Prototype nav ────────────────────────────────────────────────────────────

const NAV_SCREENS = [["setup", "01 Setup"], ["preload", "02 Preload"], ["reader", "03 Reader"]];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function QuietReader() {
  const [screen, setScreen] = useState("setup");
  const [lang,   setLang]   = useState("zh"); // default Chinese

  return (
    <div style={{
      width: 1440, height: 1024, overflow: "hidden",
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      color: T.txtP, background: T.bg, position: "relative",
    }}>
      {/* Prototype screen switcher */}
      <div style={{
        position: "absolute",
        top: screen === "reader" ? 56 : 12,
        right: screen === "setup" ? 130 : 20, // avoid overlapping lang switcher on setup
        zIndex: 200,
        display: "flex", gap: 3,
        background: "rgba(255,253,248,.96)",
        border: `1px solid ${T.border}`,
        borderRadius: 8, padding: 3,
      }}>
        {NAV_SCREENS.map(([k, l]) => (
          <button key={k} onClick={() => setScreen(k)} style={{
            padding: "5px 12px", borderRadius: 5, border: "none",
            background: screen === k ? T.accent : "transparent",
            color: screen === k ? "#fff" : T.txtS,
            fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
            transition: "all .15s",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ height: "100%" }}>
        {screen === "setup"   && <SetupScreen lang={lang} setLang={setLang} onNext={() => setScreen("preload")} />}
        {screen === "preload" && <ChapterPreloadScreen lang={lang} onNext={() => setScreen("reader")} onBack={() => setScreen("setup")} />}
        {screen === "reader"  && <ImmersiveReaderScreen lang={lang} />}
      </div>
    </div>
  );
}
