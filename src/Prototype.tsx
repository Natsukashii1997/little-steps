import "@fontsource/gaegu/400.css";
import "@fontsource/gaegu/700.css";
import "@fontsource/zcool-kuaile";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import {
  ArrowLeftIcon,
  BellIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FaceIcon,
  HeartFilledIcon,
  PauseIcon,
  Pencil1Icon,
  PlayIcon,
  PlusIcon,
  ReaderIcon,
  Share1Icon,
  SpeakerLoudIcon,
  StarFilledIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { openDB } from "idb";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BottomSheet, KeyboardInput, KeyboardTextarea, MobileScroll, useKeyboard } from "./mobile";

type Page = "home" | "memory" | "growth" | "health" | "education" | "study";

type ImageHotspot = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  onClick: () => void;
  pressed?: boolean;
  stateMark?: boolean;
  layer?: "default" | "foreground";
};

type StaticAddControl = {
  id: string;
  label: string;
  centerX: number;
  centerY: number;
  onClick: () => void;
};

const finalScreenImages: Record<Page, { src: string; label: string; width: number; height: number }> = {
  home: { src: "/assets/baby/final-screens/zh-CN/01-home-dynamic-add-clean.png", label: "首页", width: 853, height: 1844 },
  memory: { src: "/assets/baby/final-screens/zh-CN/02-memory-book-home-paper-v1.png", label: "成长回忆", width: 862, height: 1824 },
  growth: { src: "/assets/baby/final-screens/zh-CN/03-growth-curve.png", label: "生长曲线", width: 853, height: 1844 },
  health: { src: "/assets/baby/final-screens/zh-CN/04-health-record.png", label: "健康记录", width: 853, height: 1844 },
  education: { src: "/assets/baby/final-screens/zh-CN/05-early-education-add-clean-home-paper-v1.png", label: "早期教育", width: 853, height: 1843 },
  study: { src: "/assets/baby/final-screens/zh-CN/06-study-record-add-clean-home-paper-v1.png", label: "学习记录", width: 853, height: 1844 },
};

const finalScreenSummaries: Record<Page, string> = {
  home: "硕之的今日成长概览。页面包含当前体重、身高、月龄、喂养、睡眠、便便、维生素 D 补剂和今日待办入口。",
  memory: "成长回忆默认展示全部记录，包含照片、第一次微笑、第一次翻身和今日随记，并可按瞬间、照片、随记分类管理。",
  growth: "生长曲线展示出生日期、出生体重、出生身高、当前月龄、生长曲线和三条成长历史，并可管理全部真实成长记录。",
  health: "健康记录展示疫苗、发育里程碑和儿保记录，并可在三个分类中新增、修改和删除真实记录。",
  education: "早期教育展示音乐和故事。音乐支持上传、播放、暂停和进度调整；故事支持封面上传和外部链接打开。",
  study: "学习记录展示英文学习卡，并可切换中文学习卡；所有卡片支持新增、编辑、删除、上传图例和系统发音。",
};

const finalNavigation: { id: Page; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "memory", label: "Memory" },
  { id: "growth", label: "Growth" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "study", label: "Study" },
];

const unifiedPageTitles: Record<Exclude<Page, "home">, string> = {
  memory: "回忆册",
  growth: "成长曲线",
  health: "健康记录",
  education: "早期教育",
  study: "学习记录",
};

function UnifiedTopNavigation({
  page,
  homeDate,
  onBack,
  onNotifications,
  onReport,
  onMemoryAdd,
  variant,
}: {
  page: Page;
  homeDate?: string;
  onBack: () => void;
  onNotifications: (trigger: HTMLButtonElement) => void;
  onReport: (trigger: HTMLButtonElement) => void;
  onMemoryAdd?: (trigger: HTMLButtonElement) => void;
  variant: "image" | "dynamic";
}) {
  const isHome = page === "home";
  const title = isHome ? homeDate : unifiedPageTitles[page];

  return <header className={`unified-top-navigation is-${variant}${isHome ? " is-home" : ""}`}>
    <div className="unified-top-leading">
      {isHome
        ? <span className="visually-hidden">晴间多云</span>
        : <button type="button" onClick={onBack} aria-label="返回首页" data-scroll-drag="ignore"><ArrowLeftIcon /></button>}
    </div>

    {isHome
      ? <time dateTime={homeDate?.slice(0, 10).replaceAll(".", "-")}>{title}</time>
      : <h1>{title}</h1>}

    <div className="unified-top-actions">
      {page === "memory" && onMemoryAdd ? <button className="unified-top-add app-add-button" type="button" onClick={(event) => onMemoryAdd(event.currentTarget)} aria-label="新增成长回忆" data-scroll-drag="ignore"><PlusIcon /><span>Add</span></button> : <>
        <button className="unified-top-notification" type="button" onClick={(event) => onNotifications(event.currentTarget)} aria-label="查看通知" data-scroll-drag="ignore"><BellIcon /><span aria-hidden="true" /></button>
        <button type="button" onClick={(event) => onReport(event.currentTarget)} aria-label="生成并分享宝宝报告" data-scroll-drag="ignore"><ExternalLinkIcon /></button>
      </>}
    </div>
  </header>;
}

function UnifiedBottomNavigation({
  activePage,
  onNavigate,
  variant,
}: {
  activePage: Page;
  onNavigate: (page: Page, restoreKeyboardFocus?: boolean) => void;
  variant: "image" | "dynamic";
}) {
  return <nav className={`unified-bottom-navigation is-${variant}`} aria-label="主要页面">
    {finalNavigation.map((item) => <button
      key={item.id}
      className={activePage === item.id ? "active" : ""}
      type="button"
      aria-label={`前往 ${item.label}`}
      aria-current={activePage === item.id ? "page" : undefined}
      onClick={(event) => {
        const trigger = event.currentTarget;
        onNavigate(item.id, event.detail === 0);
        if (event.detail > 0) requestAnimationFrame(() => trigger.blur());
      }}
      data-scroll-drag="ignore"
      data-testid={`final-nav-${item.id}`}
    >
      <span className="unified-nav-icon"><img src={`/assets/baby/nav-${item.id}.png`} alt="" aria-hidden="true" draggable={false} /></span>
      <span className="unified-nav-label">{item.label}</span>
    </button>)}
  </nav>;
}

function FullScreenImagePage({
  page,
  hotspots,
  onNavigate,
  onActionTrigger,
  onNotifications,
  onReport,
  onMemoryAdd,
  staticAdd,
  homeDate,
  summary,
  children,
}: {
  page: Page;
  hotspots: ImageHotspot[];
  onNavigate: (page: Page) => void;
  onActionTrigger: (trigger: HTMLButtonElement) => void;
  onNotifications: (trigger: HTMLButtonElement) => void;
  onReport: (trigger: HTMLButtonElement) => void;
  onMemoryAdd?: (trigger: HTMLButtonElement) => void;
  staticAdd?: StaticAddControl;
  homeDate?: string;
  summary?: string;
  children?: ReactNode;
}) {
  const screen = finalScreenImages[page];

  return (
    <main className="full-screen-image-page" aria-label={`${screen.label} 页面`} data-page={page}>
      <div
        className="full-screen-image-stage"
        style={{
          aspectRatio: `${screen.width} / ${screen.height}`,
          "--screen-ratio": String(screen.width / screen.height),
        } as CSSProperties}
      >
        <section className="visually-hidden" aria-label={`${screen.label} 页面内容摘要`}>
          <h1>{screen.label}</h1>
          <p>{summary ?? finalScreenSummaries[page]}</p>
        </section>
        <img
          className="full-screen-image"
          src={screen.src}
          alt={`${screen.label} 完整页面视觉`}
          width={screen.width}
          height={screen.height}
          draggable={false}
          data-testid="final-screen-image"
        />

        {children}

        {staticAdd ? <>
          <button
            className={`full-screen-static-add is-${page} app-add-button`}
            type="button"
            aria-label={staticAdd.label}
            onClick={(event) => {
              onActionTrigger(event.currentTarget);
              staticAdd.onClick();
            }}
            style={{ left: `${staticAdd.centerX}%`, top: `${staticAdd.centerY}%` }}
            data-scroll-drag="ignore"
            data-testid={`screen-action-${staticAdd.id}`}
          ><PlusIcon /><span>Add</span></button>
        </> : null}

        <div className="full-screen-action-hotspots" role="group" aria-label={`${screen.label} 页面功能`}>
          {hotspots.filter((hotspot) => !hotspot.id.endsWith("-notifications") && !hotspot.id.endsWith("-report") && hotspot.id !== "memory-add" && hotspot.id !== staticAdd?.id).map((hotspot) => (
            <button
              key={hotspot.id}
              className={`full-screen-action-hotspot${hotspot.layer === "foreground" ? " is-foreground" : ""}`}
              type="button"
              aria-label={hotspot.label}
              aria-pressed={hotspot.pressed}
              onClick={(event) => {
                onActionTrigger(event.currentTarget);
                hotspot.onClick();
              }}
              style={{
                left: `${hotspot.left}%`,
                top: `${hotspot.top}%`,
                width: `${hotspot.width}%`,
                height: `${hotspot.height}%`,
              }}
              data-scroll-drag="ignore"
              data-testid={`screen-action-${hotspot.id}`}
            >
              {hotspot.stateMark ? <span className="hotspot-state-mark" aria-hidden="true"><CheckIcon /></span> : null}
            </button>
          ))}
        </div>

      </div>
      <UnifiedTopNavigation
        page={page}
        homeDate={homeDate}
        onBack={() => onNavigate("home")}
        onNotifications={onNotifications}
        onReport={onReport}
        onMemoryAdd={onMemoryAdd}
        variant="image"
      />
      <UnifiedBottomNavigation activePage={page} onNavigate={onNavigate} variant="image" />
    </main>
  );
}
type CareList = "feeding" | "sleep" | "diaper" | "supplement";
type MemoryType = "moment" | "photo" | "note";
type HealthTab = "vaccine" | "ability" | "checkup";
type EducationTab = "music" | "story";
type StudyTab = "english" | "chinese";
type StudyArtworkKey =
  | "apple"
  | "dog"
  | "moon"
  | "ball"
  | "cat"
  | "sun"
  | "fish"
  | "bird"
  | "flower"
  | "car"
  | "star"
  | "bear"
  | "book"
  | "duck"
  | "tree";
type EditorKind =
  | "profile"
  | "feeding"
  | "sleep"
  | "diaper"
  | "supplement"
  | "todo"
  | "memory"
  | "growth"
  | "vaccine"
  | "ability"
  | "checkup"
  | "music"
  | "story"
  | "learning";

type Baby = {
  name: string;
  birthDate: string;
  birthWeight?: number;
  birthHeight?: number;
  avatarId?: string;
};
type Feeding = { id: string; time: string; amount: number; milkType: string; note?: string };
type Sleep = { id: string; start: string; end: string; note?: string };
type Diaper = { id: string; time: string; status: string; note?: string };
type Supplement = { id: string; name: string; date: string; completed: boolean };
type Todo = { id: string; title: string; completed: boolean };
type Memory = {
  id: string;
  type: MemoryType;
  title: string;
  date: string;
  description: string;
  assetId?: string;
  sourceAbilityId?: string;
};
type GrowthRecord = { id: string; date: string; height?: number; weight?: number; note?: string };
type Vaccine = {
  id: string;
  scheduleKey?: string;
  scheduleOrder?: number;
  ageLabel?: string;
  name: string;
  dose: string;
  dueDate: string;
  completedDate?: string;
  nextDate?: string;
  protects: string;
  note?: string;
  choiceGroup?: string;
};
type Ability = { id: string; date: string; name: string; description: string; imageId?: string };
type Checkup = { id: string; date: string; name: string; tips: string; completedDate?: string };
type MusicTrack = {
  id: string;
  name: string;
  artist: string;
  description?: string;
  durationSeconds?: number;
  assetId?: string;
};
type Story = { id: string; name: string; link: string; coverId?: string };
type LearningItem = {
  id: string;
  kind: StudyTab;
  term: string;
  translation: string;
  imageId?: string;
  artworkKey?: StudyArtworkKey;
};
type AppData = {
  healthDataVersion: number;
  demoVaccineCompletionKeys: string[];
  demoMode: boolean;
  demoRecordIds: string[];
  baby: Baby;
  feedings: Feeding[];
  sleeps: Sleep[];
  diapers: Diaper[];
  supplements: Supplement[];
  todos: Todo[];
  memories: Memory[];
  growthRecords: GrowthRecord[];
  vaccines: Vaccine[];
  abilities: Ability[];
  checkups: Checkup[];
  musicTracks: MusicTrack[];
  stories: Story[];
  learningItems: LearningItem[];
};

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const requiredString = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const optionalString = (value: unknown) => typeof value === "string" ? value : undefined;
const optionalNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const optionalBoolean = (value: unknown) => typeof value === "boolean" ? value : undefined;
const validDateOnlyString = (value: unknown) => {
  const text = requiredString(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? text : undefined;
};
const validDateTimeString = (value: unknown) => {
  const text = requiredString(value);
  const match = text?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/);
  if (!text || !match || !validDateOnlyString(match[1])) return undefined;
  const [, , hours, minutes, seconds = "0"] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return undefined;
  return Number.isFinite(new Date(text).getTime()) ? text : undefined;
};

function normalizedRecords<T>(value: unknown, normalize: (record: JsonRecord) => T | undefined): T[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!isJsonRecord(item)) return [];
        const normalized = normalize(item);
        return normalized ? [normalized] : [];
      })
    : [];
}

const normalizeFeeding = (item: JsonRecord): Feeding | undefined => {
  const id = requiredString(item.id);
  const time = validDateTimeString(item.time);
  const amount = optionalNumber(item.amount);
  const milkType = requiredString(item.milkType);
  return id && time && amount !== undefined && milkType
    ? { id, time, amount, milkType, note: optionalString(item.note) }
    : undefined;
};
const normalizeSleep = (item: JsonRecord): Sleep | undefined => {
  const id = requiredString(item.id);
  const start = validDateTimeString(item.start);
  const end = validDateTimeString(item.end);
  return id && start && end ? { id, start, end, note: optionalString(item.note) } : undefined;
};
const normalizeDiaper = (item: JsonRecord): Diaper | undefined => {
  const id = requiredString(item.id);
  const time = validDateTimeString(item.time);
  const status = requiredString(item.status);
  return id && time && status ? { id, time, status, note: optionalString(item.note) } : undefined;
};
const normalizeSupplement = (item: JsonRecord): Supplement | undefined => {
  const id = requiredString(item.id);
  const name = requiredString(item.name);
  const date = validDateOnlyString(item.date);
  return id && name && date ? { id, name, date, completed: optionalBoolean(item.completed) ?? false } : undefined;
};
const normalizeTodo = (item: JsonRecord): Todo | undefined => {
  const id = requiredString(item.id);
  const title = requiredString(item.title);
  return id && title ? { id, title, completed: optionalBoolean(item.completed) ?? false } : undefined;
};
const normalizeMemory = (item: JsonRecord): Memory | undefined => {
  const id = requiredString(item.id);
  const type = item.type === "moment" || item.type === "photo" || item.type === "note" ? item.type : undefined;
  const title = requiredString(item.title);
  const date = validDateOnlyString(item.date);
  return id && type && title && date
    ? {
        id,
        type,
        title,
        date,
        description: optionalString(item.description) ?? "",
        assetId: optionalString(item.assetId),
        sourceAbilityId: optionalString(item.sourceAbilityId),
      }
    : undefined;
};
const normalizeGrowthRecord = (item: JsonRecord): GrowthRecord | undefined => {
  const id = requiredString(item.id);
  const date = validDateOnlyString(item.date);
  return id && date
    ? { id, date, height: optionalNumber(item.height), weight: optionalNumber(item.weight), note: optionalString(item.note) }
    : undefined;
};
const normalizeVaccine = (item: JsonRecord): Vaccine | undefined => {
  const id = requiredString(item.id);
  const name = requiredString(item.name);
  const dose = requiredString(item.dose);
  const dueDate = validDateOnlyString(item.dueDate);
  const protects = requiredString(item.protects);
  return id && name && dose && dueDate && protects
    ? {
        id,
        name,
        dose,
        dueDate,
        protects,
        scheduleKey: optionalString(item.scheduleKey),
        scheduleOrder: optionalNumber(item.scheduleOrder),
        ageLabel: optionalString(item.ageLabel),
        completedDate: validDateOnlyString(item.completedDate),
        nextDate: validDateOnlyString(item.nextDate),
        note: optionalString(item.note),
        choiceGroup: optionalString(item.choiceGroup),
      }
    : undefined;
};
const normalizeAbility = (item: JsonRecord): Ability | undefined => {
  const id = requiredString(item.id);
  const date = validDateOnlyString(item.date);
  const name = requiredString(item.name);
  return id && date && name
    ? { id, date, name, description: optionalString(item.description) ?? "", imageId: optionalString(item.imageId) }
    : undefined;
};
const normalizeCheckup = (item: JsonRecord): Checkup | undefined => {
  const id = requiredString(item.id);
  const date = validDateOnlyString(item.date);
  const name = requiredString(item.name);
  return id && date && name
    ? {
        id,
        date,
        name,
        tips: optionalString(item.tips) ?? "",
        completedDate: validDateOnlyString(item.completedDate),
      }
    : undefined;
};
const normalizeMusicTrack = (item: JsonRecord): MusicTrack | undefined => {
  const id = requiredString(item.id);
  const name = requiredString(item.name);
  return id && name
    ? {
        id,
        name,
        artist: optionalString(item.artist) ?? "",
        description: optionalString(item.description),
        durationSeconds: optionalNumber(item.durationSeconds),
        assetId: optionalString(item.assetId),
      }
    : undefined;
};
const normalizeStory = (item: JsonRecord): Story | undefined => {
  const id = requiredString(item.id);
  const name = requiredString(item.name);
  const link = requiredString(item.link);
  return id && name && link ? { id, name, link, coverId: optionalString(item.coverId) } : undefined;
};
const normalizeLearningItem = (item: JsonRecord): LearningItem | undefined => {
  const id = requiredString(item.id);
  const kind = item.kind === "english" || item.kind === "chinese" ? item.kind : undefined;
  const term = requiredString(item.term);
  const artworkKey = typeof item.artworkKey === "string" && studyArtworkOptions.some(({ key }) => key === item.artworkKey)
    ? item.artworkKey as StudyArtworkKey
    : undefined;
  return id && kind && term
    ? {
        id,
        kind,
        term,
        translation: optionalString(item.translation) ?? "",
        imageId: optionalString(item.imageId),
        artworkKey,
      }
    : undefined;
};
type EditorState = { kind: EditorKind; id?: string } | null;
type DeletableKind = Exclude<EditorKind, "profile">;
type PendingDelete = { kind: DeletableKind; id: string } | null;
type OverlayState =
  | { type: "list"; list: CareList }
  | { type: "report" }
  | { type: "notifications" }
  | { type: "memory-detail"; id: string }
  | { type: "memory-library"; filter: "all" | MemoryType }
  | { type: "health-library"; tab: HealthTab }
  | { type: "education-library"; tab: EducationTab }
  | { type: "study-library"; tab: StudyTab }
  | { type: "todo-library" }
  | { type: "growth-library" }
  | null;
type ActiveOverlay = Exclude<OverlayState, null>;
type Draft = Record<string, string | boolean>;

const APP_STORAGE_KEY = "little-steps-baby-workbench-v1";
const ASSET_DB = "little-steps-assets";
const ASSET_STORE = "uploads";
const DAY = 86_400_000;
const FIXED_BIRTH_DATE = "2026-08-04";
const FIXED_BIRTH_WEIGHT = 2.4;
const FIXED_BIRTH_HEIGHT = 48;
const CURRENT_HEALTH_DATA_VERSION = 2;
const DEFAULT_DEMO_VACCINE_COMPLETION_KEYS = ["birth-bcg-1", "birth-hepb-1"] as const;

type VaccineScheduleDefinition = {
  key: string;
  ageLabel: string;
  ageMonths: number;
  name: string;
  dose: string;
  note?: string;
  choiceGroup?: string;
};

const VACCINE_SCHEDULE: VaccineScheduleDefinition[] = [
  { key: "birth-bcg-1", ageLabel: "24小时内", ageMonths: 0, name: "卡介苗", dose: "第1/1针", note: "出生24小时内接种" },
  { key: "birth-hepb-1", ageLabel: "24小时内", ageMonths: 0, name: "乙肝疫苗", dose: "第1/3针", note: "出生24小时内接种" },
  { key: "1m-hepb-2", ageLabel: "1月龄", ageMonths: 1, name: "乙肝疫苗", dose: "第2/3针", note: "与第一针间隔不超过2个月" },
  { key: "2m-rotavirus5-1", ageLabel: "2月龄", ageMonths: 2, name: "五价轮状疫苗", dose: "第1/3针", note: "接种月龄请与接种门诊核实" },
  { key: "2m-polio-1", ageLabel: "2月龄", ageMonths: 2, name: "脊灰疫苗", dose: "第1/4针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "2m-dtap-1", ageLabel: "2月龄", ageMonths: 2, name: "百白破疫苗", dose: "第1/5针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "2m-pcv13-1", ageLabel: "2月龄", ageMonths: 2, name: "13价肺炎疫苗", dose: "第1/4针", note: "参考图提示小于4月龄接种" },
  { key: "2m-pentavalent-1", ageLabel: "2月龄", ageMonths: 2, name: "五联疫苗", dose: "第1/4针", note: "与对应阶段脊灰、百白破为替代方案", choiceGroup: "基础免疫·五联方案" },
  { key: "3m-polio-2", ageLabel: "3月龄", ageMonths: 3, name: "脊灰疫苗", dose: "第2/4针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "3m-rotavirus5-2", ageLabel: "3月龄", ageMonths: 3, name: "五价轮状疫苗", dose: "第2/3针", note: "与第一针间隔请与接种门诊核实" },
  { key: "4m-polio-3", ageLabel: "4月龄", ageMonths: 4, name: "脊灰疫苗", dose: "第3/4针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "4m-dtap-2", ageLabel: "4月龄", ageMonths: 4, name: "百白破疫苗", dose: "第2/5针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "4m-pcv13-2", ageLabel: "4月龄", ageMonths: 4, name: "13价肺炎疫苗", dose: "第2/4针", note: "与第一针间隔不超过2个月" },
  { key: "4m-pentavalent-2", ageLabel: "4月龄", ageMonths: 4, name: "五联疫苗", dose: "第2/4针", note: "与第一针间隔大于1个月", choiceGroup: "基础免疫·五联方案" },
  { key: "5m-pcv13-3", ageLabel: "5月龄", ageMonths: 5, name: "13价肺炎疫苗", dose: "第3/4针", note: "参考图提示小于6月龄完成第3针" },
  { key: "5m-pentavalent-3", ageLabel: "5月龄", ageMonths: 5, name: "五联疫苗", dose: "第3/4针", note: "与第2针间隔大于1个月", choiceGroup: "基础免疫·五联方案" },
  { key: "6m-dtap-3", ageLabel: "6月龄", ageMonths: 6, name: "百白破疫苗", dose: "第3/5针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "6m-hepb-3", ageLabel: "6月龄", ageMonths: 6, name: "乙肝疫苗", dose: "第3/3针", note: "参考图提示最晚不超过12月龄接种" },
  { key: "6m-mening-a-1", ageLabel: "6月龄", ageMonths: 6, name: "A群流脑多糖疫苗", dose: "第1/2针", note: "与A+C结合流脑疫苗二选一", choiceGroup: "婴儿流脑·A群多糖" },
  { key: "6m-mening-ac-conj-1", ageLabel: "6月龄", ageMonths: 6, name: "A+C结合流脑疫苗", dose: "第1/2针", note: "与A群流脑多糖疫苗二选一", choiceGroup: "婴儿流脑·A+C结合" },
  { key: "6m-rotavirus5-3", ageLabel: "6月龄", ageMonths: 6, name: "五价轮状疫苗", dose: "第3/3针", note: "参考图提示最晚不超过8月龄接种" },
  { key: "6m-hfmd-1", ageLabel: "6月龄", ageMonths: 6, name: "手足口疫苗", dose: "第1/2针", note: "6月龄后尽早接种" },
  { key: "7m-hfmd-2", ageLabel: "7月龄", ageMonths: 7, name: "手足口疫苗", dose: "第2/2针", note: "与第一针最少间隔1个月" },
  { key: "8m-mmr-1", ageLabel: "8月龄", ageMonths: 8, name: "麻腮风疫苗", dose: "第1/2针" },
  { key: "8m-je-live-1", ageLabel: "8月龄", ageMonths: 8, name: "乙脑减毒疫苗", dose: "第1/2针", note: "参考图提示小于12月龄接种第1针" },
  { key: "9m-mening-a-2", ageLabel: "9月龄", ageMonths: 9, name: "A群流脑多糖疫苗", dose: "第2/2针", note: "延续第一针选择的同一方案", choiceGroup: "婴儿流脑·A群多糖" },
  { key: "9m-mening-ac-conj-2", ageLabel: "9月龄", ageMonths: 9, name: "A+C结合流脑疫苗", dose: "第2/2针", note: "延续第一针选择的同一方案", choiceGroup: "婴儿流脑·A+C结合" },
  { key: "12m-pcv13-4", ageLabel: "12月龄", ageMonths: 12, name: "13价肺炎疫苗", dose: "第4/4针", note: "参考图提示最晚15月龄前完成" },
  { key: "12m-varicella-1", ageLabel: "12月龄", ageMonths: 12, name: "水痘疫苗", dose: "第1/2针", note: "12月龄后尽早接种" },
  { key: "18m-mmr-2", ageLabel: "18月龄", ageMonths: 18, name: "麻腮风疫苗", dose: "第2/2针", note: "参考图提示最迟24月龄接种" },
  { key: "18m-pentavalent-4", ageLabel: "18月龄", ageMonths: 18, name: "五联疫苗", dose: "第4/4针", note: "与第3针间隔6个月", choiceGroup: "基础免疫·五联方案" },
  { key: "18m-hepa-inactivated-1", ageLabel: "18月龄", ageMonths: 18, name: "甲肝灭活疫苗", dose: "第1/2针", note: "与甲肝减毒疫苗二选一", choiceGroup: "甲肝·灭活2针" },
  { key: "18m-hepa-live-1", ageLabel: "18月龄", ageMonths: 18, name: "甲肝减毒疫苗", dose: "第1/1针", note: "与甲肝灭活疫苗二选一", choiceGroup: "甲肝·减毒1针" },
  { key: "18m-dtap-4", ageLabel: "18月龄", ageMonths: 18, name: "百白破疫苗", dose: "第4/5针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "2y-hepa-inactivated-2", ageLabel: "2周岁", ageMonths: 24, name: "甲肝灭活疫苗", dose: "第2/2针", note: "仅在第一针选择灭活方案时继续", choiceGroup: "甲肝·灭活2针" },
  { key: "2y-je-live-2", ageLabel: "2周岁", ageMonths: 24, name: "乙脑减毒疫苗", dose: "第2/2针", note: "参考图提示最迟3周岁内完成" },
  { key: "3y-mening-ac-1", ageLabel: "3周岁", ageMonths: 36, name: "A+C群流脑疫苗", dose: "第1/2针", note: "与ACYW135流脑多糖疫苗二选一", choiceGroup: "儿童流脑·A+C群" },
  { key: "3y-mening-acyw135-1", ageLabel: "3周岁", ageMonths: 36, name: "ACYW135流脑多糖疫苗", dose: "第1/2针", note: "与A+C群流脑疫苗二选一", choiceGroup: "儿童流脑·ACYW135" },
  { key: "4y-polio-4", ageLabel: "4周岁", ageMonths: 48, name: "脊灰疫苗", dose: "第4/4针", note: "选择五联方案时按门诊建议调整", choiceGroup: "基础免疫·分开接种" },
  { key: "4y-varicella-2", ageLabel: "4周岁", ageMonths: 48, name: "水痘疫苗", dose: "第2/2针", note: "已出过水痘可向接种门诊确认是否需要接种" },
  { key: "6y-mening-ac-2", ageLabel: "6周岁", ageMonths: 72, name: "A+C群流脑疫苗", dose: "第2/2针", note: "延续3周岁第一针选择的同一方案", choiceGroup: "儿童流脑·A+C群" },
  { key: "6y-mening-acyw135-2", ageLabel: "6周岁", ageMonths: 72, name: "ACYW135流脑多糖疫苗", dose: "第2/2针", note: "延续3周岁第一针选择的同一方案", choiceGroup: "儿童流脑·ACYW135" },
  { key: "6y-dtap-5", ageLabel: "6周岁", ageMonths: 72, name: "百白破疫苗", dose: "第5/5针", note: "参考图提示7周岁之前完成" },
];

const assetDb = openDB(ASSET_DB, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE);
  },
});

const uid = () => typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : [...crypto.getRandomValues(new Uint8Array(16))]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);
const AUDIO_FILE_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "flac"]);

const fileExtension = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isImageFile = (file: File) => file.type.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(fileExtension(file));
const isAudioFile = (file: File) => file.type.startsWith("audio/")
  || file.type === "video/mp4"
  || AUDIO_FILE_EXTENSIONS.has(fileExtension(file));
const inferredAssetType = (file: File) => file.type || ({
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
} as Record<string, string>)[fileExtension(file)] || "application/octet-stream";
const formatFileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

function isRealMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const agent = navigator.userAgent;
  const iosOrAndroid = /Android|iPhone|iPod/i.test(agent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standaloneTouch = window.matchMedia("(display-mode: standalone)").matches
    && window.matchMedia("(pointer: coarse)").matches;
  return Boolean(nav.userAgentData?.mobile || iosOrAndroid || standaloneTouch);
}
const upsertById = <T extends { id: string }>(items: T[], item: T) => {
  const existingIndex = items.findIndex((current) => current.id === item.id);
  if (existingIndex === -1) return [...items, item];
  return items.map((current, index) => index === existingIndex ? item : current);
};
const stableArtworkIndex = (id: string, length: number) => [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % length;
const isoMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const localDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateValue(date);
};
const today = () => localDateValue();
const dateTimeLocal = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function sampleBirthDate() {
  return FIXED_BIRTH_DATE;
}

function vaccineDateAtAge(ageMonths: number) {
  const [year, month, day] = FIXED_BIRTH_DATE.split("-").map(Number);
  const date = new Date(year, month - 1 + ageMonths, day, 12, 0, 0);
  return localDateValue(date);
}

function createVaccineScheduleSeed(): Vaccine[] {
  return VACCINE_SCHEDULE.map((definition, scheduleOrder) => ({
    id: `vaccine-schedule-${definition.key}`,
    scheduleKey: definition.key,
    scheduleOrder,
    ageLabel: definition.ageLabel,
    name: definition.name,
    dose: definition.dose,
    dueDate: vaccineDateAtAge(definition.ageMonths),
    protects: "按当地接种门诊安排",
    note: definition.note,
    choiceGroup: definition.choiceGroup,
  }));
}

function vaccineDoseNumber(value: string) {
  return value.match(/\d+/)?.[0] ?? value;
}

function canonicalVaccineName(value: string) {
  const aliases: Record<string, string> = {
    "Five-in-one Vaccine": "五联疫苗",
    "Hepatitis B": "乙肝疫苗",
    "MMR Vaccine": "麻腮风疫苗",
  };
  return aliases[value] ?? value;
}

function vaccineChoiceFamily(choiceGroup?: string) {
  return choiceGroup?.split("·")[0];
}

function mergeVaccineSchedule(existing: Vaccine[], legacyDemoIds = new Set<string>()) {
  const usedIds = new Set<string>();
  const currentScheduleKeys = new Set(VACCINE_SCHEDULE.map((item) => item.key));
  const schedule = createVaccineScheduleSeed().map((base) => {
    const exactPrevious = existing.find((item) => item.scheduleKey === base.scheduleKey);
    const legacyPrevious = exactPrevious ? undefined : existing.find((item) => legacyDemoIds.has(item.id)
        && !usedIds.has(item.id)
        && canonicalVaccineName(item.name) === base.name
        && vaccineDoseNumber(item.dose) === vaccineDoseNumber(base.dose));
    const previous = exactPrevious ?? legacyPrevious;
    if (previous) usedIds.add(previous.id);
    const completedDate = previous?.completedDate
      && previous.completedDate >= FIXED_BIRTH_DATE
      && previous.completedDate <= today()
      ? previous.completedDate
      : undefined;
    return {
      ...base,
      completedDate,
    };
  });
  const custom = existing.filter((item) => !usedIds.has(item.id)
    && !legacyDemoIds.has(item.id)
    && (!item.scheduleKey || !currentScheduleKeys.has(item.scheduleKey)))
    .map((item) => item.scheduleKey
      ? { ...item, scheduleKey: undefined, scheduleOrder: undefined }
      : item);
  return [...schedule, ...custom];
}

function createMemoryBookSeed(highlightAbilityId?: string): Memory[] {
  return [
    { id: uid(), type: "photo", title: "午睡前的温暖抱抱", date: "2026-08-06", description: "午睡前的温暖抱抱。" },
    { id: uid(), type: "moment", title: "第一次微笑", date: "2026-08-07", description: "你第一次对我笑了。" },
    { id: uid(), type: "moment", title: "第一次抬头", date: "2026-08-05", description: "俯卧时短暂抬起了小脑袋。", sourceAbilityId: highlightAbilityId },
    { id: uid(), type: "note", title: "今日随记", date: "2026-08-06", description: "今天爸爸做鬼脸时，你笑出了声。" },
  ];
}

function createHealthRecordSeed() {
  const highlightAbilityId = uid();
  const vaccines = createVaccineScheduleSeed().map((item) => (
    item.scheduleKey === "birth-bcg-1" || item.scheduleKey === "birth-hepb-1"
      ? { ...item, completedDate: FIXED_BIRTH_DATE }
      : item
  ));
  const abilities: Ability[] = [
    { id: highlightAbilityId, date: "2026-08-05", name: "短暂抬头", description: "俯卧时能短暂抬起小脑袋。" },
    { id: uid(), date: "2026-08-06", name: "注视人脸", description: "能短暂注视爸爸妈妈的脸。" },
    { id: uid(), date: "2026-08-08", name: "四肢活动", description: "清醒时会有力地挥动手脚。" },
  ];
  const checkups: Checkup[] = [
    { id: uid(), date: "2026-08-08", name: "新生儿访视", tips: "观察喂养、睡眠和黄疸变化。", completedDate: "2026-08-08" },
    { id: uid(), date: "2026-09-04", name: "满月儿保", tips: "记录体重、身长与头围变化。" },
    { id: uid(), date: "2026-12-04", name: "4月龄儿保", tips: "多练习俯趴，并关注追视和抬头。" },
  ];
  return { vaccines, abilities, checkups, highlightAbilityId };
}

function createEducationSeed() {
  const musicTracks: MusicTrack[] = [
    {
      id: uid(),
      name: "摇篮曲",
      artist: "睡前旋律",
      description: "柔和音乐，陪宝宝安心入睡。",
      durationSeconds: 3 * 60 + 42,
    },
    {
      id: uid(),
      name: "白噪音",
      artist: "轻柔环境声",
      description: "轻柔声音，帮助宝宝深度休息。",
      durationSeconds: 30 * 60,
    },
    {
      id: uid(),
      name: "英文童谣",
      artist: "亲子跟唱合集",
      description: "一起唱、一起动、一起学。",
      durationSeconds: 12 * 60 + 18,
    },
  ];
  const stories: Story[] = [
    {
      id: uid(),
      name: "好饿的毛毛虫",
      link: "https://en.wikipedia.org/wiki/The_Very_Hungry_Caterpillar",
    },
    {
      id: uid(),
      name: "晚安，月亮",
      link: "https://en.wikipedia.org/wiki/Goodnight_Moon",
    },
  ];
  return { musicTracks, stories };
}

const studyArtworkOptions: { key: StudyArtworkKey; english: string; chinese: string }[] = [
  { key: "apple", english: "Apple", chinese: "苹果" },
  { key: "dog", english: "Dog", chinese: "小狗" },
  { key: "moon", english: "Moon", chinese: "月亮" },
  { key: "ball", english: "Ball", chinese: "球" },
  { key: "cat", english: "Cat", chinese: "小猫" },
  { key: "sun", english: "Sun", chinese: "太阳" },
  { key: "fish", english: "Fish", chinese: "鱼" },
  { key: "bird", english: "Bird", chinese: "小鸟" },
  { key: "flower", english: "Flower", chinese: "花" },
  { key: "car", english: "Car", chinese: "汽车" },
  { key: "star", english: "Star", chinese: "星星" },
  { key: "bear", english: "Bear", chinese: "小熊" },
  { key: "book", english: "Book", chinese: "图书" },
  { key: "duck", english: "Duck", chinese: "小鸭" },
  { key: "tree", english: "Tree", chinese: "大树" },
];

function createStudySeed(): LearningItem[] {
  return studyArtworkOptions.flatMap(({ key, english, chinese }) => [
    { id: uid(), kind: "english" as const, term: english, translation: chinese, artworkKey: key },
    { id: uid(), kind: "chinese" as const, term: chinese, translation: english, artworkKey: key },
  ]);
}

const demoGrowthNotes = [
  "欢迎来到这个世界。",
  "第一次咯咯笑！",
  "笑容越来越多。",
  "第一个夏天。",
  "坐得越来越稳。",
  "稳稳长大中。",
];

function createHomeGrowthSeed(): GrowthRecord[] {
  const birthRecord: GrowthRecord = {
    id: uid(),
    date: FIXED_BIRTH_DATE,
    height: FIXED_BIRTH_HEIGHT,
    weight: FIXED_BIRTH_WEIGHT,
    note: "出生记录",
  };
  if (today() === FIXED_BIRTH_DATE) return [birthRecord];
  return [
    birthRecord,
    {
      id: uid(),
      date: today(),
      height: FIXED_BIRTH_HEIGHT,
      weight: FIXED_BIRTH_WEIGHT,
      note: "等待填写最新体重和身高。",
    },
  ];
}

function ensureFixedBirthGrowthRecord(records: GrowthRecord[]): GrowthRecord[] {
  const existing = records.find((item) => item.date === FIXED_BIRTH_DATE);
  const birthRecord: GrowthRecord = {
    ...(existing ?? { id: uid(), note: "出生记录" }),
    date: FIXED_BIRTH_DATE,
    height: FIXED_BIRTH_HEIGHT,
    weight: FIXED_BIRTH_WEIGHT,
  };
  return [birthRecord, ...records.filter((item) => item.id !== existing?.id && item.date !== FIXED_BIRTH_DATE)];
}

function isVitaminDSupplement(item: Pick<Supplement, "name">) {
  const normalizedName = item.name.replace(/\s+/g, "").toLowerCase();
  return normalizedName.includes("维生素d") || normalizedName.includes("vitamind");
}

function createSeedData(): AppData {
  const healthSeed = createHealthRecordSeed();
  const educationSeed = createEducationSeed();
  const studySeed = createStudySeed();
  const { highlightAbilityId } = healthSeed;
  const seed: AppData = {
    healthDataVersion: CURRENT_HEALTH_DATA_VERSION,
    demoVaccineCompletionKeys: [...DEFAULT_DEMO_VACCINE_COMPLETION_KEYS],
    demoMode: true,
    demoRecordIds: [],
    baby: { name: "硕之", birthDate: sampleBirthDate(), birthWeight: FIXED_BIRTH_WEIGHT, birthHeight: FIXED_BIRTH_HEIGHT },
    feedings: [
      { id: uid(), time: isoMinutesAgo(135), amount: 180, milkType: "混合喂养", note: "状态很好" },
      { id: uid(), time: isoMinutesAgo(360), amount: 150, milkType: "母乳" },
      { id: uid(), time: isoMinutesAgo(690), amount: 170, milkType: "配方奶" },
    ],
    sleeps: [
      { id: uid(), start: isoMinutesAgo(205), end: isoMinutesAgo(110), note: "午睡" },
      { id: uid(), start: isoMinutesAgo(890), end: isoMinutesAgo(540), note: "夜间睡眠" },
    ],
    diapers: [
      { id: uid(), time: isoMinutesAgo(160), status: "正常软便", note: "黄色软便" },
      { id: uid(), time: isoMinutesAgo(480), status: "偏稀" },
    ],
    supplements: [{ id: uid(), name: "维生素 D", date: today(), completed: true }],
    todos: [
      { id: uid(), title: "维生素 D 打卡", completed: false },
      { id: uid(), title: "洗澡", completed: false },
      { id: uid(), title: "上传今日照片", completed: false },
    ],
    memories: createMemoryBookSeed(highlightAbilityId),
    growthRecords: createHomeGrowthSeed(),
    vaccines: healthSeed.vaccines,
    abilities: healthSeed.abilities,
    checkups: healthSeed.checkups,
    musicTracks: educationSeed.musicTracks,
    stories: educationSeed.stories,
    learningItems: studySeed,
  };
  seed.demoRecordIds = [
    ...seed.feedings,
    ...seed.sleeps,
    ...seed.diapers,
    ...seed.supplements,
    ...seed.todos,
    ...seed.memories,
    ...seed.growthRecords,
    ...seed.abilities,
    ...seed.checkups,
    ...seed.musicTracks,
    ...seed.stories,
    ...seed.learningItems,
  ].map((item) => item.id);
  return seed;
}

function loadData(): AppData {
  try {
    const stored = localStorage.getItem(APP_STORAGE_KEY);
    if (!stored) return createSeedData();
    const decoded = JSON.parse(stored) as unknown;
    const raw: JsonRecord = isJsonRecord(decoded) ? decoded : {};
    const fallback = createSeedData();
    const rawBaby = isJsonRecord(raw.baby) ? raw.baby : {};
    const parsed: AppData = {
      healthDataVersion: optionalNumber(raw.healthDataVersion) ?? 0,
      demoVaccineCompletionKeys: Array.isArray(raw.demoVaccineCompletionKeys)
        ? raw.demoVaccineCompletionKeys.filter((key): key is string => typeof key === "string")
        : [],
      demoMode: typeof raw.demoMode === "boolean" ? raw.demoMode : false,
      demoRecordIds: Array.isArray(raw.demoRecordIds) ? raw.demoRecordIds.filter((id): id is string => typeof id === "string") : [],
      baby: {
        name: requiredString(rawBaby.name) ?? fallback.baby.name,
        birthDate: validDateOnlyString(rawBaby.birthDate) ?? fallback.baby.birthDate,
        birthWeight: optionalNumber(rawBaby.birthWeight),
        birthHeight: optionalNumber(rawBaby.birthHeight),
        avatarId: optionalString(rawBaby.avatarId),
      },
      feedings: normalizedRecords(raw.feedings, normalizeFeeding),
      sleeps: normalizedRecords(raw.sleeps, normalizeSleep),
      diapers: normalizedRecords(raw.diapers, normalizeDiaper),
      supplements: normalizedRecords(raw.supplements, normalizeSupplement),
      todos: normalizedRecords(raw.todos, normalizeTodo),
      memories: normalizedRecords(raw.memories, normalizeMemory),
      growthRecords: normalizedRecords(raw.growthRecords, normalizeGrowthRecord),
      vaccines: normalizedRecords(raw.vaccines, normalizeVaccine),
      abilities: normalizedRecords(raw.abilities, normalizeAbility),
      checkups: normalizedRecords(raw.checkups, normalizeCheckup),
      musicTracks: normalizedRecords(raw.musicTracks, normalizeMusicTrack),
      stories: normalizedRecords(raw.stories, normalizeStory),
      learningItems: normalizedRecords(raw.learningItems, normalizeLearningItem),
    };
    const demoIds = new Set(parsed.demoRecordIds ?? []);
    const legacyDemoMemories = parsed.demoMode
      ? (parsed.memories ?? []).filter((item) => demoIds.has(item.id) && item.date < FIXED_BIRTH_DATE)
      : [];
    const replacedDemoMemories = legacyDemoMemories.length
      ? (parsed.memories ?? []).filter((item) => demoIds.has(item.id))
      : [];
    const highlightAbilityId = parsed.abilities?.find((item) => demoIds.has(item.id))?.id;
    const migratedMemories = replacedDemoMemories.length
      ? [
          ...createMemoryBookSeed(highlightAbilityId),
          ...(parsed.memories ?? []).filter((item) => !demoIds.has(item.id)),
        ]
      : (parsed.memories ?? []);
    const migratedDemoIds = replacedDemoMemories.length
      ? [
          ...(parsed.demoRecordIds ?? []).filter((id) => !replacedDemoMemories.some((item) => item.id === id)),
          ...migratedMemories.filter((item) => !parsed.memories?.some((existing) => existing.id === item.id)).map((item) => item.id),
        ]
      : (parsed.demoRecordIds ?? []);
    const persistedVaccines = parsed.vaccines ?? [];
    const legacyDemoVaccineIds = new Set(persistedVaccines.filter((item) => demoIds.has(item.id)).map((item) => item.id));
    let vaccines = mergeVaccineSchedule(persistedVaccines, legacyDemoVaccineIds);
    const validScheduleKeys = new Set(VACCINE_SCHEDULE.map((item) => item.key));
    const demoVaccineCompletionKeys = new Set(parsed.demoVaccineCompletionKeys.filter((key) => validScheduleKeys.has(key)));
    if (parsed.healthDataVersion < CURRENT_HEALTH_DATA_VERSION && parsed.demoMode) {
      DEFAULT_DEMO_VACCINE_COMPLETION_KEYS.forEach((scheduleKey) => {
        const merged = vaccines.find((item) => item.scheduleKey === scheduleKey);
        if (merged?.completedDate) return;
        vaccines = vaccines.map((item) => item.scheduleKey === scheduleKey
          ? { ...item, completedDate: FIXED_BIRTH_DATE }
          : item);
        demoVaccineCompletionKeys.add(scheduleKey);
      });
    }
    let abilities = parsed.abilities ?? [];
    let checkups: Checkup[] = (parsed.checkups ?? []).map((item) => {
      const validCompletedDate = item.completedDate
        && item.completedDate >= FIXED_BIRTH_DATE
        && item.completedDate <= today()
        ? item.completedDate
        : undefined;
      const legacyCompletedDate = parsed.healthDataVersion < CURRENT_HEALTH_DATA_VERSION
        && !validCompletedDate
        && item.date >= FIXED_BIRTH_DATE
        && item.date <= today()
        ? item.date
        : undefined;
      return { ...item, completedDate: validCompletedDate ?? legacyCompletedDate };
    });
    let healthMemories = migratedMemories;
    let healthDemoIds = migratedDemoIds.filter((id) => !legacyDemoVaccineIds.has(id) && !id.startsWith("vaccine-schedule-"));
    const hasCurrentHealthSeed = abilities.some((item) => item.name === "短暂抬头")
      && checkups.some((item) => item.name === "新生儿访视");
    if (parsed.demoMode && !hasCurrentHealthSeed) {
      const healthSeed = createHealthRecordSeed();
      const oldDemoAbilities = abilities.filter((item) => demoIds.has(item.id));
      const oldDemoCheckups = checkups.filter((item) => demoIds.has(item.id));
      const removedIds = new Set([
        ...oldDemoAbilities.map((item) => item.id),
        ...oldDemoCheckups.map((item) => item.id),
      ]);
      const removedAbilityIds = new Set(oldDemoAbilities.map((item) => item.id));
      abilities = [...healthSeed.abilities, ...abilities.filter((item) => !demoIds.has(item.id))];
      checkups = [...healthSeed.checkups, ...checkups.filter((item) => !demoIds.has(item.id))];
      const highlightedAbility = healthSeed.abilities.find((ability) => ability.id === healthSeed.highlightAbilityId)!;
      healthMemories = healthMemories.map((memory) => memory.sourceAbilityId && removedAbilityIds.has(memory.sourceAbilityId)
        ? {
            ...memory,
            title: highlightedAbility.name,
            date: highlightedAbility.date,
            description: highlightedAbility.description,
            sourceAbilityId: healthSeed.highlightAbilityId,
          }
        : memory);
      healthDemoIds = [
        ...healthDemoIds.filter((id) => !removedIds.has(id)),
        ...healthSeed.abilities,
        ...healthSeed.checkups,
      ].map((item) => typeof item === "string" ? item : item.id);
    }
    let musicTracks = parsed.musicTracks ?? [];
    let stories = parsed.stories ?? [];
    let educationDemoIds = healthDemoIds;
    const currentEducationNames = new Set(musicTracks.map((item) => item.name));
    const hasCurrentEducationSeed = ["摇篮曲", "白噪音", "英文童谣"].every((name) => currentEducationNames.has(name));
    if (parsed.demoMode && !hasCurrentEducationSeed) {
      const educationSeed = createEducationSeed();
      const oldDemoMusic = musicTracks.filter((item) => demoIds.has(item.id));
      const oldDemoStories = stories.filter((item) => demoIds.has(item.id));
      const removedIds = new Set([...oldDemoMusic, ...oldDemoStories].map((item) => item.id));
      musicTracks = [...educationSeed.musicTracks, ...musicTracks.filter((item) => !demoIds.has(item.id))];
      stories = [...educationSeed.stories, ...stories.filter((item) => !demoIds.has(item.id))];
      educationDemoIds = [
        ...healthDemoIds.filter((id) => !removedIds.has(id)),
        ...educationSeed.musicTracks.map((item) => item.id),
        ...educationSeed.stories.map((item) => item.id),
      ];
    }
    let learningItems = parsed.learningItems ?? [];
    let studyDemoIds = educationDemoIds;
    const hasCurrentStudySeed = studyArtworkOptions.every(({ key }) => learningItems.some((item) => item.kind === "english" && item.artworkKey === key))
      && studyArtworkOptions.every(({ key }) => learningItems.some((item) => item.kind === "chinese" && item.artworkKey === key));
    if (parsed.demoMode && !hasCurrentStudySeed) {
      const studySeed = createStudySeed();
      const oldDemoLearning = learningItems.filter((item) => demoIds.has(item.id));
      const removedIds = new Set(oldDemoLearning.map((item) => item.id));
      learningItems = [...studySeed, ...learningItems.filter((item) => !demoIds.has(item.id))];
      studyDemoIds = [
        ...educationDemoIds.filter((id) => !removedIds.has(id)),
        ...studySeed.map((item) => item.id),
      ];
    }
    const legacyGrowthNoteMap: Record<string, string> = {
      "Welcome to the world.": "欢迎来到这个世界。",
      "First giggle!": "第一次咯咯笑！",
      "Smiling more :)": "笑容越来越多。",
      "First summer": "第一个夏天。",
      "Sitting so tall": "坐得越来越稳。",
      "Growing steadily": "稳稳长大中。",
    };
    const persistedGrowthRecords = [...(parsed.growthRecords ?? [])];
    const persistedDemoGrowthRecords = persistedGrowthRecords.filter((item) => demoIds.has(item.id));
    const legacyGrowthRecordIds = new Set(persistedGrowthRecords.filter((item) => (
      demoIds.has(item.id)
      || (parsed.demoMode && item.date === "2026-08-06" && item.weight === 7.2 && item.height === 66)
    )).map((item) => item.id));
    const hasLegacyDemoGrowthTimeline = parsed.demoMode && persistedGrowthRecords.some((item) => (
      legacyGrowthRecordIds.has(item.id) && (
        item.date < FIXED_BIRTH_DATE
        || item.date > today()
        || (item.date === "2026-08-06" && item.weight === 7.2 && item.height === 66)
      )
    ));
    let growthRecords = persistedGrowthRecords
      .filter((item) => item.date >= FIXED_BIRTH_DATE && item.date <= today())
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .map((item, index) => parsed.demoMode && demoIds.has(item.id)
        ? { ...item, note: item.note ? legacyGrowthNoteMap[item.note] ?? item.note : demoGrowthNotes[Math.min(index, demoGrowthNotes.length - 1)] }
        : item);
    let finalDemoIds = studyDemoIds;
    const demoGrowthRecords = growthRecords.filter((item) => demoIds.has(item.id));
    const hasFixedBirthRecord = demoGrowthRecords.some((item) => item.date === FIXED_BIRTH_DATE
      && item.weight === FIXED_BIRTH_WEIGHT
      && item.height === FIXED_BIRTH_HEIGHT);
    if (parsed.demoMode && (hasLegacyDemoGrowthTimeline || !hasFixedBirthRecord)) {
      const homeGrowthSeed = createHomeGrowthSeed();
      const oldGrowthIds = legacyGrowthRecordIds;
      growthRecords = [
        ...homeGrowthSeed,
        ...growthRecords.filter((item) => !oldGrowthIds.has(item.id)),
      ];
      finalDemoIds = [
        ...studyDemoIds.filter((id) => !oldGrowthIds.has(id)),
        ...homeGrowthSeed.map((item) => item.id),
      ];
    }
    growthRecords = ensureFixedBirthGrowthRecord(growthRecords);
    const demoTodoTitles: Record<string, string> = {
      "维生素 D 打卡": "维生素 D 打卡",
      "洗澡时间": "洗澡",
      "上传今天的照片": "上传今日照片",
    };
    const todos = (parsed.todos ?? []).map((item) => parsed.demoMode && demoIds.has(item.id) && demoTodoTitles[item.title]
      ? { ...item, title: demoTodoTitles[item.title] }
      : item);
    const diapers = (parsed.diapers ?? [])
      .filter((item) => !(parsed.demoMode && demoIds.has(item.id) && item.status === "湿尿布"))
      .map((item) => parsed.demoMode && demoIds.has(item.id)
      ? {
          ...item,
          status: item.status === "正常" ? "正常软便" : item.status,
        }
      : item);
    const baby = {
      ...parsed.baby,
      name: "硕之",
      birthDate: FIXED_BIRTH_DATE,
      birthWeight: FIXED_BIRTH_WEIGHT,
      birthHeight: FIXED_BIRTH_HEIGHT,
    };
    return {
      ...parsed,
      healthDataVersion: CURRENT_HEALTH_DATA_VERSION,
      demoVaccineCompletionKeys: [...demoVaccineCompletionKeys],
      baby,
      demoMode: parsed.demoMode ?? false,
      demoRecordIds: finalDemoIds,
      vaccines,
      abilities,
      checkups,
      memories: healthMemories,
      growthRecords,
      musicTracks,
      stories,
      learningItems,
      todos,
      diapers,
    };
  } catch {
    return createSeedData();
  }
}

async function saveAsset(file?: File) {
  if (!file) return undefined;
  const id = uid();
  const db = await assetDb;
  const storedFile = new Blob([await file.arrayBuffer()], { type: inferredAssetType(file) });
  await db.put(ASSET_STORE, storedFile, id);
  const savedFile = await db.get(ASSET_STORE, id);
  if (!(savedFile instanceof Blob) || savedFile.size !== storedFile.size) {
    await db.delete(ASSET_STORE, id);
    throw new Error("asset-readback-failed");
  }
  return id;
}

async function readAudioDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => reject(new Error("audio-metadata"));
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function deleteAsset(id?: string) {
  if (!id) return;
  const db = await assetDb;
  await db.delete(ASSET_STORE, id);
}

function assetReferenceCount(data: AppData, id?: string) {
  if (!id) return 0;
  return [
    data.baby.avatarId,
    ...data.memories.map((item) => item.assetId),
    ...data.abilities.map((item) => item.imageId),
    ...data.musicTracks.map((item) => item.assetId),
    ...data.stories.map((item) => item.coverId),
    ...data.learningItems.map((item) => item.imageId),
  ].filter((value) => value === id).length;
}

function useAssetUrls(data: AppData) {
  const ids = useMemo(() => {
    const values = [
      data.baby.avatarId,
      ...data.memories.map((item) => item.assetId),
      ...data.abilities.map((item) => item.imageId),
      ...data.musicTracks.map((item) => item.assetId),
      ...data.stories.map((item) => item.coverId),
      ...data.learningItems.map((item) => item.imageId),
    ].filter(Boolean) as string[];
    return Array.from(new Set(values)).sort();
  }, [data]);
  const signature = ids.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void (async () => {
      try {
        const db = await assetDb;
        const next: Record<string, string> = {};
        for (const id of ids) {
          const blob = (await db.get(ASSET_STORE, id)) as Blob | undefined;
          if (blob) {
            const url = URL.createObjectURL(blob);
            next[id] = url;
            created.push(url);
          }
        }
        if (!cancelled) setUrls(next);
      } catch {
        if (!cancelled) setUrls({});
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [signature]);
  return urls;
}

function sortNewest<T>(items: T[], getDate: (item: T) => string) {
  return [...items].sort((a, b) => +new Date(getDate(b)) - +new Date(getDate(a)));
}

function ageParts(birthDate: string, nowValue = Date.now()) {
  const [birthYear, birthMonthNumber, birthDay] = birthDate.split("-").map(Number);
  if (!birthYear || !birthMonthNumber || !birthDay) return { months: 0, days: 0 };
  const birthMonth = birthMonthNumber - 1;
  const now = new Date(nowValue);
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birth = new Date(birthYear, birthMonth, birthDay);
  if (birth > current) return { months: 0, days: 0 };
  let months = (current.getFullYear() - birth.getFullYear()) * 12 + current.getMonth() - birth.getMonth();
  const anchorFor = (monthOffset: number) => {
    const absoluteMonth = birthYear * 12 + birthMonth + monthOffset;
    const year = Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(birthDay, lastDay));
  };
  let anchor = anchorFor(months);
  if (anchor > current) {
    months -= 1;
    anchor = anchorFor(months);
  }
  const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
  const days = Math.max(0, Math.round(dayNumber(current) - dayNumber(anchor)));
  return { months: Math.max(0, months), days };
}

function parsedDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function displayDate(value: string, withYear = false) {
  const date = parsedDate(value);
  if (!date) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: withYear ? "numeric" : undefined,
    month: "short",
    day: "numeric",
  }).format(date);
}

function memoryDisplayDate(value: string) {
  const date = parsedDate(value);
  if (!date) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function growthDisplayDate(value: string) {
  const date = parsedDate(value);
  if (!date) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function healthDisplayDate(value: string) {
  const date = parsedDate(value);
  if (!date) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function growthAgeLabel(birthDate: string, value: string) {
  const birth = new Date(`${birthDate}T12:00:00`);
  const measured = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(measured.getTime())) return "";
  const days = Math.round((measured.getTime() - birth.getTime()) / DAY);
  if (Math.abs(days) <= 3) return "出生";
  const months = Math.max(0, Math.round(days / 30.4375));
  return `${months}个月`;
}

function sampleGrowthPoints<T>(items: T[], limit: number) {
  if (items.length <= limit) return items;
  const indexes = Array.from({ length: limit }, (_, index) => Math.round(index * (items.length - 1) / (limit - 1)));
  return indexes.map((index) => items[index]);
}

function chartTicks(minimum: number, maximum: number, segments = 4) {
  return Array.from({ length: segments + 1 }, (_, index) => minimum + (maximum - minimum) * index / segments);
}

function GrowthXAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const [date = "", age = ""] = String(payload?.value ?? "").split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={12} textAnchor="middle" fill="#2a2823" fontSize={11.5} fontWeight={700}>{date}</text>
      {age ? <text x={0} y={25} textAnchor="middle" fill="#655f54" fontSize={10.5}>({age})</text> : null}
    </g>
  );
}

function displayTime(value: string) {
  const date = parsedDate(value);
  return date ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "--:--";
}

function homeDateHeading(now = Date.now()) {
  const date = new Date(now);
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day} ${weekdays[date.getDay()]}`;
}

function homeEnglishAgeLabel(value: { months: number; days: number }) {
  const monthUnit = value.months === 1 ? "month" : "months";
  const dayUnit = value.days === 1 ? "day" : "days";
  return `${value.months} ${monthUnit} ${value.days} ${dayUnit}`;
}

function homeRelativeTime(value: string, now = Date.now()) {
  const date = parsedDate(value);
  if (!date) return "时间未知";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}分钟前`;
  if (minutes >= 1_440) {
    const days = Math.floor(minutes / 1_440);
    const remainingHours = Math.floor((minutes % 1_440) / 60);
    return remainingHours ? `${days}天${remainingHours}小时前` : `${days}天前`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟前` : `${hours}小时前`;
}

function durationLabel(start: string, end: string) {
  const startDate = parsedDate(start);
  const endDate = parsedDate(end);
  if (!startDate || !endDate) return "时间未记录";
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} 分钟`;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function trackDurationLabel(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function homeDurationLabel(start: string, end: string) {
  const startDate = parsedDate(start);
  const endDate = parsedDate(end);
  if (!startDate || !endDate) return "时间未知";
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} 分钟`;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function homeMinutesLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (!hours) return `${rest} 分钟`;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function homeMilkLabel(value: string) {
  return value;
}

function homeStatusLabel(value: string) {
  return value;
}

function homeSupplementLabel(value: string) {
  return value.replace(/\s+/g, " ");
}

function homeTodoLabel(value: string) {
  return ({
    "维生素 D 打卡": "Vitamin D check-in",
    洗澡: "Bath time",
    洗澡时间: "Bath time",
    上传今日照片: "Upload today's photo",
    上传今天的照片: "Upload today's photo",
  } as Record<string, string>)[value] ?? value;
}

function editorTitle(kind: EditorKind) {
  return {
    profile: "宝宝资料",
    feeding: "喂养记录",
    sleep: "睡眠记录",
    diaper: "便便记录",
    supplement: "补剂打卡",
    todo: "今日待办",
    memory: "记忆卡片",
    growth: "成长数据",
    vaccine: "疫苗记录",
    ability: "能力里程碑",
    checkup: "儿保记录",
    music: "音乐",
    story: "故事",
    learning: "学习卡片",
  }[kind];
}

function DoodleButton({ children, onClick, label, className = "" }: { children: ReactNode; onClick: () => void; label: string; className?: string }) {
  return (
    <button className={`doodle-icon-button ${className}`} type="button" onClick={onClick} aria-label={label} data-scroll-drag="ignore">
      {children}
    </button>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function PageHeader({ eyebrow, title, note, action }: { eyebrow: string; title: string; note: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <span className="page-eyebrow">{eyebrow}</span>
      <div className="page-title-row">
        <div>
          <h1>{title}</h1>
          <p>{note}</p>
        </div>
        {action}
      </div>
      <span className="scribble-line" aria-hidden="true" />
    </header>
  );
}

function SegmentedTabs<T extends string>({
  values,
  active,
  onChange,
  className = "",
  label,
  idPrefix,
  panelId,
  testId,
}: {
  values: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
  label: string;
  idPrefix: string;
  panelId: string | ((value: T) => string);
  testId?: string;
}) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? values.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + values.length) % values.length;
    const nextValue = values[nextIndex].value;
    onChange(nextValue);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${nextValue}`)?.focus());
  };

  return (
    <div className={`segmented-tabs journal-tabs ${className}`.trim()} role="tablist" aria-label={label} data-testid={testId}>
      {values.map((item, index) => (
        <button
          id={`${idPrefix}-tab-${item.value}`}
          key={item.value}
          type="button"
          role="tab"
          aria-selected={active === item.value}
          aria-controls={typeof panelId === "function" ? panelId(item.value) : panelId}
          tabIndex={active === item.value ? 0 : -1}
          className={active === item.value ? "active" : ""}
          onClick={(event) => {
            onChange(item.value);
            if (event.detail > 0) {
              const trigger = event.currentTarget;
              requestAnimationFrame(() => trigger.blur());
            }
          }}
          onKeyDown={(event) => moveFocus(event, index)}
          data-scroll-drag="ignore"
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <img src="/assets/baby/corgi-companion.png" alt="手绘柯基伙伴" />
      <p>{text}</p>
    </div>
  );
}

function MiniActions({ onEdit, onDelete, label = "记录" }: { onEdit: () => void; onDelete: () => void; label?: string }) {
  return (
    <div className="mini-actions">
      <button type="button" onClick={onEdit} aria-label={`修改 ${label}`} data-scroll-drag="ignore"><Pencil1Icon /></button>
      <button type="button" onClick={onDelete} aria-label={`删除 ${label}`} data-scroll-drag="ignore"><TrashIcon /></button>
    </div>
  );
}

export default function Prototype() {
  const keyboard = useKeyboard();
  const [page, setPage] = useState<Page>("home");
  const [homeNow, setHomeNow] = useState(() => Date.now());
  const [data, setData] = useState<AppData>(loadData);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorReturnOverlay, setEditorReturnOverlay] = useState<ActiveOverlay | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleteReturnOverlay, setDeleteReturnOverlay] = useState<ActiveOverlay | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [upload, setUpload] = useState<File>();
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string>();
  const [uploadPreviewFailed, setUploadPreviewFailed] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [savingEditor, setSavingEditor] = useState(false);
  const [nativeInputs, setNativeInputs] = useState(isRealMobileDevice);
  const [memoryFilter, setMemoryFilter] = useState<"all" | MemoryType>("all");
  const [healthTab, setHealthTab] = useState<HealthTab>("vaccine");
  const [educationTab, setEducationTab] = useState<EducationTab>("music");
  const [studyTab, setStudyTab] = useState<StudyTab>("english");
  const [studyPageIndex, setStudyPageIndex] = useState(0);
  const [speakingId, setSpeakingId] = useState<string>();
  const [toast, setToast] = useState("");
  const [playingId, setPlayingId] = useState<string>();
  const [pausedId, setPausedId] = useState<string>();
  const [playback, setPlayback] = useState({ current: 0, duration: 0 });
  const [reportDays, setReportDays] = useState<1 | 7 | 30 | 0>(7);
  const [reportShowName, setReportShowName] = useState(true);
  const [reportIncludeMemories, setReportIncludeMemories] = useState(false);
  const [reportIncludeHealth, setReportIncludeHealth] = useState(true);
  const [poopCheckPulse, setPoopCheckPulse] = useState(false);
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const lastPageActionRef = useRef<HTMLButtonElement | null>(null);
  const assetUrls = useAssetUrls(data);

  useEffect(() => {
    document.title = "Little Steps · 婴儿工作台";
  }, []);

  useEffect(() => {
    if (!isRealMobileDevice()) return;
    setNativeInputs(true);
    keyboard.hide();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setHomeNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
    } catch {
      setToast("当前浏览器没有成功保存，请释放存储空间后重试");
    }
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (page === "study") return;
    window.speechSynthesis?.cancel();
    setSpeakingId(undefined);
  }, [page]);

  useEffect(() => {
    setStudyPageIndex(0);
    window.speechSynthesis?.cancel();
    setSpeakingId(undefined);
  }, [studyTab]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    if (overlay || editor || pendingDelete) return;
    const trigger = lastPageActionRef.current;
    if (!trigger?.isConnected) return;
    const timer = window.setTimeout(() => trigger.focus({ preventScroll: true }), 500);
    return () => window.clearTimeout(timer);
  }, [editor, overlay, pendingDelete]);

  useEffect(() => {
    if (!playingId || data.musicTracks.some((track) => track.id === playingId)) return;
    audioRef.current?.pause();
    setPlayingId(undefined);
    setPausedId(undefined);
    setPlayback({ current: 0, duration: 0 });
  }, [data.musicTracks, playingId]);

  useEffect(() => {
    if (!pausedId || data.musicTracks.some((track) => track.id === pausedId)) return;
    audioRef.current?.pause();
    setPausedId(undefined);
    setPlayback({ current: 0, duration: 0 });
  }, [data.musicTracks, pausedId]);

  useEffect(() => {
    setUploadPreviewFailed(false);
    if (!upload || !isImageFile(upload)) {
      setUploadPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(upload);
    setUploadPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [upload]);

  const sortedFeedings = useMemo(() => sortNewest(data.feedings, (item) => item.time), [data.feedings]);
  const sortedSleeps = useMemo(() => sortNewest(data.sleeps, (item) => item.start), [data.sleeps]);
  const sortedDiapers = useMemo(() => sortNewest(data.diapers, (item) => item.time), [data.diapers]);
  const sortedGrowth = useMemo(() => sortNewest(data.growthRecords, (item) => item.date), [data.growthRecords]);
  const latestHeightRecord = sortedGrowth.find((item) => typeof item.height === "number");
  const latestWeightRecord = sortedGrowth.find((item) => typeof item.weight === "number");
  const latestSupplement = useMemo(() => sortNewest([...data.supplements].reverse(), (item) => item.date)[0], [data.supplements]);
  const selectedVaccineChoiceGroups = useMemo(() => new Set(data.vaccines
    .filter((item) => item.completedDate && item.choiceGroup)
    .map((item) => item.choiceGroup as string)), [data.vaccines]);
  const nextVaccine = useMemo(() => {
    const selectedByFamily = new Map<string | undefined, string>();
    selectedVaccineChoiceGroups.forEach((choiceGroup) => selectedByFamily.set(vaccineChoiceFamily(choiceGroup), choiceGroup));
    const pending = data.vaccines
      .filter((item) => {
        if (item.completedDate || !item.choiceGroup) return !item.completedDate;
        const selected = selectedByFamily.get(vaccineChoiceFamily(item.choiceGroup));
        return !selected || selected === item.choiceGroup;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.scheduleOrder ?? 9_999) - (b.scheduleOrder ?? 9_999));
    return pending.find((item) => item.dueDate < today())
      ?? pending.find((item) => item.dueDate >= today());
  }, [data.vaccines, selectedVaccineChoiceGroups]);
  const nextVaccineOverdue = Boolean(nextVaccine && nextVaccine.dueDate < today());
  const age = ageParts(FIXED_BIRTH_DATE, homeNow);
  const avatarUrl = data.baby.avatarId ? assetUrls[data.baby.avatarId] : undefined;
  const lastFeed = sortedFeedings[0];
  const lastSleep = sortedSleeps[0];
  const lastPoop = sortedDiapers.find((item) => !["湿尿布", "旧尿布记录"].includes(item.status));
  const homeDayStart = useMemo(() => {
    const current = new Date(homeNow);
    return new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  }, [homeNow]);
  const homeDayEnd = useMemo(() => {
    const current = new Date(homeNow);
    return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime();
  }, [homeNow]);
  const todaySleepMinutes = useMemo(() => {
    const intervals = data.sleeps.flatMap((item) => {
      const start = parsedDate(item.start)?.getTime();
      const end = parsedDate(item.end)?.getTime();
      if (start === undefined || end === undefined) return [];
      const clippedStart = Math.max(start, homeDayStart);
      const clippedEnd = Math.min(end, homeDayEnd, homeNow);
      return clippedEnd > clippedStart ? [[clippedStart, clippedEnd] as const] : [];
    }).sort((a, b) => a[0] - b[0]);
    let totalMilliseconds = 0;
    let mergedStart: number | undefined;
    let mergedEnd: number | undefined;
    intervals.forEach(([start, end]) => {
      if (mergedStart === undefined || mergedEnd === undefined) {
        mergedStart = start;
        mergedEnd = end;
        return;
      }
      if (start <= mergedEnd) {
        mergedEnd = Math.max(mergedEnd, end);
        return;
      }
      totalMilliseconds += mergedEnd - mergedStart;
      mergedStart = start;
      mergedEnd = end;
    });
    if (mergedStart !== undefined && mergedEnd !== undefined) totalMilliseconds += mergedEnd - mergedStart;
    return totalMilliseconds / 60_000;
  }, [data.sleeps, homeDayEnd, homeDayStart, homeNow]);
  const todayPoopCount = useMemo(() => data.diapers.filter((item) => {
    const time = parsedDate(item.time)?.getTime();
    return time !== undefined
      && time >= homeDayStart
      && time < homeDayEnd
      && !["湿尿布", "旧尿布记录"].includes(item.status);
  }).length, [data.diapers, homeDayEnd, homeDayStart]);
  const todayVitaminDRecords = useMemo(() => data.supplements.filter((item) => (
    item.date === localDateValue(new Date(homeNow)) && isVitaminDSupplement(item)
  )), [data.supplements, homeNow]);
  const todayVitaminD = todayVitaminDRecords.find((item) => item.completed) ?? todayVitaminDRecords[0];
  const visibleHomeTodos = data.todos.slice(0, 3);
  const currentGrowthRecord = useMemo(() => {
    const currentDate = localDateValue(new Date(homeNow));
    return data.growthRecords.find((item) => item.date === currentDate);
  }, [data.growthRecords, homeNow]);

  const notify = (message: string) => setToast(message);

  const handleNativeInputFocus = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.currentTarget;
    window.setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 260);
  };

  const chooseUpload = (file: File | undefined, accept: "image" | "audio") => {
    if (!file) return;
    const validType = accept === "image" ? isImageFile(file) : isAudioFile(file);
    const maxBytes = (accept === "image" ? 12 : 40) * 1024 * 1024;
    if (!validType) {
      const message = accept === "image"
        ? "请选择 JPG、PNG、WebP、HEIC 或 HEIF 图片"
        : "请选择 MP3、M4A、AAC、WAV 或 OGG 音频";
      setUpload(undefined);
      setUploadError(message);
      notify(message);
      return;
    }
    if (file.size > maxBytes) {
      const message = `${accept === "image" ? "图片" : "音频"}请控制在 ${accept === "image" ? 12 : 40} MB 以内`;
      setUpload(undefined);
      setUploadError(message);
      notify(message);
      return;
    }
    setUpload(file);
    setUploadError("");
    setUploadPreviewFailed(false);
    notify(`已选择 ${file.name}`);
  };

  const openEditor = (kind: EditorKind, item?: Record<string, unknown>) => {
    const base: Draft = {};
    if (item) {
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
          const isDateTimeField = ["time", "start", "end"].includes(key) && typeof value === "string";
          const parsedDate = isDateTimeField ? new Date(value) : null;
          base[key] = parsedDate && !Number.isNaN(parsedDate.getTime()) ? dateTimeLocal(parsedDate) : String(value);
        }
      });
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === "boolean") base[key] = value;
      });
      if (kind === "ability" && typeof item.id === "string") base.syncMemory = data.memories.some((memory) => memory.sourceAbilityId === item.id);
      if (kind === "checkup") {
        base.completed = Boolean(item.completedDate);
        base.completedDate = typeof item.completedDate === "string" ? item.completedDate : today();
      }
    }
    if (!item) {
      if (["feeding", "diaper"].includes(kind)) base.time = dateTimeLocal();
      if (kind === "sleep") {
        base.start = dateTimeLocal(new Date(Date.now() - 60 * 60_000));
        base.end = dateTimeLocal();
      }
      if (["supplement", "memory", "growth", "ability", "checkup"].includes(kind)) base.date = today();
      if (kind === "vaccine") {
        base.ageLabel = "其他记录";
        base.dueDate = today();
        base.protects = "按当地接种门诊安排";
      }
      if (kind === "feeding") {
        base.amount = "150";
        base.milkType = "母乳";
      }
      if (kind === "diaper") base.status = "正常软便";
      if (kind === "supplement") base.completed = true;
      if (kind === "memory") base.type = memoryFilter === "all" ? "moment" : memoryFilter;
      if (kind === "ability") base.syncMemory = true;
      if (kind === "checkup") {
        base.completed = false;
        base.completedDate = today();
      }
      if (kind === "learning") {
        base.kind = studyTab;
        base.artworkKey = "apple";
      }
      if (kind === "profile") {
        base.name = data.baby.name;
        base.birthDate = data.baby.birthDate;
        base.birthWeight = data.baby.birthWeight ? String(data.baby.birthWeight) : "";
        base.birthHeight = data.baby.birthHeight ? String(data.baby.birthHeight) : "";
        base.clearDemo = data.demoMode;
        if (data.baby.avatarId) base.avatarId = data.baby.avatarId;
      }
    }
    setDraft(base);
    setUpload(undefined);
    setUploadError("");
    setUploadPreviewFailed(false);
    setSavingEditor(false);
    setEditorReturnOverlay(overlay);
    setOverlay(null);
    setEditor({ kind, id: typeof item?.id === "string" ? item.id : undefined });
  };

  const closeEditor = () => {
    const returnTo = editorReturnOverlay;
    keyboard.hide();
    setEditor(null);
    setUpload(undefined);
    setUploadError("");
    setUploadPreviewFailed(false);
    setSavingEditor(false);
    setEditorReturnOverlay(null);
    if (returnTo) setOverlay(returnTo);
  };

  const openNewMemory = (type: MemoryType) => {
    setMemoryFilter(type);
    openEditor("memory");
    setDraft((current) => ({ ...current, type }));
  };

  const openNewLearning = (kind: StudyTab) => {
    setStudyTab(kind);
    openEditor("learning");
    setDraft((current) => ({ ...current, kind }));
  };

  const openMemoryLibrary = (filter: "all" | MemoryType) => {
    setMemoryFilter(filter);
    setOverlay({ type: "memory-library", filter });
  };

  const openHealthLibrary = (tab: HealthTab) => {
    setHealthTab(tab);
    setOverlay({ type: "health-library", tab });
  };

  const openEducationLibrary = (tab: EducationTab) => {
    setEducationTab(tab);
    setOverlay({ type: "education-library", tab });
  };

  const openStudyLibrary = (tab: StudyTab) => {
    setStudyTab(tab);
    setOverlay({ type: "study-library", tab });
  };

  const openTodoLibrary = () => setOverlay({ type: "todo-library" });
  const openGrowthLibrary = () => setOverlay({ type: "growth-library" });

  const draftValue = (key: string) => String(draft[key] ?? "");
  const changeDraft = (key: string, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const required = (...keys: string[]) => keys.every((key) => draftValue(key).trim());

  const recordAssetId = (kind: EditorKind, id?: string) => {
    if (kind === "profile") return data.baby.avatarId;
    if (!id) return undefined;
    if (kind === "memory") return data.memories.find((item) => item.id === id)?.assetId;
    if (kind === "ability") return data.abilities.find((item) => item.id === id)?.imageId;
    if (kind === "music") return data.musicTracks.find((item) => item.id === id)?.assetId;
    if (kind === "story") return data.stories.find((item) => item.id === id)?.coverId;
    if (kind === "learning") return data.learningItems.find((item) => item.id === id)?.imageId;
    return undefined;
  };

  const persistEditorData = (update: AppData | ((current: AppData) => AppData)) => {
    const next = typeof update === "function" ? update(data) : update;
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(next));
    setData(next);
    return next;
  };

  const saveEditor = async () => {
    if (!editor || savingEditor) return;
    const { kind, id: editingId } = editor;
    const id = editingId ?? uid();
    const fail = (message: string) => {
      setSavingEditor(false);
      notify(message);
      return false;
    };

    if (kind === "profile" && !required("name", "birthDate")) return void fail("请填写宝宝姓名和出生日期");
    if (kind === "profile" && ((draftValue("birthWeight").trim() && Number(draftValue("birthWeight")) <= 0) || (draftValue("birthHeight").trim() && Number(draftValue("birthHeight")) <= 0))) return void fail("已填写的出生身高和体重需要大于 0");
    if (kind === "profile" && draftValue("birthDate") > today()) return void fail("出生日期不能晚于今天");
    if (kind === "profile" && upload && !isImageFile(upload)) return void fail("宝宝照片请选择图片文件");
    if (kind === "profile" && upload && upload.size > 12 * 1024 * 1024) return void fail("宝宝照片请控制在 12 MB 以内");
    if (kind === "feeding" && !required("time", "amount", "milkType")) return void fail("请补全喂养信息");
    if (kind === "feeding" && Number(draftValue("amount")) <= 0) return void fail("奶量需要大于 0");
    if (kind === "feeding" && +new Date(draftValue("time")) > Date.now()) return void fail("喂养时间不能晚于现在");
    if (kind === "sleep" && !required("start", "end")) return void fail("请选择睡眠起止时间");
    if (kind === "sleep" && +new Date(draftValue("end")) <= +new Date(draftValue("start"))) return void fail("结束时间需要晚于开始时间");
    if (kind === "sleep" && (+new Date(draftValue("start")) > Date.now() || +new Date(draftValue("end")) > Date.now())) return void fail("睡眠时间不能晚于现在");
    if (kind === "diaper" && !required("time", "status")) return void fail("请补全便便信息");
    if (kind === "diaper" && +new Date(draftValue("time")) > Date.now()) return void fail("便便时间不能晚于现在");
    if (kind === "supplement" && !required("name", "date")) return void fail("请填写补剂名称和日期");
    if (kind === "todo" && !required("title")) return void fail("请填写待办内容");
    if (kind === "memory" && !required("type", "title", "date", "description")) return void fail("请补全这段记忆");
    if (kind === "memory" && draftValue("type") === "photo" && !editingId && !upload) return void fail("请先选择一张宝宝照片");
    if (kind === "memory" && upload && !isImageFile(upload)) return void fail("请选择 JPG、PNG、WebP 或 HEIC 图片");
    if (kind === "memory" && upload && upload.size > 12 * 1024 * 1024) return void fail("照片请控制在 12 MB 以内");
    if (kind === "memory" && draftValue("sourceAbilityId")) {
      const sourceAbilityId = draftValue("sourceAbilityId");
      if (!data.abilities.some((item) => item.id === sourceAbilityId)) return void fail("关联的发育里程碑已不存在，请返回健康记录重新添加");
      if (draftValue("date") < FIXED_BIRTH_DATE) return void fail("发育记录不能早于出生日期");
      if (draftValue("date") > today()) return void fail("发育记录不能晚于今天");
      if (data.abilities.some((item) => item.id !== sourceAbilityId && item.date === draftValue("date") && item.name.trim() === draftValue("title").trim())) return void fail("这一天已经记录过同名里程碑");
    }
    if (kind === "growth" && (!required("date") || (!draftValue("height").trim() && !draftValue("weight").trim()))) return void fail("请填写日期，并至少记录身长或体重中的一项");
    if (kind === "growth" && draftValue("date") < FIXED_BIRTH_DATE) return void fail("测量日期不能早于出生日期");
    if (kind === "growth" && draftValue("date") > today()) return void fail("测量日期不能晚于今天");
    if (kind === "growth") {
      const height = draftValue("height").trim() ? Number(draftValue("height")) : undefined;
      const weight = draftValue("weight").trim() ? Number(draftValue("weight")) : undefined;
      if ((height !== undefined && (!Number.isFinite(height) || height < 20 || height > 200)) || (weight !== undefined && (!Number.isFinite(weight) || weight < 0.5 || weight > 50))) return void fail("请检查数值：身长需为 20–200 cm，体重需为 0.5–50 kg");
      if (draftValue("date") === FIXED_BIRTH_DATE && (height !== FIXED_BIRTH_HEIGHT || weight !== FIXED_BIRTH_WEIGHT)) return void fail(`出生数据已固定为 ${FIXED_BIRTH_WEIGHT} kg / ${FIXED_BIRTH_HEIGHT} cm`);
      if (data.growthRecords.some((item) => item.date === draftValue("date") && item.id !== editingId)) return void fail("这一天已有成长记录，请编辑已有记录");
    }
    if (kind === "vaccine" && !required("ageLabel", "name", "dose", "dueDate")) return void fail("请填写年龄阶段、疫苗名称、针次与计划日期");
    if (kind === "vaccine" && editingId && data.vaccines.some((item) => item.id === editingId && item.scheduleKey)) return void fail("内置疫苗计划请直接在列表勾选，并填写实际接种时间");
    if (kind === "vaccine" && draftValue("completedDate") > today()) return void fail("实际接种日期不能晚于今天");
    if (kind === "vaccine" && draftValue("completedDate") && draftValue("completedDate") < FIXED_BIRTH_DATE) return void fail("实际接种日期不能早于出生日期");
    if (kind === "ability" && !required("date", "name", "description")) return void fail("请补全能力记录");
    if (kind === "ability" && draftValue("date") < FIXED_BIRTH_DATE) return void fail("发育记录不能早于出生日期");
    if (kind === "ability" && draftValue("date") > today()) return void fail("发育记录不能晚于今天");
    if (kind === "ability" && data.abilities.some((item) => item.id !== editingId && item.date === draftValue("date") && item.name.trim() === draftValue("name").trim())) return void fail("这一天已经记录过同名里程碑");
    if (kind === "ability" && upload && !isImageFile(upload)) return void fail("发育示意图请选择图片文件");
    if (kind === "ability" && upload && upload.size > 12 * 1024 * 1024) return void fail("发育示意图请控制在 12 MB 以内");
    if (kind === "checkup" && !required("date", "name", "tips")) return void fail("请补全儿保信息");
    if (kind === "checkup" && draftValue("date") < FIXED_BIRTH_DATE) return void fail("儿保日期不能早于出生日期");
    if (kind === "checkup" && Boolean(draft.completed) && (!draftValue("completedDate") || draftValue("completedDate") < FIXED_BIRTH_DATE || draftValue("completedDate") > today())) return void fail("完成日期需要在出生日期至今天之间");
    if (kind === "checkup" && data.checkups.some((item) => item.id !== editingId && item.date === draftValue("date") && item.name.trim() === draftValue("name").trim())) return void fail("这一天已经记录过同名儿保项目");
    if (kind === "music" && !required("name", "artist")) return void fail("请填写音乐名称与来源");
    if (kind === "music" && !upload && !draftValue("assetId")) return void fail("请选择一段音频");
    if (kind === "music" && upload && !isAudioFile(upload)) return void fail("请选择 MP3、M4A、AAC、WAV 等音频文件");
    if (kind === "music" && upload && upload.size > 40 * 1024 * 1024) return void fail("音频请控制在 40 MB 以内");
    if (kind === "story" && !required("name", "link")) return void fail("请填写故事名称和链接");
    if (kind === "story" && !/^https?:\/\//i.test(draftValue("link"))) return void fail("故事链接需要以 http:// 或 https:// 开头");
    if (kind === "story" && upload && !isImageFile(upload)) return void fail("故事封面请选择图片文件");
    if (kind === "story" && upload && upload.size > 12 * 1024 * 1024) return void fail("故事封面请控制在 12 MB 以内");
    if (kind === "learning" && !required("kind", "term", "translation")) return void fail("请补全学习卡片");
    if (kind === "learning" && upload && !isImageFile(upload)) return void fail("学习卡片请选择图片文件");
    if (kind === "learning" && upload && upload.size > 12 * 1024 * 1024) return void fail("学习卡片图片请控制在 12 MB 以内");

    const previousAssetId = recordAssetId(kind, editingId);
    let uploadedId: string | undefined;
    setSavingEditor(true);
    try {
      uploadedId = await saveAsset(upload);
    } catch {
      return void fail("文件保存失败，请重试或换一个较小的文件");
    }

    try {
    if (kind === "profile") {
      const shouldClearDemo = Boolean(draft.clearDemo);
      const demoIds = new Set(data.demoRecordIds);
      const demoAssetIds = new Set([
        ...data.memories.filter((item) => demoIds.has(item.id)).map((item) => item.assetId),
        ...data.abilities.filter((item) => demoIds.has(item.id)).map((item) => item.imageId),
        ...data.musicTracks.filter((item) => demoIds.has(item.id)).map((item) => item.assetId),
        ...data.stories.filter((item) => demoIds.has(item.id)).map((item) => item.coverId),
        ...data.learningItems.filter((item) => demoIds.has(item.id)).map((item) => item.imageId),
      ].filter(Boolean) as string[]);
      const next: AppData = {
        ...data,
        demoMode: shouldClearDemo ? false : data.demoMode,
        demoRecordIds: shouldClearDemo ? [] : data.demoRecordIds,
        demoVaccineCompletionKeys: shouldClearDemo ? [] : data.demoVaccineCompletionKeys,
        baby: {
          name: "硕之",
          birthDate: FIXED_BIRTH_DATE,
          birthWeight: FIXED_BIRTH_WEIGHT,
          birthHeight: FIXED_BIRTH_HEIGHT,
          avatarId: uploadedId ?? (draftValue("avatarId") || undefined),
        },
      };
      if (shouldClearDemo) {
        next.feedings = data.feedings.filter((item) => !demoIds.has(item.id));
        next.sleeps = data.sleeps.filter((item) => !demoIds.has(item.id));
        next.diapers = data.diapers.filter((item) => !demoIds.has(item.id));
        next.supplements = data.supplements.filter((item) => !demoIds.has(item.id));
        next.todos = data.todos.filter((item) => !demoIds.has(item.id));
        next.memories = data.memories.filter((item) => !demoIds.has(item.id));
        next.growthRecords = ensureFixedBirthGrowthRecord(data.growthRecords.filter((item) => !demoIds.has(item.id)));
        const demoVaccineKeys = new Set(data.demoVaccineCompletionKeys);
        next.vaccines = data.vaccines
          .filter((item) => !demoIds.has(item.id))
          .map((item) => item.scheduleKey && demoVaccineKeys.has(item.scheduleKey)
            ? { ...item, completedDate: undefined }
            : item);
        next.abilities = data.abilities.filter((item) => !demoIds.has(item.id));
        next.checkups = data.checkups.filter((item) => !demoIds.has(item.id));
        next.musicTracks = data.musicTracks.filter((item) => !demoIds.has(item.id));
        next.stories = data.stories.filter((item) => !demoIds.has(item.id));
        next.learningItems = data.learningItems.filter((item) => !demoIds.has(item.id));
      }
      persistEditorData(next);
      demoAssetIds.forEach((assetId) => {
        if (assetReferenceCount(next, assetId) === 0) void deleteAsset(assetId).catch(() => undefined);
      });
    }
    if (kind === "feeding") {
      const item: Feeding = { id, time: new Date(draftValue("time")).toISOString(), amount: Number(draftValue("amount")), milkType: draftValue("milkType"), note: draftValue("note") };
      persistEditorData((current) => ({ ...current, feedings: [...current.feedings.filter((x) => x.id !== id), item] }));
    }
    if (kind === "sleep") {
      const item: Sleep = { id, start: new Date(draftValue("start")).toISOString(), end: new Date(draftValue("end")).toISOString(), note: draftValue("note") };
      persistEditorData((current) => ({ ...current, sleeps: [...current.sleeps.filter((x) => x.id !== id), item] }));
    }
    if (kind === "diaper") {
      const item: Diaper = { id, time: new Date(draftValue("time")).toISOString(), status: draftValue("status"), note: draftValue("note") };
      persistEditorData((current) => ({ ...current, diapers: [...current.diapers.filter((x) => x.id !== id), item] }));
    }
    if (kind === "supplement") {
      const item: Supplement = { id, name: draftValue("name"), date: draftValue("date"), completed: Boolean(draft.completed) };
      persistEditorData((current) => ({
        ...current,
        supplements: [
          ...current.supplements.filter((x) => x.id !== id && !(isVitaminDSupplement(item) && isVitaminDSupplement(x) && x.date === item.date)),
          item,
        ],
      }));
    }
    if (kind === "todo") {
      const item: Todo = { id, title: draftValue("title"), completed: Boolean(draft.completed) };
      persistEditorData((current) => ({ ...current, todos: [...current.todos.filter((x) => x.id !== id), item] }));
    }
    if (kind === "memory") {
      const sourceAbilityId = draftValue("sourceAbilityId") || undefined;
      const item: Memory = { id, type: sourceAbilityId ? "moment" : draftValue("type") as MemoryType, title: draftValue("title"), date: draftValue("date"), description: draftValue("description"), assetId: uploadedId ?? (draftValue("assetId") || undefined), sourceAbilityId };
      persistEditorData((current) => ({
        ...current,
        memories: upsertById(current.memories, item),
        abilities: sourceAbilityId ? current.abilities.map((ability) => ability.id === sourceAbilityId ? { ...ability, date: item.date, name: item.title, description: item.description, imageId: item.assetId } : ability) : current.abilities,
      }));
    }
    if (kind === "growth") {
      const item: GrowthRecord = { id, date: draftValue("date"), height: draftValue("height").trim() ? Number(draftValue("height")) : undefined, weight: draftValue("weight").trim() ? Number(draftValue("weight")) : undefined, note: draftValue("note").trim() || undefined };
      persistEditorData((current) => ({ ...current, growthRecords: [...current.growthRecords.filter((x) => x.id !== id), item] }));
    }
    if (kind === "vaccine") {
      const previous = data.vaccines.find((item) => item.id === id);
      const item: Vaccine = {
        ...previous,
        id,
        ageLabel: draftValue("ageLabel").trim() || previous?.ageLabel || "其他记录",
        name: draftValue("name").trim(),
        dose: draftValue("dose").trim(),
        dueDate: draftValue("dueDate"),
        completedDate: draftValue("completedDate") || undefined,
        nextDate: undefined,
        protects: draftValue("protects").trim() || previous?.protects || "按当地接种门诊安排",
        note: draftValue("note").trim() || undefined,
      };
      persistEditorData((current) => ({ ...current, vaccines: upsertById(current.vaccines, item) }));
    }
    if (kind === "ability") {
      const item: Ability = { id, date: draftValue("date"), name: draftValue("name"), description: draftValue("description"), imageId: uploadedId ?? (draftValue("imageId") || undefined) };
      persistEditorData((current) => {
        const linked = current.memories.find((memory) => memory.sourceAbilityId === id);
        const linkedMemory: Memory = { id: linked?.id ?? uid(), type: "moment", title: item.name, date: item.date, description: item.description, assetId: item.imageId, sourceAbilityId: id };
        const memories = Boolean(draft.syncMemory)
          ? upsertById(current.memories, linkedMemory)
          : current.memories.filter((memory) => memory.sourceAbilityId !== id);
        return { ...current, abilities: upsertById(current.abilities, item), memories };
      });
    }
    if (kind === "checkup") {
      const item: Checkup = {
        id,
        date: draftValue("date"),
        name: draftValue("name"),
        tips: draftValue("tips"),
        completedDate: Boolean(draft.completed) ? draftValue("completedDate") : undefined,
      };
      persistEditorData((current) => ({ ...current, checkups: upsertById(current.checkups, item) }));
    }
    if (kind === "music") {
      if (upload && (playingId === id || pausedId === id)) {
        audioRef.current?.pause();
        audioRef.current = undefined;
        setPlayingId(undefined);
        setPausedId(undefined);
        setPlayback({ current: 0, duration: 0 });
      }
      let durationSeconds = draftValue("durationSeconds").trim() ? Number(draftValue("durationSeconds")) : undefined;
      if (upload) {
        try {
          durationSeconds = await readAudioDuration(upload);
        } catch {
          durationSeconds = undefined;
        }
      }
      const item: MusicTrack = {
        id,
        name: draftValue("name").trim(),
        artist: draftValue("artist").trim(),
        description: draftValue("description").trim() || undefined,
        durationSeconds,
        assetId: uploadedId ?? draftValue("assetId"),
      };
      persistEditorData((current) => ({ ...current, musicTracks: upsertById(current.musicTracks, item) }));
    }
    if (kind === "story") {
      const item: Story = { id, name: draftValue("name"), link: draftValue("link"), coverId: uploadedId ?? (draftValue("coverId") || undefined) };
      persistEditorData((current) => ({ ...current, stories: upsertById(current.stories, item) }));
    }
    if (kind === "learning") {
      const nextKind = draftValue("kind") as StudyTab;
      const artworkKey = studyArtworkOptions.some((option) => option.key === draftValue("artworkKey"))
        ? draftValue("artworkKey") as StudyArtworkKey
        : undefined;
      const item: LearningItem = {
        id,
        kind: nextKind,
        term: draftValue("term").trim(),
        translation: draftValue("translation").trim(),
        imageId: uploadedId ?? (draftValue("imageId") || undefined),
        artworkKey,
      };
      persistEditorData((current) => ({ ...current, learningItems: upsertById(current.learningItems, item) }));
      setStudyTab(nextKind);
    }
    if (uploadedId && previousAssetId && uploadedId !== previousAssetId) {
      const linkedReplacementCount = kind === "ability" || (kind === "memory" && draftValue("sourceAbilityId")) ? 2 : 1;
      if (assetReferenceCount(data, previousAssetId) <= linkedReplacementCount) void deleteAsset(previousAssetId).catch(() => undefined);
    }
    } catch {
      if (uploadedId) await deleteAsset(uploadedId).catch(() => undefined);
      return void fail("记录未能保存，请检查浏览器存储空间后重试");
    }
    const returnTo = editorReturnOverlay;
    keyboard.hide();
    setEditor(null);
    setUpload(undefined);
    setUploadError("");
    setUploadPreviewFailed(false);
    setSavingEditor(false);
    setEditorReturnOverlay(null);
    if (returnTo) setOverlay(returnTo);
    notify(editingId ? "已经更新" : "已经记下来了");
  };

  const deletePrompt = (kind: DeletableKind, id: string) => {
    if (kind === "memory" && data.memories.some((item) => item.id === id && item.sourceAbilityId)) {
      return "这条瞬间来自健康记录中的能力里程碑。删除后仅从成长回忆移除，健康记录会保留。";
    }
    if (kind === "ability" && data.memories.some((item) => item.sourceAbilityId === id)) {
      return "这条能力记录已同步到成长回忆。删除后，两处记录会一起移除。";
    }
    return "删除后无法撤回，但不会影响其他页面的记录。";
  };

  const removeItem = (kind: DeletableKind, id: string) => {
    if (kind === "growth" && data.growthRecords.some((item) => item.id === id && item.date === FIXED_BIRTH_DATE)) {
      notify(`出生数据 ${FIXED_BIRTH_WEIGHT} kg / ${FIXED_BIRTH_HEIGHT} cm 是固定资料，不能删除`);
      return;
    }
    if (kind === "vaccine" && data.vaccines.some((item) => item.id === id && item.scheduleKey)) {
      notify("内置疫苗计划不能删除，可在列表中勾选或取消接种状态");
      return;
    }
    const returnTo = overlay ?? editorReturnOverlay;
    setDeleteReturnOverlay(returnTo);
    setEditorReturnOverlay(null);
    setOverlay(null);
    setPendingDelete({ kind, id });
  };

  const closeDeleteConfirmation = (confirmed: boolean) => {
    const returnTo = deleteReturnOverlay;
    setPendingDelete(null);
    setDeleteReturnOverlay(null);
    if (!returnTo) return;
    if (confirmed && returnTo.type === "memory-detail") {
      setOverlay({ type: "memory-library", filter: memoryFilter });
      return;
    }
    setOverlay(returnTo);
  };

  const performRemoveItem = (kind: DeletableKind, id: string) => {
    if (kind === "vaccine" && data.vaccines.some((item) => item.id === id && item.scheduleKey)) {
      notify("内置疫苗计划不能删除");
      return;
    }
    const candidateAssetIds = new Set<string>();
    const deletedIds = new Set([id]);
    const directAssetId = recordAssetId(kind, id);
    if (directAssetId) candidateAssetIds.add(directAssetId);
    const linkedAbilityId = kind === "memory" ? data.memories.find((item) => item.id === id)?.sourceAbilityId : undefined;
    const linkedMemory = kind === "ability" ? data.memories.find((item) => item.sourceAbilityId === id) : undefined;
    if (linkedMemory) {
      deletedIds.add(linkedMemory.id);
      if (linkedMemory.assetId) candidateAssetIds.add(linkedMemory.assetId);
    }
    const next = { ...data };
    if (kind === "feeding") next.feedings = data.feedings.filter((x) => x.id !== id);
    if (kind === "sleep") next.sleeps = data.sleeps.filter((x) => x.id !== id);
    if (kind === "diaper") next.diapers = data.diapers.filter((x) => x.id !== id);
    if (kind === "supplement") next.supplements = data.supplements.filter((x) => x.id !== id);
    if (kind === "todo") next.todos = data.todos.filter((x) => x.id !== id);
    if (kind === "memory") {
      next.memories = data.memories.filter((x) => x.id !== id);
    }
    if (kind === "growth") next.growthRecords = data.growthRecords.filter((x) => x.id !== id);
    if (kind === "vaccine") next.vaccines = data.vaccines.filter((x) => x.id !== id);
    if (kind === "ability") {
      next.abilities = data.abilities.filter((x) => x.id !== id);
      next.memories = data.memories.filter((x) => x.sourceAbilityId !== id);
    }
    if (kind === "checkup") next.checkups = data.checkups.filter((x) => x.id !== id);
    if (kind === "music") next.musicTracks = data.musicTracks.filter((x) => x.id !== id);
    if (kind === "story") next.stories = data.stories.filter((x) => x.id !== id);
    if (kind === "learning") next.learningItems = data.learningItems.filter((x) => x.id !== id);
    next.demoRecordIds = data.demoRecordIds.filter((recordId) => !deletedIds.has(recordId));
    setData(next);
    candidateAssetIds.forEach((assetId) => {
      if (assetReferenceCount(next, assetId) === 0) void deleteAsset(assetId).catch(() => undefined);
    });
    notify(kind === "memory" && linkedAbilityId ? "已从成长回忆移除，健康记录仍保留" : "记录已删除");
  };

  const toggleTodo = (id: string) => {
    const item = data.todos.find((todo) => todo.id === id);
    setData((current) => ({ ...current, todos: current.todos.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo) }));
    if (item) notify(item.completed ? `已恢复为待办：${item.title}` : `已完成：${item.title}`);
  };

  const toggleSupplement = (id: string) => {
    setData((current) => ({ ...current, supplements: current.supplements.map((item) => item.id === id ? { ...item, completed: !item.completed, date: today() } : item) }));
    notify("补剂状态已同步到首页");
  };

  const setVaccineCompletedDate = (id: string, completedDate?: string) => {
    const item = data.vaccines.find((vaccine) => vaccine.id === id);
    if (!item) return false;
    if (completedDate && (completedDate > today() || completedDate < FIXED_BIRTH_DATE)) {
      notify(`接种日期需要在 ${FIXED_BIRTH_DATE} 至今天之间`);
      return false;
    }
    if (completedDate && item.choiceGroup) {
      const family = vaccineChoiceFamily(item.choiceGroup);
      const conflicting = data.vaccines.find((candidate) => candidate.id !== id
        && candidate.completedDate
        && candidate.choiceGroup !== item.choiceGroup
        && vaccineChoiceFamily(candidate.choiceGroup) === family);
      if (conflicting) {
        notify(`已记录“${conflicting.choiceGroup}”方案，请先取消该方案后再选择“${item.choiceGroup}”`);
        return false;
      }
    }
    setData((current) => {
      const currentItem = current.vaccines.find((candidate) => candidate.id === id);
      return {
        ...current,
        demoVaccineCompletionKeys: currentItem?.scheduleKey
          ? current.demoVaccineCompletionKeys.filter((key) => key !== currentItem.scheduleKey)
          : current.demoVaccineCompletionKeys,
        vaccines: current.vaccines.map((candidate) => candidate.id === id ? { ...candidate, completedDate: completedDate || undefined } : candidate),
      };
    });
    return true;
  };

  const toggleVaccineCompletion = (id: string) => {
    const item = data.vaccines.find((vaccine) => vaccine.id === id);
    if (!item) return;
    const completedDate = item.completedDate ? undefined : today();
    if (setVaccineCompletedDate(id, completedDate)) {
      notify(completedDate ? `已记录：${item.name} ${item.dose}` : `已取消：${item.name} ${item.dose}`);
    }
  };

  const quickLogPoop = () => {
    const item: Diaper = {
      id: uid(),
      time: new Date().toISOString(),
      status: "正常软便",
      note: "首页快速记录",
    };
    setData((current) => ({ ...current, diapers: [...current.diapers, item] }));
    setPoopCheckPulse(true);
    window.setTimeout(() => setPoopCheckPulse(false), 650);
    notify(`已记录今天第 ${todayPoopCount + 1} 次便便`);
  };

  const quickToggleVitaminD = () => {
    const date = localDateValue(new Date());
    if (todayVitaminDRecords.length) {
      const nextCompleted = !todayVitaminDRecords.some((item) => item.completed);
      const canonicalId = todayVitaminDRecords[0].id;
      const duplicateIds = new Set(todayVitaminDRecords.slice(1).map((item) => item.id));
      setData((current) => ({
        ...current,
        supplements: current.supplements
          .filter((item) => !duplicateIds.has(item.id))
          .map((item) => item.id === canonicalId ? { ...item, name: "维生素 D", date, completed: nextCompleted } : item),
      }));
      notify(nextCompleted ? "已确认今天服用维生素 D" : "已取消今天的维生素 D 确认");
      return;
    }
    const item: Supplement = { id: uid(), name: "维生素 D", date, completed: true };
    setData((current) => ({ ...current, supplements: [...current.supplements, item] }));
    notify("已确认今天服用维生素 D");
  };

  const reportText = useMemo(() => {
    const end = Date.now();
    const start = reportDays ? end - reportDays * DAY : 0;
    const rangeLabel = reportDays === 1 ? "近 24 小时" : reportDays ? `近 ${reportDays} 天` : "全部记录";
    const dateStamp = (value: string) => +new Date(value.length === 10 ? `${value}T00:00:00` : value);
    const feeds = data.feedings.filter((item) => dateStamp(item.time) >= start && dateStamp(item.time) <= end);
    const sleeps = data.sleeps.filter((item) => dateStamp(item.end) >= start && dateStamp(item.start) <= end);
    const diapers = data.diapers.filter((item) => dateStamp(item.time) >= start && dateStamp(item.time) <= end);
    const supplements = data.supplements.filter((item) => dateStamp(item.date) >= start && dateStamp(item.date) <= end);
    const memories = data.memories.filter((item) => dateStamp(item.date) >= start && dateStamp(item.date) <= end);
    const sleepMinutes = sleeps.reduce((sum, item) => {
      const overlap = Math.max(0, Math.min(dateStamp(item.end), end) - Math.max(dateStamp(item.start), start));
      return sum + overlap / 60_000;
    }, 0);
    const lines = [
      ...(data.demoMode ? ["【示例数据】请先点击首页头像填写真实资料，再分享给家人。"] : []),
      `${reportShowName ? `${data.baby.name} 的` : ""}宝宝基本报告 · ${rangeLabel}`,
      `生成时间：${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())}`,
      `月龄：${age.months} 个月 ${age.days} 天`,
      latestHeightRecord ? `最新身长：${latestHeightRecord.height} cm（${displayDate(latestHeightRecord.date)}）` : "最新身长：暂无记录",
      latestWeightRecord ? `最新体重：${latestWeightRecord.weight} kg（${displayDate(latestWeightRecord.date)}）` : "最新体重：暂无记录",
      feeds.length ? `喂养：${feeds.length} 次，共 ${feeds.reduce((sum, item) => sum + item.amount, 0)} ml` : "喂养：暂无记录",
      sleeps.length ? `睡眠：${sleeps.length} 段，共 ${Math.round(sleepMinutes / 60 * 10) / 10} 小时` : "睡眠：暂无记录",
      diapers.length ? `便便：${diapers.length} 次` : "便便：暂无记录",
    ];
    if (reportIncludeHealth) {
      lines.push(supplements.length ? `补剂：${supplements.filter((item) => item.completed).length} 条已完成 / ${supplements.length} 条记录` : "补剂：暂无记录");
      lines.push(`疫苗提醒：${nextVaccine ? `${nextVaccineOverdue ? "已逾期 · " : "下一针 · "}${nextVaccine.name} ${nextVaccine.dose} · ${displayDate(nextVaccine.dueDate)}` : "目前没有待接种项目"}`);
    }
    if (reportIncludeMemories) lines.push(memories.length ? `成长回忆：${memories.length} 条` : "成长回忆：暂无记录");
    lines.push("本报告仅用于家庭记录，不构成医疗建议。", "—— Little Steps");
    return lines.join("\n");
  }, [age.days, age.months, data, latestHeightRecord, latestWeightRecord, nextVaccine, nextVaccineOverdue, overlay?.type, reportDays, reportIncludeHealth, reportIncludeMemories, reportShowName]);

  const shareReport = async () => {
    try {
      if (navigator.share) await navigator.share({ title: reportShowName ? `${data.baby.name} 的宝宝基本报告` : "宝宝基本报告", text: reportText });
      else {
        await navigator.clipboard.writeText(reportText);
        notify("报告已复制，可以直接发送");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") notify("暂时无法分享，请稍后重试");
    }
  };

  const downloadReport = () => {
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${reportShowName ? `${data.baby.name}-` : ""}宝宝基本报告.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const playTrack = async (track: MusicTrack) => {
    if (!track.assetId || !assetUrls[track.assetId]) {
      notify("请先上传这首音乐，上传后即可真实播放");
      openEditor("music", track as unknown as Record<string, unknown>);
      return;
    }
    if (playingId === track.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(undefined);
      setPausedId(track.id);
      return;
    }
    if (pausedId === track.id && audioRef.current) {
      try {
        await audioRef.current.play();
        setPausedId(undefined);
        setPlayingId(track.id);
      } catch {
        notify("浏览器没有成功继续播放，请再次点击或重新上传音频");
      }
      return;
    }
    audioRef.current?.pause();
    setPausedId(undefined);
    const audio = new Audio(assetUrls[track.assetId]);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => setPlayback({ current: 0, duration: Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds ?? 0 });
    audio.ontimeupdate = () => setPlayback({ current: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds ?? 0 });
    audio.onended = () => {
      setPlayingId(undefined);
      setPausedId(undefined);
      setPlayback({ current: 0, duration: Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds ?? 0 });
    };
    audio.onerror = () => {
      setPlayingId(undefined);
      setPausedId(undefined);
      notify("这段音频暂时无法播放，请尝试重新上传");
    };
    audioRef.current = audio;
    try {
      await audio.play();
      setPlayingId(track.id);
    } catch {
      setPlayingId(undefined);
      setPausedId(undefined);
      notify("浏览器没有成功播放，请再次点击或重新上传音频");
    }
  };

  const seekTrack = (trackId: string, seconds: number) => {
    if ((playingId !== trackId && pausedId !== trackId) || !audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
    setPlayback((current) => ({ ...current, current: audioRef.current?.currentTime ?? seconds }));
  };

  const openStory = (story: Story) => {
    if (!/^https?:\/\//i.test(story.link)) return notify("这个故事链接无效，请先编辑链接");
    const popup = window.open("", "_blank");
    if (!popup) return notify("浏览器拦截了新窗口，请允许弹窗后再试");
    popup.opener = null;
    popup.location.href = story.link;
  };

  const speak = (item: LearningItem) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      notify("当前浏览器不支持语音朗读");
      return;
    }
    if (speakingId === item.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(undefined);
      notify(`已停止 ${item.term} 的发音`);
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(item.term);
    speech.lang = item.kind === "english" ? "en-US" : "zh-CN";
    speech.rate = 0.78;
    speech.pitch = 1.04;
    const matchingVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(item.kind === "english" ? "en" : "zh"));
    if (matchingVoice) speech.voice = matchingVoice;
    speech.onstart = () => setSpeakingId(item.id);
    speech.onend = () => setSpeakingId((current) => current === item.id ? undefined : current);
    speech.onerror = () => {
      setSpeakingId((current) => current === item.id ? undefined : current);
      notify("没有成功发音，请检查系统语音设置");
    };
    window.speechSynthesis.speak(speech);
  };

  const goHome = () => {
    keyboard.hide();
    setPage("home");
  };

  const renderHome = () => {
    const lastFeed = sortedFeedings[0];
    const lastSleep = sortedSleeps[0];
    const lastDiaper = sortedDiapers[0];
    return (
      <main className="screen-content journal-page home-page" aria-label="首页">
        <header className="journal-topbar home-topbar">
          <img src="/assets/baby/weather.png" alt="晴间多云" />
          <h1>{homeDateHeading(homeNow)}</h1>
          <div className="topbar-actions">
            <DoodleButton className="notification-button" label="查看通知" onClick={() => setOverlay({ type: "notifications" })}><BellIcon /></DoodleButton>
            <DoodleButton label="生成分享报告" onClick={() => setOverlay({ type: "report" })}><ExternalLinkIcon /></DoodleButton>
          </div>
        </header>

        <section className="home-hero" aria-label={`${data.baby.name} 的成长概览`}>
          <div className="hero-story">
            <span className="hero-sparkle coral-sparkle" aria-hidden="true">✦</span>
            <span className="hero-sparkle yellow-sparkle" aria-hidden="true">✦</span>
            <span className="hero-sparkle blue-sparkle" aria-hidden="true">✦</span>
            <button className="baby-avatar" type="button" onClick={() => openEditor("profile")} aria-label="修改宝宝资料与照片" data-scroll-drag="ignore">
              <img src={avatarUrl ?? (data.demoMode ? "/assets/baby/demo-avatar-tight.png" : "/assets/baby/bear-journal.png")} alt={`${data.baby.name} 的照片`} />
              <span className="avatar-camera"><CameraIcon /></span>
            </button>
            <img className="corgi-companion" src="/assets/baby/corgi-companion-v2.png" alt="手绘柯基伙伴" />
            <div className="hero-copy">
              <div className="name-line"><h2>{data.baby.name}</h2><span aria-hidden="true">♥</span></div>
              <p className="age-line">{age.months} months {age.days} days</p>
              <span className="highlight-note">Growing beautifully!</span>
            </div>
            <span className="hero-ground" aria-hidden="true" />
          </div>
          <div className="metrics-row">
            <div className="metric"><img src="/assets/baby/icon-weight.png" alt="" /><span>Weight</span><strong>{latestWeightRecord?.weight ?? "—"} <small>kg</small></strong></div>
            <div className="metric"><img src="/assets/baby/icon-height.png" alt="" /><span>Height</span><strong>{latestHeightRecord?.height ?? "—"} <small>cm</small></strong></div>
            <div className="metric"><img src="/assets/baby/icon-age.png" alt="" /><span>Current age</span><strong>{age.months} <small>months</small></strong></div>
          </div>
        </section>

        <section className="care-grid" aria-label="今日最新记录">
          <button className="care-card feeding-card" type="button" onClick={() => setOverlay({ type: "list", list: "feeding" })}>
            <span className="care-card-head">
              <img src="/assets/baby/icon-feeding.png" alt="" />
              <span className="care-heading-copy"><strong>Feeding</strong><span className="care-eyebrow">Last feeding:</span><b className="care-primary">{lastFeed ? homeRelativeTime(lastFeed.time, homeNow) : "No record yet"}</b></span>
              <ChevronRightIcon />
            </span>
            {lastFeed ? <span className="care-details feeding-details"><span><i className="detail-dot coral-dot" />Time: <b>{displayTime(lastFeed.time)}</b></span><span><i className="detail-dot blue-dot" />Amount: <b>{lastFeed.amount} ml</b></span><span><i className="detail-dot yellow-dot" />Type: <b>{homeMilkLabel(lastFeed.milkType)}</b></span></span> : null}
          </button>
          <button className="care-card sleep-card" type="button" onClick={() => setOverlay({ type: "list", list: "sleep" })}>
            <span className="care-card-head">
              <img src="/assets/baby/icon-sleep.png" alt="" />
              <span className="care-heading-copy"><strong>Sleep</strong><span className="care-eyebrow">Latest sleep:</span><b className="care-primary">{lastSleep ? `${displayTime(lastSleep.start)} - ${displayTime(lastSleep.end)}` : "No record yet"}</b></span>
              <ChevronRightIcon />
            </span>
            {lastSleep ? <span className="care-details sleep-details"><span>Duration:</span><b>{homeDurationLabel(lastSleep.start, lastSleep.end)}</b></span> : null}
          </button>
          <button className="care-card diaper-card" type="button" onClick={() => setOverlay({ type: "list", list: "diaper" })}>
            <span className="care-card-head compact-head">
              <img src="/assets/baby/icon-diaper.png" alt="" />
              <span className="care-heading-copy"><strong>便便</strong><span className="compact-summary">最新记录：<b>{lastDiaper ? displayTime(lastDiaper.time) : "—"}</b></span></span>
              <ChevronRightIcon />
            </span>
            {lastDiaper ? <span className="care-details compact-details"><span>状态：</span><b className="status-chip">{homeStatusLabel(lastDiaper.status)}</b></span> : null}
          </button>
          <button className="care-card health-card" type="button" onClick={() => setOverlay({ type: "list", list: "supplement" })}>
            <span className="care-card-head compact-head">
              <img src="/assets/baby/icon-health.png" alt="" />
              <span className="care-heading-copy"><strong>Health</strong><span className="compact-summary">Supplement check-in</span></span>
              <ChevronRightIcon />
            </span>
            {latestSupplement ? <span className="care-details compact-details health-details"><span>{homeSupplementLabel(latestSupplement.name)}:</span><b className={latestSupplement.completed && latestSupplement.date === today() ? "status-chip done" : "status-chip pending"}>{latestSupplement.completed && latestSupplement.date === today() ? "Completed today ✓" : "Still to do"}</b></span> : null}
          </button>
        </section>

        <section className="todo-card hand-card">
          <SectionTitle title="Today's To-do" action={<button className="add-pill" type="button" onClick={() => openEditor("todo")} data-scroll-drag="ignore"><PlusIcon /> Add</button>} />
          <div className="todo-list">
            {data.todos.map((item) => (
              <div className="todo-row" key={item.id}>
                <button className={`checkbox ${item.completed ? "checked" : ""}`} type="button" onClick={() => toggleTodo(item.id)} aria-label={`${item.completed ? "取消完成" : "完成"}${item.title}`} data-scroll-drag="ignore">{item.completed ? <CheckIcon /> : null}</button>
                <button className={`todo-title ${item.completed ? "completed" : ""}`} type="button" onClick={() => openEditor("todo", item as unknown as Record<string, unknown>)}>{homeTodoLabel(item.title)}</button>
                <button className="delete-todo" type="button" onClick={() => removeItem("todo", item.id)} aria-label="删除待办" data-scroll-drag="ignore"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <img className="bear-journal" src="/assets/baby/bear-journal-v2.png" alt="戴皇冠的小熊在写日记" />
        </section>
      </main>
    );
  };

  const renderMemory = () => {
    const filtered = data.memories.filter((item) => memoryFilter === "all" || item.type === memoryFilter);
    const photoItems = filtered.filter((item) => item.type === "photo");
    const visiblePhotoItems = memoryFilter === "photo" ? photoItems : photoItems.slice(0, 1);
    const compactItems = filtered.filter((item) => item.type !== "photo");
    const memoryIcon = (item: Memory) => {
      if (item.type === "note") return <img src="/assets/baby/memory-ref-note-v1.png" alt="" />;
      if (/rollover|step/i.test(item.title)) return <img src="/assets/baby/memory-ref-rollover-v1.png" alt="" />;
      return <img src="/assets/baby/memory-ref-smile-v1.png" alt="" />;
    };
    const memoryTone = (item: Memory, index: number) => item.type === "note" ? "blue" : /rollover/i.test(item.title) || index % 2 ? "sage" : "yellow";
    return (
      <main className={`screen-content page-content journal-page memory-page ${memoryFilter}-view`} aria-label="记忆册">
        <header className="journal-topbar memory-topbar">
          <DoodleButton className="memory-back" label="返回首页" onClick={goHome}><ArrowLeftIcon /></DoodleButton>
          <h1>Memory Book</h1>
          <DoodleButton className="memory-add" label="新增记忆" onClick={() => openEditor("memory")}><PlusIcon /></DoodleButton>
        </header>

        <SegmentedTabs
          className="memory-tabs"
          values={([
            { value: "all", label: "All" },
            { value: "moment", label: "Moments" },
            { value: "photo", label: "Photos" },
            { value: "note", label: "Notes" },
          ] as { value: "all" | MemoryType; label: string }[])}
          active={memoryFilter}
          onChange={(value) => { keyboard.hide(); setMemoryFilter(value); }}
          label="记忆类型"
          idPrefix="memory"
          panelId="memory-panel"
        />

        <section id="memory-panel" className={`memory-book-feed ${memoryFilter === "photo" ? "photos-view" : ""}`} role="tabpanel" aria-labelledby={`memory-tab-${memoryFilter}`}>
          {visiblePhotoItems.map((item) => {
            const image = item.assetId ? assetUrls[item.assetId] : "/assets/baby/memory-luna-cuddle-v1.png";
            return (
              <button className="memory-feature-card" type="button" key={item.id} onClick={() => setOverlay({ type: "memory-detail", id: item.id })}>
                <img className="feature-heart" src="/assets/baby/memory-ref-heart-transparent-v1.png" alt="" aria-hidden="true" />
                <img className="feature-star feature-star-one" src="/assets/baby/memory-ref-star-transparent-v1.png" alt="" aria-hidden="true" />
                <img className="feature-star feature-star-two" src="/assets/baby/memory-ref-star-transparent-v1.png" alt="" aria-hidden="true" />
                <img className="feature-sprig" src="/assets/baby/memory-ref-sprig-transparent-v1.png" alt="" aria-hidden="true" />
                <img className="feature-trail" src="/assets/baby/memory-ref-trail-transparent-v1.png" alt="" aria-hidden="true" />
                <span className="memory-date-label">{memoryDisplayDate(item.date)}</span>
                <figure className="memory-polaroid">
                  <span className="photo-tape photo-tape-left" aria-hidden="true" />
                  <span className="photo-tape photo-tape-right" aria-hidden="true" />
                  <img src={image} alt={item.title} />
                  <figcaption>{item.description}<HeartFilledIcon aria-hidden="true" /></figcaption>
                </figure>
              </button>
            );
          })}
          {memoryFilter === "photo" ? <button className="memory-photo-add-tile" type="button" onClick={() => openEditor("memory")}><span><CameraIcon /></span><strong>Add a photo</strong><small>JPG, PNG or HEIC</small></button> : null}

          {compactItems.map((item, index) => {
            const tone = memoryTone(item, index);
            return (
              <button className={`memory-list-row ${item.type} ${tone}`} type="button" key={item.id} onClick={() => setOverlay({ type: "memory-detail", id: item.id })}>
                <span className="memory-list-icon" aria-hidden="true">{memoryIcon(item)}</span>
                <span className="memory-list-copy">
                  <strong>{item.title}</strong>
                  {!(memoryFilter === "all" && item.type === "note") ? <span className="memory-list-date">{memoryDisplayDate(item.date)}{item.sourceAbilityId && memoryFilter === "moment" ? <em>Health linked</em> : null}</span> : null}
                  <span className="memory-list-rule" aria-hidden="true" />
                  <span className="memory-list-description">{item.description}</span>
                </span>
                <ChevronRightIcon className="memory-row-chevron" aria-hidden="true" />
                {item.type === "note" ? <HeartFilledIcon className="memory-row-accent heart" aria-hidden="true" /> : <StarFilledIcon className="memory-row-accent star" aria-hidden="true" />}
                {item.type === "note" ? <img className="memory-note-bear" src="/assets/baby/memory-ref-note-bear-v1.png" alt="" aria-hidden="true" /> : null}
              </button>
            );
          })}
          {!filtered.length ? <EmptyState text="这里还空着，记下今天的小事吧。" /> : null}
        </section>
      </main>
    );
  };

  const renderGrowth = () => {
    const mergedByDate = new Map<string, { date: string; axisLabel: string; height?: number; weight?: number }>();
    [...data.growthRecords].sort((a, b) => +new Date(a.date) - +new Date(b.date)).forEach((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      const current = mergedByDate.get(item.date);
      mergedByDate.set(item.date, {
        date: item.date,
        axisLabel: `${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date)}|${growthAgeLabel(FIXED_BIRTH_DATE, item.date)}`,
        height: typeof item.height === "number" ? item.height : current?.height,
        weight: typeof item.weight === "number" ? item.weight : current?.weight,
      });
    });
    const chartData = Array.from(mergedByDate.values()).filter((item) => typeof item.height === "number" || typeof item.weight === "number");
    const xAxisTicks = sampleGrowthPoints(chartData, Math.min(5, chartData.length)).map((item) => item.axisLabel);
    const showPointLabels = chartData.length <= 6;
    const hasHeight = chartData.some((item) => typeof item.height === "number");
    const hasWeight = chartData.some((item) => typeof item.weight === "number");
    const heightValues = chartData.flatMap((item) => typeof item.height === "number" ? [item.height] : []);
    const weightValues = chartData.flatMap((item) => typeof item.weight === "number" ? [item.weight] : []);
    const heightDomain: [number, number] = heightValues.length
      ? [Math.min(40, Math.floor((Math.min(...heightValues) - 5) / 10) * 10), Math.max(80, Math.ceil((Math.max(...heightValues) + 5) / 10) * 10)]
      : [40, 80];
    const weightDomain: [number, number] = weightValues.length
      ? [0, Math.max(10, Math.ceil((Math.max(...weightValues) + 1) / 2) * 2)]
      : [0, 10];
    return (
      <main className="screen-content page-content journal-page growth-page" aria-label="成长曲线">
        <section className="growth-profile-card" aria-label={`${data.baby.name} 的出生与月龄资料`}>
          <div className="growth-profile-visual">
            <img className="growth-profile-star" src="/assets/baby/memory-ref-star-transparent-v1.png" alt="" aria-hidden="true" />
            <button className="growth-avatar" type="button" onClick={() => openEditor("profile")} aria-label="修改宝宝资料与照片" data-scroll-drag="ignore">
              <img src={avatarUrl ?? (data.demoMode ? "/assets/baby/demo-avatar-tight.png" : "/assets/baby/bear-journal-v2.png")} alt={`${data.baby.name} 的照片`} />
              <span className="avatar-camera"><CameraIcon /></span>
            </button>
            <img className="growth-profile-bear" src="/assets/baby/growth-profile-bear-approved-v1.png" alt="陪伴宝宝的小白熊" />
          </div>
          <div className="growth-profile-stats">
            <div className="growth-profile-stat">
              <img src="/assets/baby/icon-age.png" alt="" />
              <span>出生日期</span>
              <strong>{growthDisplayDate(FIXED_BIRTH_DATE)}</strong>
            </div>
            <div className="growth-profile-stat">
              <img src="/assets/baby/icon-weight.png" alt="" />
              <span>出生体重</span>
              <strong>{FIXED_BIRTH_WEIGHT.toFixed(1)} kg</strong>
            </div>
            <div className="growth-profile-stat">
              <img src="/assets/baby/icon-height.png" alt="" />
              <span>出生身高</span>
              <strong>{FIXED_BIRTH_HEIGHT.toFixed(0)} cm</strong>
            </div>
            <div className="growth-profile-stat">
              <img src="/assets/baby/memory-ref-smile-v1.png" alt="" />
              <span>当前月龄</span>
              <strong>{age.months}个月 <em>{age.days}天</em></strong>
            </div>
          </div>
        </section>

        <section className="growth-chart-card" aria-labelledby="growth-chart-title">
          <div className="growth-chart-heading">
            <img src="/assets/baby/memory-ref-star-transparent-v1.png" alt="" aria-hidden="true" />
            <div className="growth-chart-legend" id="growth-chart-title">
              <span><i className="growth-legend-swatch height" /> 身高（cm）</span>
              <span><i className="growth-legend-swatch weight" /> 体重（kg）</span>
            </div>
            <img className="growth-chart-weather" src="/assets/baby/weather.png" alt="" aria-hidden="true" />
          </div>
          <div className="growth-axis-captions" aria-hidden="true"><span>身高（cm）</span><span>体重（kg）</span></div>
          <p className="visually-hidden">成长图按日期同时展示身长厘米与体重千克。当前共有 {data.growthRecords.length} 条成长记录。</p>
          <div className="growth-plot-area" role="img" aria-label={`成长曲线：按日期展示 ${data.baby.name} 的身长厘米与体重千克`}>
            {chartData.length ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 350, height: 200 }}>
              <LineChart data={chartData} margin={{ top: 15, right: 16, left: 16, bottom: 8 }}>
                <CartesianGrid stroke="#c7bda9" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="axisLabel" ticks={xAxisTicks} height={38} interval={0} tick={<GrowthXAxisTick />} axisLine={{ stroke: "#2a2823", strokeWidth: 1 }} tickLine={false} />
                {hasHeight ? <YAxis
                  yAxisId="height"
                  width={28}
                  domain={heightDomain}
                  ticks={chartTicks(heightDomain[0], heightDomain[1])}
                  tick={{ fontSize: 10.5, fill: "#1f4676", fontWeight: 700 }}
                  tickFormatter={(value: number) => value.toFixed(0)}
                  axisLine={{ stroke: "#2a2823", strokeWidth: 1 }}
                  tickLine={{ stroke: "#2a2823" }}
                /> : null}
                {hasWeight ? <YAxis
                  yAxisId="weight"
                  orientation="right"
                  width={28}
                  domain={weightDomain}
                  ticks={chartTicks(weightDomain[0], weightDomain[1], 5)}
                  tick={{ fontSize: 10.5, fill: "#52622c", fontWeight: 700 }}
                  tickFormatter={(value: number) => value.toFixed(0)}
                  axisLine={{ stroke: "#2a2823", strokeWidth: 1 }}
                  tickLine={{ stroke: "#2a2823" }}
                /> : null}
                <Tooltip cursor={{ stroke: "#8c8374", strokeDasharray: "3 4" }} contentStyle={{ background: "#fffaf0", border: "1.5px solid #111", borderRadius: 10, fontFamily: "Gaegu", fontSize: 13 }} labelFormatter={(label) => String(label).split("|")[0]} />
                {hasHeight ? <Line yAxisId="height" type="linear" dataKey="height" name="身高（cm）" stroke="#245a98" strokeWidth={2.4} connectNulls dot={{ r: 3.6, fill: "#fff9ed", stroke: "#245a98", strokeWidth: 2 }} activeDot={{ r: 5 }}>
                  {showPointLabels ? <LabelList dataKey="height" position="top" fill="#245a98" fontSize={10.5} fontWeight={700} formatter={(value: unknown) => Number(value).toFixed(1)} /> : null}
                </Line> : null}
                {hasWeight ? <Line yAxisId="weight" type="linear" dataKey="weight" name="体重（kg）" stroke="#59682f" strokeWidth={2.4} connectNulls dot={{ r: 3.6, fill: "#fff9ed", stroke: "#59682f", strokeWidth: 2 }} activeDot={{ r: 5 }}>
                  {showPointLabels ? <LabelList dataKey="weight" position="bottom" fill="#59682f" fontSize={10.5} fontWeight={700} formatter={(value: unknown) => Number(value).toFixed(1)} /> : null}
                </Line> : null}
              </LineChart>
            </ResponsiveContainer> : <div className="growth-chart-empty">添加第一条成长记录后，这里会自动生成曲线。</div>}
          </div>
          <img className="growth-chart-sprig" src="/assets/baby/memory-ref-sprig-transparent-v1.png" alt="" aria-hidden="true" />
          <img className="growth-chart-corgi" src="/assets/baby/corgi-companion-v2.png" alt="" aria-hidden="true" />
        </section>

        <section className="growth-history-card" aria-labelledby="growth-history-title">
          <div className="growth-history-heading">
            <img src="/assets/baby/memory-ref-sprig-transparent-v1.png" alt="" aria-hidden="true" />
            <h2 id="growth-history-title">成长记录</h2>
            <button className="growth-add-record app-add-button" type="button" onClick={(event) => { lastPageActionRef.current = event.currentTarget; openEditor("growth"); }} data-scroll-drag="ignore" aria-label="新增成长记录"><PlusIcon /> Add</button>
          </div>
          <div className="growth-history-table" role="table" aria-label="成长记录历史">
            <div className="growth-history-columns" role="row">
              <span role="columnheader">日期</span><span role="columnheader">体重（kg）</span><span role="columnheader">身高（cm）</span><span role="columnheader">备注</span><span role="columnheader">编辑</span>
            </div>
            <div className="growth-history-rows" role="rowgroup">
              {sortedGrowth.map((item, index) => (
                <div className="growth-history-row" role="row" key={item.id}>
                  <time role="cell" dateTime={item.date}>{growthDisplayDate(item.date)}</time>
                  <span role="cell">{typeof item.weight === "number" ? item.weight.toFixed(1) : "—"}</span>
                  <span role="cell">{typeof item.height === "number" ? item.height.toFixed(1) : "—"}</span>
                  <span className="growth-history-note" role="cell">{item.note || "—"}</span>
                  <button className="growth-edit-button" type="button" onClick={() => openEditor("growth", item as unknown as Record<string, unknown>)} aria-label={`编辑 ${growthDisplayDate(item.date)} 的成长记录`} data-scroll-drag="ignore"><Pencil1Icon /></button>
                </div>
              ))}
              {!sortedGrowth.length ? <button className="growth-history-empty app-add-button" type="button" onClick={(event) => { lastPageActionRef.current = event.currentTarget; openEditor("growth"); }} aria-label="新增成长记录"><PlusIcon /> Add</button> : null}
            </div>
          </div>
        </section>
      </main>
    );
  };

  const renderHealth = () => {
    const abilityArtwork = [
      "/assets/baby/health-development-tummy-time-reference-v2.png",
      "/assets/baby/health-development-rollover-reference-v2.png",
      "/assets/baby/health-development-sitting-reference-v2.png",
    ];
    const sortedVaccines = [...data.vaccines].sort((a, b) => (
      (a.scheduleOrder ?? 9_999) - (b.scheduleOrder ?? 9_999)
      || a.dueDate.localeCompare(b.dueDate)
      || a.name.localeCompare(b.name, "zh-CN")
    ));
    const vaccineGroups = Array.from(sortedVaccines.reduce((groups, item) => {
      const ageLabel = item.ageLabel || "其他记录";
      const group = groups.get(ageLabel) ?? [];
      group.push(item);
      groups.set(ageLabel, group);
      return groups;
    }, new Map<string, Vaccine[]>()));
    const completedVaccineCount = sortedVaccines.filter((item) => item.completedDate).length;
    const sortedAbilities = [...data.abilities]
      .filter((item) => item.date >= FIXED_BIRTH_DATE && item.date <= today())
      .sort((a, b) => a.date.localeCompare(b.date));
    const sortedCheckups = [...data.checkups]
      .filter((item) => item.date >= FIXED_BIRTH_DATE)
      .sort((a, b) => a.date.localeCompare(b.date));
    const abilityImage = (item: Ability) => {
      const uploaded = item.imageId ? assetUrls[item.imageId] : undefined;
      if (uploaded) return { src: uploaded, isUploaded: true };
      const normalizedName = item.name.toLowerCase();
      if (normalizedName.includes("抬头") || normalizedName.includes("tummy") || normalizedName.includes("注视")) return { src: abilityArtwork[0], isUploaded: false };
      if (normalizedName.includes("roll") || normalizedName.includes("翻") || normalizedName.includes("四肢")) return { src: abilityArtwork[1], isUploaded: false };
      if (normalizedName.includes("sit") || normalizedName.includes("坐") || normalizedName.includes("crawl") || normalizedName.includes("walk") || normalizedName.includes("爬") || normalizedName.includes("走")) return { src: abilityArtwork[2], isUploaded: false };
      return { src: abilityArtwork[stableArtworkIndex(item.id, abilityArtwork.length)], isUploaded: false };
    };
    const checkupImage = (item: Checkup) => {
      if (item.name.includes("新生儿")) return "/assets/baby/health-checkup-newborn-v2.png";
      if (item.name.includes("满月") || item.name.includes("1月龄")) return "/assets/baby/health-checkup-one-month-v2.png";
      if (item.name.includes("4月龄")) return "/assets/baby/health-checkup-four-month-v2.png";
      return "/assets/baby/icon-age.png";
    };
    const vaccineArtwork = (item: Vaccine) => {
      const name = item.name.toLowerCase();
      if (name.includes("轮状")) {
        return "/assets/baby/health-title-shield-v1.png";
      }
      if (name.includes("五联") || name.includes("百白破")) {
        return "/assets/baby/health-vaccine-five-in-one-v1.png";
      }
      if (name.includes("脊灰") || name.includes("麻腮风") || name.includes("肺炎") || name.includes("流脑") || name.includes("水痘")) {
        return "/assets/baby/health-vaccine-mmr-v1.png";
      }
      return "/assets/baby/health-vaccine-hepb-v1.png";
    };
    return (
      <main className="health-dynamic-content" aria-label="健康记录" data-testid="health-page">
        {healthTab === "vaccine" ? <section id="health-panel-vaccine" className="vaccine-schedule-panel" role="tabpanel" aria-labelledby="health-tab-vaccine" data-testid="health-vaccine-panel">
          <header className="vaccine-schedule-intro">
            <div className="vaccine-intro-copy">
              <h2>疫苗接种</h2>
              <span>宝宝疫苗接种指南</span>
              <p>
                <span>已记录 <strong>{completedVaccineCount}</strong> 条接种记录</span>
              </p>
            </div>
            <span className="vaccine-intro-art" aria-hidden="true"><img src="/assets/baby/health-vaccine-hero-reference-v2.png" alt="" /></span>
            <button className="vaccine-add-button app-add-button" type="button" onClick={(event) => { lastPageActionRef.current = event.currentTarget; openEditor("vaccine"); }} aria-label="新增其他疫苗记录" data-scroll-drag="ignore"><PlusIcon /> Add</button>
          </header>

          <div className="vaccine-age-list">
            {vaccineGroups.map(([ageLabel, items], groupIndex) => {
              const groupCompleted = items.filter((item) => item.completedDate).length;
              const ageClass = ageLabel === "24小时内"
                ? "age-birth"
                : ageLabel === "1月龄"
                  ? "age-one-month"
                  : ageLabel === "2月龄"
                    ? "age-two-months"
                    : `age-tone-${groupIndex % 3}`;
              const ageIcon = ageLabel === "24小时内"
                ? <img src="/assets/baby/memory-ref-sprig-transparent-v1.png" alt="" aria-hidden="true" />
                : ageLabel === "2月龄"
                  ? <img src="/assets/baby/icon-sleep.png" alt="" aria-hidden="true" />
                  : <img src="/assets/baby/memory-ref-star-transparent-v1.png" alt="" aria-hidden="true" />;
              return <section className={`vaccine-age-card ${ageClass}`} key={ageLabel} aria-labelledby={`vaccine-age-${groupIndex}`}>
                <header className="vaccine-age-heading">
                  <span className="vaccine-age-label" id={`vaccine-age-${groupIndex}`}>{ageIcon}{ageLabel}</span>
                  <span>{groupCompleted} 条已记录</span>
                </header>
                <div className="vaccine-dose-list">
                  {items.map((item) => {
                    const completed = Boolean(item.completedDate);
                    const sameChoiceFamily = item.choiceGroup
                      ? [...selectedVaccineChoiceGroups].find((choice) => vaccineChoiceFamily(choice) === vaccineChoiceFamily(item.choiceGroup))
                      : undefined;
                    const alternative = Boolean(sameChoiceFamily && sameChoiceFamily !== item.choiceGroup);
                    return <article className={`vaccine-dose-row${completed ? " is-completed" : ""}${alternative ? " is-alternative" : ""}`} key={item.id}>
                      <span className="vaccine-dose-art" aria-hidden="true"><img src={vaccineArtwork(item)} alt="" /></span>
                      <div className="vaccine-dose-copy">
                        <div className="vaccine-dose-title"><strong>{item.name}</strong><em>{item.dose}</em></div>
                        {item.choiceGroup ? <span className="vaccine-choice-badge">{alternative ? "备选" : selectedVaccineChoiceGroups.has(item.choiceGroup) ? "已选" : "方案"}：{item.choiceGroup}</span> : null}
                        {alternative ? <span className="vaccine-alternative-note">已选择同类替代方案</span> : null}
                      </div>
                      <div className="vaccine-dose-status">
                        <button
                          className="vaccine-check-button"
                          type="button"
                          onClick={() => toggleVaccineCompletion(item.id)}
                          aria-label={`${completed ? "取消已接种" : "标记为已接种"}：${item.name} ${item.dose}`}
                          aria-pressed={completed}
                          data-scroll-drag="ignore"
                        >{completed ? <CheckIcon /> : <span />}</button>
                        <strong>{completed ? "实际接种" : "计划接种"}</strong>
                        {completed ? <label className="vaccine-completed-date">
                          <span className="visually-hidden">接种时间</span>
                          {nativeInputs ? <input
                            type="date"
                            min={FIXED_BIRTH_DATE}
                            max={today()}
                            value={item.completedDate ?? ""}
                            onChange={(event) => setVaccineCompletedDate(item.id, event.target.value)}
                            onFocus={handleNativeInputFocus}
                            aria-label={`${item.name} ${item.dose} 的实际接种日期`}
                            data-native-input="true"
                            data-scroll-drag="ignore"
                          /> : <KeyboardInput
                            type="date"
                            min={FIXED_BIRTH_DATE}
                            max={today()}
                            value={item.completedDate ?? ""}
                            onChange={(event) => setVaccineCompletedDate(item.id, event.target.value)}
                            aria-label={`${item.name} ${item.dose} 的实际接种日期`}
                            data-scroll-drag="ignore"
                          />}
                        </label> : <time className="vaccine-planned-date" dateTime={item.dueDate}>{healthDisplayDate(item.dueDate)}</time>}
                        {!item.scheduleKey ? <button className="vaccine-edit-button" type="button" onClick={() => openEditor("vaccine", item as unknown as Record<string, unknown>)} aria-label={`编辑 ${item.name} ${item.dose}`} data-scroll-drag="ignore"><Pencil1Icon /></button> : null}
                      </div>
                    </article>;
                  })}
                </div>
              </section>;
            })}
          </div>

          <aside className="vaccine-medical-note" aria-label="接种说明">
            <img src="/assets/baby/health-title-shield-cluster-v1.png" alt="" aria-hidden="true" />
            <p><strong>温馨提示</strong> 接种时间、联合方案与禁忌请以当地接种门诊及疫苗说明书为准；本页不记录价格。</p>
          </aside>
        </section> : null}

        {healthTab === "ability" ? <section id="health-panel-ability" className="health-secondary-panel health-development-panel" role="tabpanel" aria-labelledby="health-tab-ability" data-testid="health-development-panel">
          <header className="health-secondary-intro health-secondary-intro-development">
            <div className="health-secondary-intro-copy">
              <h2>发育里程碑</h2>
              <p>每一次小小进步，都值得珍藏</p>
              <span>已记录 <strong>{sortedAbilities.length}</strong> 个里程碑</span>
            </div>
            <span className="health-secondary-intro-art health-development-intro-art" aria-hidden="true">
              <img className="health-secondary-intro-bear" src="/assets/baby/health-development-hero-bear-reference-v3.png" alt="" />
              <img className="health-development-intro-baby" src="/assets/baby/health-development-hero-baby-reference-v3.png" alt="" />
            </span>
            <button className="app-add-button" type="button" onClick={(event) => { lastPageActionRef.current = event.currentTarget; openEditor("ability"); }} aria-label="新增发育里程碑" data-scroll-drag="ignore"><PlusIcon /> Add</button>
          </header>
          <div className="health-secondary-list health-development-list" aria-label="发育里程碑记录">
            {sortedAbilities.map((item) => {
              const synced = data.memories.some((memory) => memory.sourceAbilityId === item.id);
              const artwork = abilityImage(item);
              return <button className="health-secondary-record health-development-record" type="button" key={item.id} onClick={() => openEditor("ability", item as unknown as Record<string, unknown>)} aria-label={`编辑发育里程碑 ${healthDisplayDate(item.date)} ${item.name}，${item.description || "暂无说明"}`}>
                <span className={`health-secondary-record-art${artwork.isUploaded ? " is-uploaded" : ""}`}><img src={artwork.src} alt={`${item.name}示意图`} /></span>
                <span className="health-secondary-record-copy">
                  <time dateTime={item.date}>{healthDisplayDate(item.date)}</time>
                  <strong>{item.name}</strong>
                  <p>{item.description || "记录宝宝当时的小动作。"}</p>
                  {synced ? <em><CheckIcon aria-hidden="true" />已同步到成长回忆</em> : null}
                </span>
                <span className="health-secondary-chevron" aria-hidden="true"><ChevronRightIcon /></span>
              </button>;
            })}
            {!sortedAbilities.length ? <EmptyState text="还没有发育记录，点 + Add 记录第一个小小里程碑。" /> : null}
          </div>
          <aside className="health-secondary-encouragement" aria-label="发育记录寄语"><HeartFilledIcon aria-hidden="true" /><span>慢慢长大，每一步都有自己的节奏。</span></aside>
        </section> : null}

        {healthTab === "checkup" ? <section id="health-panel-checkup" className="health-secondary-panel health-checkup-panel" role="tabpanel" aria-labelledby="health-tab-checkup" data-testid="health-checkup-panel">
          <header className="health-secondary-intro health-secondary-intro-checkup">
            <div className="health-secondary-intro-copy">
              <h2>儿保记录</h2>
              <p>把每次检查与建议，温柔收好</p>
              <span>已保存 <strong>{sortedCheckups.length}</strong> 次儿保记录</span>
            </div>
            <span className="health-secondary-intro-art health-checkup-intro-art" aria-hidden="true">
              <img className="health-secondary-intro-bear" src="/assets/baby/health-checkup-hero-bear-reference-v2.png" alt="" />
              <img className="health-secondary-intro-symbol" src="/assets/baby/health-checkup-hero-stethoscope-reference-v2.png" alt="" />
            </span>
            <button className="app-add-button" type="button" onClick={(event) => { lastPageActionRef.current = event.currentTarget; openEditor("checkup"); }} aria-label="新增儿保记录" data-scroll-drag="ignore"><PlusIcon /> Add</button>
          </header>
          <div className="health-secondary-list checkup-record-list" aria-label="儿保记录">
            {sortedCheckups.map((item) => {
              const completed = Boolean(item.completedDate);
              return <button className="health-secondary-record health-checkup-record" type="button" key={item.id} onClick={() => openEditor("checkup", item as unknown as Record<string, unknown>)} aria-label={`编辑儿保记录 ${healthDisplayDate(item.date)} ${item.name}，${completed ? "已记录" : "计划日期"}，建议：${item.tips}`}>
                <span className="health-secondary-record-art health-secondary-calendar"><img src={checkupImage(item)} alt={`${item.name}示意图`} /></span>
                <span className="health-secondary-record-copy">
                  <time dateTime={item.date}>{healthDisplayDate(item.date)}</time>
                  <strong>{item.name}</strong>
                  <em className={`health-checkup-status${completed ? " is-recorded" : " is-planned"}`}>{completed ? <CheckIcon aria-hidden="true" /> : <span aria-hidden="true" />}{completed ? "已记录" : "计划日期"}</em>
                  <p className="health-checkup-tips"><b>Tips：</b>{item.tips}</p>
                </span>
                <span className="health-secondary-chevron" aria-hidden="true"><ChevronRightIcon /></span>
              </button>;
            })}
            {!sortedCheckups.length ? <EmptyState text="还没有儿保记录，点 + Add 保存第一次儿保建议。" /> : null}
          </div>
          <aside className="health-secondary-encouragement" aria-label="儿保记录寄语"><HeartFilledIcon aria-hidden="true" /><span>把医生的建议带回家，也把成长的安心留下来。</span></aside>
        </section> : null}
      </main>
    );
  };

  const renderEducation = () => {
    const musicArtwork = [
      "/assets/baby/education-lullaby-cover-v1.png",
      "/assets/baby/education-white-noise-cover-v1.png",
      "/assets/baby/education-nursery-cover-v1.png",
    ];
    const storyArtwork = [
      "/assets/baby/education-caterpillar-cover-v1.png",
      "/assets/baby/education-goodnight-cover-v1.png",
    ];
    const storyCard = (story: Story, index: number, compact = false) => (
      <article className={`education-story-card ${compact ? "compact" : ""}`} key={story.id}>
        <button className="education-story-cover" type="button" onClick={() => openStory(story)} aria-label={`Open ${story.name}`}>
          <img src={story.coverId ? assetUrls[story.coverId] : storyArtwork[index % storyArtwork.length]} alt={`${story.name} cover`} />
        </button>
        <div className="education-story-caption">
          <button type="button" onClick={() => openStory(story)} aria-label={`Read ${story.name} in a new window`} data-scroll-drag="ignore">
            <strong>{story.name}</strong><ExternalLinkIcon aria-hidden="true" />
          </button>
          <button className="education-story-edit" type="button" onClick={() => openEditor("story", story as unknown as Record<string, unknown>)} aria-label={`Edit ${story.name}`} data-scroll-drag="ignore"><Pencil1Icon /></button>
        </div>
      </article>
    );
    return (
      <main className="screen-content journal-page education-page" aria-label="Early Education">
        <header className="journal-topbar education-topbar">
          <button className="education-back" type="button" onClick={goHome} aria-label="Back to Home" data-scroll-drag="ignore"><ArrowLeftIcon /></button>
          <h1>Early Education</h1>
          <div className="education-top-actions">
            <button className="education-notification" type="button" onClick={() => setOverlay({ type: "notifications" })} aria-label="Open notifications" data-scroll-drag="ignore"><BellIcon /></button>
            <button type="button" onClick={() => setOverlay({ type: "report" })} aria-label="Share baby's report" data-scroll-drag="ignore"><ExternalLinkIcon /></button>
          </div>
        </header>

        <SegmentedTabs
          className="education-tabs"
          values={([{ value: "music", label: "Music" }, { value: "story", label: "Stories" }] as { value: EducationTab; label: string }[])}
          active={educationTab}
          onChange={(value) => { keyboard.hide(); setEducationTab(value); }}
          label="Early education library"
          idPrefix="education"
          panelId={(value) => `education-panel-${value}`}
        />

        {educationTab === "music" ? (
          <div id="education-panel-music" className="education-music-view" role="tabpanel" aria-labelledby="education-tab-music" data-testid="education-music-panel">
            <section className="education-music-card">
              <header className="education-library-heading">
                <div className="education-title-swatch"><SpeakerLoudIcon aria-hidden="true" /><h2>Music Library</h2></div>
                <button className="education-add" type="button" onClick={() => openEditor("music")} aria-label="Add music" data-scroll-drag="ignore"><PlusIcon /><span>Add</span></button>
                <span className="education-headphone-crop" aria-hidden="true"><img src="/assets/baby/education-headphone-bear-v1.png" alt="" /></span>
              </header>
              <div className="education-track-list">
                {data.musicTracks.map((item, index) => {
                  const isPlaying = playingId === item.id;
                  const duration = isPlaying && playback.duration ? playback.duration : item.durationSeconds ?? 0;
                  const current = isPlaying ? playback.current : 0;
                  const showProgress = isPlaying || (index === 0 && !playingId);
                  return <article className={`education-track tone-${index % 3} ${isPlaying ? "is-playing" : ""}`} key={item.id}>
                    <button className="education-track-art" type="button" onClick={() => openEditor("music", item as unknown as Record<string, unknown>)} aria-label={`Edit ${item.name}`} data-scroll-drag="ignore"><img src={musicArtwork[index % musicArtwork.length]} alt="" /></button>
                    <div className="education-track-copy">
                      <button className="education-track-title" type="button" onClick={() => openEditor("music", item as unknown as Record<string, unknown>)} aria-label={`Edit ${item.name}`} data-scroll-drag="ignore"><h3>{item.name}</h3><Pencil1Icon aria-hidden="true" /></button>
                      <div className="education-track-meta"><span>{trackDurationLabel(duration)}</span><em>{item.assetId ? "Ready to play" : "Upload audio"}</em></div>
                      {showProgress ? <label className="education-progress"><span className="visually-hidden">Playback position for {item.name}</span><input type="range" min="0" max={Math.max(duration, 1)} step="0.1" value={Math.min(current, Math.max(duration, 1))} onChange={(event) => seekTrack(item.id, Number(event.target.value))} disabled={!isPlaying} data-scroll-drag="ignore" /></label> : <p>{item.description || item.artist}</p>}
                    </div>
                    <button className="education-play" type="button" onClick={() => void playTrack(item)} aria-label={isPlaying ? `Pause ${item.name}` : `Play ${item.name}`} aria-pressed={isPlaying} data-scroll-drag="ignore">{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
                  </article>;
                })}
                {!data.musicTracks.length ? <div className="education-empty"><p>Your family playlist starts here.</p><button type="button" onClick={() => openEditor("music")} data-scroll-drag="ignore"><PlusIcon /> Add the first song</button></div> : null}
              </div>
            </section>

            <section className="education-story-shelf" aria-labelledby="story-shelf-title">
              <header><div className="education-story-label"><ReaderIcon aria-hidden="true" /><h2 id="story-shelf-title">Story Shelf</h2></div><button type="button" onClick={() => setEducationTab("story")} data-scroll-drag="ignore">View all <ChevronRightIcon /></button></header>
              <div className="education-story-grid">{data.stories.slice(0, 2).map((story, index) => storyCard(story, index, true))}</div>
              {!data.stories.length ? <button className="education-add-story" type="button" onClick={() => openEditor("story")} data-scroll-drag="ignore"><PlusIcon /> Add a story</button> : null}
            </section>

            <div className="education-footer-art" aria-hidden="true"><img src="/assets/baby/education-footer-v1.png" alt="" /></div>
          </div>
        ) : (
          <section id="education-panel-story" className="education-story-library" role="tabpanel" aria-labelledby="education-tab-story" data-testid="education-story-panel">
            <header className="education-story-library-heading"><div><span>Little books, big dreams</span><h2>Story Shelf</h2></div><button className="education-add" type="button" onClick={() => openEditor("story")} aria-label="Add story" data-scroll-drag="ignore"><PlusIcon /><span>Add</span></button></header>
            <div className="education-story-grid full">{data.stories.map((story, index) => storyCard(story, index))}</div>
            {!data.stories.length ? <div className="education-empty"><p>Build a tiny bookshelf for bedtime.</p><button type="button" onClick={() => openEditor("story")} data-scroll-drag="ignore"><PlusIcon /> Add the first story</button></div> : null}
            <div className="education-footer-art story-footer" aria-hidden="true"><img src="/assets/baby/education-footer-v1.png" alt="" /></div>
          </section>
        )}
      </main>
    );
  };

  const renderStudy = () => {
    const items = data.learningItems.filter((item) => item.kind === studyTab);
    const pageCount = Math.max(1, Math.ceil(items.length / 15));
    const visiblePage = Math.min(studyPageIndex, pageCount - 1);
    const visibleItems = items.slice(visiblePage * 15, visiblePage * 15 + 15);
    const changeStudyTab = (nextTab: StudyTab) => {
      setStudyTab(nextTab);
      setStudyPageIndex(0);
    };
    return (
      <main className="screen-content journal-page study-page" aria-label="Study Record" data-testid="study-page">
        <header className="journal-topbar study-topbar">
          <button className="study-back" type="button" onClick={goHome} aria-label="Back to Home" data-scroll-drag="ignore"><ArrowLeftIcon /></button>
          <h1>Study Record</h1>
          <div className="study-topbar-actions">
            <button className="study-header-button study-notification" type="button" onClick={() => setOverlay({ type: "notifications" })} aria-label="Notifications" data-scroll-drag="ignore"><BellIcon /><span aria-hidden="true" /></button>
            <button className="study-header-button" type="button" onClick={() => setOverlay({ type: "report" })} aria-label="Share baby's growth report" data-scroll-drag="ignore"><ExternalLinkIcon /></button>
          </div>
        </header>

        <SegmentedTabs
          className="study-tabs"
          values={([{ value: "english", label: "English" }, { value: "chinese", label: "Chinese" }] as { value: StudyTab; label: string }[])}
          active={studyTab}
          onChange={changeStudyTab}
          label="Study language"
          idPrefix="study"
          panelId="study-library-panel"
        />

        <section id="study-library-panel" className="study-library" role="tabpanel" aria-labelledby={`study-tab-${studyTab}`} data-testid="study-library">
          <header className="study-library-heading">
            <img className="study-heading-mark" src="/assets/baby/study-header-ab-v1.png" alt="" />
            <h2>{studyTab === "english" ? "English Words" : "中文词语"}</h2>
            <div className="study-library-tools">
              {pageCount > 1 ? <div className="study-pagination" aria-label="Card pages">
                <button type="button" disabled={visiblePage === 0} onClick={() => setStudyPageIndex((current) => Math.max(0, current - 1))} aria-label="Previous 15 cards" data-scroll-drag="ignore"><ArrowLeftIcon /></button>
                <span>{visiblePage + 1}/{pageCount}</span>
                <button type="button" disabled={visiblePage >= pageCount - 1} onClick={() => setStudyPageIndex((current) => Math.min(pageCount - 1, current + 1))} aria-label="Next 15 cards" data-scroll-drag="ignore"><ChevronRightIcon /></button>
              </div> : null}
              <button className="study-add" type="button" onClick={() => openEditor("learning")} aria-label={`Add ${studyTab === "english" ? "English" : "Chinese"} card`} data-scroll-drag="ignore"><PlusIcon /></button>
              <img className="study-heading-bear" src="/assets/baby/study-header-bear-v1.png" alt="" />
            </div>
          </header>

          <div className="study-grid" data-testid="study-card-grid">
            {visibleItems.map((item, index) => {
              const fallbackArtwork = item.artworkKey ?? "bear";
              const source = item.imageId && assetUrls[item.imageId]
                ? assetUrls[item.imageId]
                : `/assets/baby/study-${fallbackArtwork}-v1.png`;
              return <article className={`study-card study-tone-${index % 6}`} key={item.id} data-testid="study-card">
                <button className="study-card-edit" type="button" onClick={() => openEditor("learning", item as unknown as Record<string, unknown>)} aria-label={`Edit ${item.term}, ${item.translation}`}>
                  <img src={source} alt={item.translation} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/baby/study-bear-v1.png"; }} />
                  <strong lang={item.kind === "english" ? "en" : "zh-CN"}>{item.term}</strong>
                </button>
                <button className={`study-speak ${speakingId === item.id ? "speaking" : ""}`} type="button" onClick={() => speak(item)} aria-label={`Pronounce ${item.term}`} aria-pressed={speakingId === item.id} data-scroll-drag="ignore"><SpeakerLoudIcon /></button>
              </article>;
            })}
            {!visibleItems.length ? <div className="study-empty"><p>还没有学习卡片。</p><button type="button" onClick={() => openEditor("learning")} data-scroll-drag="ignore"><PlusIcon /> Add the first card</button></div> : null}
          </div>
        </section>
      </main>
    );
  };

  const rememberHomeTrigger = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    lastPageActionRef.current = event.currentTarget;
    action();
  };

  const openCurrentGrowthEditor = () => {
    if (currentGrowthRecord) {
      openEditor("growth", currentGrowthRecord as unknown as Record<string, unknown>);
      return;
    }
    openEditor("growth");
    setDraft((current) => ({
      ...current,
      date: localDateValue(new Date(homeNow)),
      height: latestHeightRecord?.height === undefined ? "" : String(latestHeightRecord.height),
      weight: latestWeightRecord?.weight === undefined ? "" : String(latestWeightRecord.weight),
    }));
  };

  const renderHomeLiveOverlay = () => {
    const weight = latestWeightRecord?.weight;
    const height = latestHeightRecord?.height;
    const vitaminDCompleted = Boolean(todayVitaminD?.completed);
    const measurement = (value: number | undefined) => value === undefined ? "—" : String(Number(value.toFixed(2)));

    return <div className="home-live-overlay" data-testid="home-live-overlay">
      <img className="home-live-name-patch" src="/assets/baby/home-name-regular-script-v2.png" alt="" aria-hidden="true" draggable={false} />
      <img className="home-live-tagline-patch" src="/assets/baby/home-tagline-growing-v2.png" alt="" aria-hidden="true" draggable={false} />
      <p className="home-live-age" lang="en">{homeEnglishAgeLabel(age)}</p>

      <button className="home-live-metric home-live-weight" type="button" onClick={(event) => rememberHomeTrigger(event, openCurrentGrowthEditor)} aria-label={`修改当前体重，现在是 ${weight ?? "未填写"} 千克`} data-scroll-drag="ignore">
        <strong>{measurement(weight)}{weight === undefined ? null : <small> kg</small>}</strong>
        <span>出生 {FIXED_BIRTH_WEIGHT} kg</span>
      </button>
      <button className="home-live-metric home-live-height" type="button" onClick={(event) => rememberHomeTrigger(event, openCurrentGrowthEditor)} aria-label={`修改当前身高，现在是 ${height ?? "未填写"} 厘米`} data-scroll-drag="ignore">
        <strong>{measurement(height)}{height === undefined ? null : <small> cm</small>}</strong>
        <span>出生 {FIXED_BIRTH_HEIGHT} cm</span>
      </button>
      <button className="home-live-metric home-live-current-age" type="button" onClick={(event) => rememberHomeTrigger(event, () => openEditor("profile"))} aria-label={`查看宝宝资料，当前 ${age.months} 个月 ${age.days} 天`} data-scroll-drag="ignore">
        <strong>{age.months}<small>个月</small></strong>
        <span>{age.days}天</span>
      </button>

      <section className="home-live-care-card home-live-card--feeding" aria-label="喂养摘要">
        <div className="home-live-care-summary">
          <span>上次喂奶</span>
          <strong>{lastFeed ? homeRelativeTime(lastFeed.time, homeNow) : "暂无记录"}</strong>
        </div>
        <div className="home-live-feeding-details">
          <span><b>时间：</b><strong>{lastFeed ? displayTime(lastFeed.time) : "--:--"}</strong></span>
          <span><b>奶量：</b><strong>{lastFeed ? `${lastFeed.amount} ml` : "未记录"}</strong></span>
          <span><b>类型：</b><strong>{lastFeed ? homeMilkLabel(lastFeed.milkType) : "未记录"}</strong></span>
        </div>
      </section>

      <section className="home-live-care-card home-live-card--sleep" aria-label="睡眠摘要">
        <div className="home-live-care-summary">
          <span>最近睡眠</span>
          <strong>{lastSleep ? `${displayTime(lastSleep.start)}–${displayTime(lastSleep.end)}` : "暂无记录"}</strong>
        </div>
        <div className="home-live-sleep-total">
          <span>今日总时长</span>
          <strong>{homeMinutesLabel(todaySleepMinutes)}</strong>
        </div>
      </section>

      <section className="home-live-care-card home-live-card--poop" aria-label="便便摘要">
        <div className="home-live-care-summary home-live-care-summary--inline">
          <span>最新记录</span>
          <strong>{lastPoop ? displayTime(lastPoop.time) : "--:--"}</strong>
        </div>
        <div className="home-live-care-action-row">
          <p><span>今日</span><strong>{todayPoopCount}次</strong></p>
          <button className={`home-live-check${poopCheckPulse ? " is-checked" : ""}`} type="button" onClick={(event) => rememberHomeTrigger(event, quickLogPoop)} aria-label={`记录现在便便，今日已记录 ${todayPoopCount} 次`} data-scroll-drag="ignore">
            <span aria-hidden="true">{poopCheckPulse ? <CheckIcon /> : null}</span>
            <b>记录</b>
          </button>
        </div>
      </section>

      <section className="home-live-care-card home-live-card--health" aria-label="健康摘要">
        <div className="home-live-care-summary">
          <span>Vitamin D</span>
        </div>
        <div className="home-live-care-action-row home-live-care-action-row--health">
          <p><strong>{vitaminDCompleted ? "今天已服用" : "今天未服用"}</strong></p>
          <button className={`home-live-check${vitaminDCompleted ? " is-checked" : ""}`} type="button" onClick={(event) => rememberHomeTrigger(event, quickToggleVitaminD)} aria-label={`${vitaminDCompleted ? "取消" : "确认"}今天服用维生素 D`} aria-pressed={vitaminDCompleted} data-scroll-drag="ignore">
            <span aria-hidden="true">{vitaminDCompleted ? <CheckIcon /> : null}</span>
            <b>确认</b>
          </button>
        </div>
      </section>

      <div className="home-live-todos" aria-label="Today's To-do">
        {visibleHomeTodos.map((item, index) => <div className="home-live-todo-row" key={item.id} style={{ top: `${82.75 + index * 3.48}%` }}>
          <button className={`home-live-todo-check${item.completed ? " is-checked" : ""}`} type="button" onClick={(event) => rememberHomeTrigger(event, () => toggleTodo(item.id))} aria-label={`${item.completed ? "取消完成" : "完成"} ${homeTodoLabel(item.title)}`} aria-pressed={item.completed} data-scroll-drag="ignore">{item.completed ? <CheckIcon /> : null}</button>
          <button className={`home-live-todo-title${item.completed ? " is-complete" : ""}`} type="button" onClick={(event) => rememberHomeTrigger(event, () => openEditor("todo", item as unknown as Record<string, unknown>))} aria-label={`修改待办 ${homeTodoLabel(item.title)}`} data-scroll-drag="ignore">{homeTodoLabel(item.title)}</button>
        </div>)}
      </div>
    </div>;
  };

  const imageHotspots = (): ImageHotspot[] => {
    const hotspot = (
      id: string,
      label: string,
      left: number,
      top: number,
      width: number,
      height: number,
      onClick: () => void,
      options: Pick<ImageHotspot, "pressed" | "stateMark" | "layer"> = {},
    ): ImageHotspot => ({ id, label, left, top, width, height, onClick, ...options });
    const notifications = () => setOverlay({ type: "notifications" });
    const report = () => setOverlay({ type: "report" });
    const missingRecord = (message: string, fallback: () => void) => {
      notify(message);
      fallback();
    };

    if (page === "home") {
      return [
        hotspot("home-notifications", "查看通知", 74.7, 1.7, 11.8, 6, notifications),
        hotspot("home-report", "生成并分享宝宝报告", 86.5, 1.7, 11.8, 6, report),
        hotspot("home-profile", "修改宝宝资料与照片", 5.5, 9.3, 43, 21.6, () => openEditor("profile")),
        hotspot("home-feeding", "查看喂养记录", 4, 42.5, 45.4, 19.8, () => setOverlay({ type: "list", list: "feeding" })),
        hotspot("home-sleep", "查看睡眠记录", 50.4, 42.5, 45.8, 19.8, () => setOverlay({ type: "list", list: "sleep" })),
        hotspot("home-poop", "查看便便记录", 4, 63.2, 45.4, 13.2, () => setOverlay({ type: "list", list: "diaper" })),
        hotspot("home-health", "查看补剂记录", 50.4, 63.2, 45.8, 13.2, () => setOverlay({ type: "list", list: "supplement" })),
        hotspot("home-add-todo", "管理今日待办", 76.9, 78.5, 16.5, 3.5, openTodoLibrary),
      ];
    }

    if (page === "memory") {
      const photo = data.memories.find((item) => item.type === "photo" && /午睡前的温暖抱抱|Morning cuddle before nap time/i.test(item.title));
      const smile = data.memories.find((item) => /第一次微笑|first smile/i.test(item.title));
      const rollover = data.memories.find((item) => Boolean(item.sourceAbilityId) || /第一次翻身|rollover|rolling over/i.test(item.title));
      const note = data.memories.find((item) => item.type === "note" && /今日随记|today'?s note/i.test(item.title));
      const openDetail = (item: Memory | undefined, filter: "all" | MemoryType) => item
        ? setOverlay({ type: "memory-detail", id: item.id })
        : missingRecord("这条示例记忆已不存在，已打开当前记录", () => openMemoryLibrary(filter));
      return [
        hotspot("memory-add", "新增回忆", 76.8, 1.8, 19.8, 6, () => openNewMemory("moment")),
        hotspot("memory-all", "查看全部记忆", 4, 11, 24.2, 4.9, () => openMemoryLibrary("all")),
        hotspot("memory-moments", "查看瞬间", 28.2, 11, 22.7, 4.9, () => openMemoryLibrary("moment")),
        hotspot("memory-photos", "查看照片", 50.9, 11, 22.6, 4.9, () => openMemoryLibrary("photo")),
        hotspot("memory-notes", "查看随记", 73.5, 11, 22.6, 4.9, () => openMemoryLibrary("note")),
        hotspot("memory-photo-card", "打开照片记忆", 4, 17.3, 92.2, 34.9, () => openDetail(photo, "photo")),
        hotspot("memory-smile-card", "打开第一次微笑", 4, 58, 44.9, 16.5, () => openDetail(smile, "moment")),
        hotspot("memory-rollover-card", "打开第一次翻身", 50.2, 58, 46, 16.5, () => openDetail(rollover, "moment")),
        hotspot("memory-note-card", "打开今日随记", 4, 75.5, 92.2, 15.2, () => openDetail(note, "note")),
      ];
    }

    if (page === "growth") {
      const rowPositions = [
        { top: 77.1, height: 4.4 },
        { top: 81.7, height: 4.4 },
        { top: 86.3, height: 4.7 },
      ];
      return [
        hotspot("growth-notifications", "查看通知", 74.4, 1.4, 12.3, 6, notifications),
        hotspot("growth-report", "生成并分享宝宝报告", 86.8, 1.4, 11.7, 6, report),
        hotspot("growth-profile", "修改宝宝资料与照片", 4.1, 9.5, 35.2, 18.7, () => openEditor("profile")),
        hotspot("growth-add", "管理成长记录", 65.1, 72.1, 29.3, 4.9, openGrowthLibrary),
        ...rowPositions.map(({ top, height }, index) => hotspot(`growth-edit-${index + 1}`, `管理全部成长记录（第 ${index + 1} 行）`, 85, top, 11.7, height, openGrowthLibrary)),
      ];
    }

    if (page === "health") {
      const vaccineByName = (name: string) => data.vaccines.find((item) => item.name === name);
      const abilityByName = (name: string) => data.abilities.find((item) => item.name === name);
      const checkupByName = (name: string) => data.checkups.find((item) => item.name === name);
      const editHealth = <T,>(item: T | undefined, kind: HealthTab) => {
        if (item) openEditor(kind, item as unknown as Record<string, unknown>);
        else missingRecord("这条示例记录已不存在，已打开当前记录", () => openHealthLibrary(kind));
      };
      return [
        hotspot("health-notifications", "查看通知", 74.4, 1.1, 12.3, 6, notifications),
        hotspot("health-report", "生成并分享宝宝报告", 86.8, 1.4, 11.7, 5.7, report),
        hotspot("health-vaccines-tab", "管理疫苗记录", 3.5, 7.6, 32.2, 5.2, () => openHealthLibrary("vaccine")),
        hotspot("health-development-tab", "管理能力里程碑", 35.2, 7.6, 32.2, 5.2, () => openHealthLibrary("ability")),
        hotspot("health-checkups-tab", "管理儿保记录", 66.8, 7.6, 29.9, 5.2, () => openHealthLibrary("checkup")),
        hotspot("health-add-vaccine", "新增疫苗记录", 75.6, 13.6, 15.2, 5.8, () => openEditor("vaccine")),
        hotspot("health-vaccine-five-in-one", "编辑五联疫苗", 5.3, 19.5, 89.7, 12.8, () => editHealth(vaccineByName("五联疫苗"), "vaccine")),
        hotspot("health-vaccine-hepatitis", "编辑乙肝疫苗", 5.3, 32.3, 89.7, 11.4, () => editHealth(vaccineByName("乙肝疫苗"), "vaccine")),
        hotspot("health-vaccine-mmr", "编辑麻腮风疫苗", 5.3, 43.8, 89.7, 13.3, () => editHealth(vaccineByName("麻腮风疫苗"), "vaccine")),
        hotspot("health-development-view-all", "查看全部能力里程碑", 75.6, 58.7, 19.3, 3.5, () => openHealthLibrary("ability"), { layer: "foreground" }),
        hotspot("health-ability-rollover", "编辑自主翻身", 5.3, 62.4, 27.5, 12.2, () => editHealth(abilityByName("自主翻身"), "ability")),
        hotspot("health-ability-sitting", "编辑独坐稳定", 32.8, 62.4, 28.7, 12.2, () => editHealth(abilityByName("独坐稳定"), "ability")),
        hotspot("health-ability-crawling", "编辑爬行", 61.5, 62.4, 33.4, 12.2, () => editHealth(abilityByName("爬行"), "ability")),
        hotspot("health-checkups-view-all", "查看全部儿保记录", 75.6, 75.5, 19.3, 3.5, () => openHealthLibrary("checkup"), { layer: "foreground" }),
        hotspot("health-checkup-four-month", "编辑4月龄儿保", 5.3, 79.2, 43.4, 11.4, () => editHealth(checkupByName("4月龄儿保"), "checkup")),
        hotspot("health-checkup-six-month", "编辑6月龄儿保", 48.7, 79.2, 46.3, 11.4, () => editHealth(checkupByName("6月龄儿保"), "checkup")),
      ];
    }

    if (page === "education") {
      const trackByName = (name: string) => data.musicTracks.find((item) => item.name === name);
      const storyByName = (name: string) => data.stories.find((item) => item.name === name);
      const playNamedTrack = (name: string) => {
        const item = trackByName(name);
        if (item) void playTrack(item);
        else missingRecord("这首示例音乐已不存在，已打开音乐库", () => openEducationLibrary("music"));
      };
      const openNamedStory = (name: string) => {
        const item = storyByName(name);
        if (item) openStory(item);
        else missingRecord("这个示例故事已不存在，已打开故事库", () => openEducationLibrary("story"));
      };
      const lullaby = trackByName("摇篮曲");
      const whiteNoise = trackByName("白噪音");
      const nursery = trackByName("英文童谣");
      return [
        hotspot("education-notifications", "查看通知", 74.5, 1.4, 11.5, 5.9, notifications),
        hotspot("education-report", "生成并分享宝宝报告", 88, 1.5, 9.5, 5.8, report),
        hotspot("education-music-tab", "管理音乐", 3.5, 8.3, 47, 5.1, () => openEducationLibrary("music")),
        hotspot("education-stories-tab", "管理故事", 50.5, 8.3, 46, 5.1, () => openEducationLibrary("story")),
        hotspot("education-add-music", "新增音乐", 58.2, 17, 16.8, 4.6, () => openEditor("music")),
        hotspot("education-play-lullaby", `${playingId === lullaby?.id ? "暂停" : pausedId === lullaby?.id ? "继续播放" : "播放"}摇篮曲`, 78, 26.5, 12.7, 5.9, () => playNamedTrack("摇篮曲"), { pressed: playingId === lullaby?.id, layer: "foreground" }),
        hotspot("education-play-white-noise", `${playingId === whiteNoise?.id ? "暂停" : pausedId === whiteNoise?.id ? "继续播放" : "播放"}白噪音`, 78, 39.7, 12.7, 5.9, () => playNamedTrack("白噪音"), { pressed: playingId === whiteNoise?.id, layer: "foreground" }),
        hotspot("education-play-nursery", `${playingId === nursery?.id ? "暂停" : pausedId === nursery?.id ? "继续播放" : "播放"}英文童谣`, 78, 52.9, 12.7, 5.9, () => playNamedTrack("英文童谣"), { pressed: playingId === nursery?.id, layer: "foreground" }),
        hotspot("education-stories-view-all", "查看全部故事", 74.5, 64.9, 18, 4.4, () => openEducationLibrary("story"), { layer: "foreground" }),
        hotspot("education-story-caterpillar", "打开好饿的毛毛虫", 6.3, 69.5, 43.2, 19, () => openNamedStory("好饿的毛毛虫")),
        hotspot("education-story-goodnight", "打开晚安，月亮", 50.6, 69.5, 43.2, 19, () => openNamedStory("晚安，月亮")),
      ];
    }

    const englishItems = data.learningItems.filter((item) => item.kind === "english");
    const visibleStudyItems = ["apple", "dog", "moon", "ball", "cat", "sun"].map((key) => {
      const exact = englishItems.filter((item) => item.term.toLowerCase() === key && item.artworkKey === key);
      if (exact.length === 1) return exact[0];
      const artworkMatches = englishItems.filter((item) => item.artworkKey === key);
      return artworkMatches.length === 1 ? artworkMatches[0] : undefined;
    });
    const cardPositions = [
      { left: 6, top: 24, width: 42, height: 17.5, speakerLeft: 21.4, speakerTop: 41.5 },
      { left: 52, top: 24, width: 42, height: 17.5, speakerLeft: 67.4, speakerTop: 41.5 },
      { left: 6, top: 48.8, width: 42, height: 15.3, speakerLeft: 21.4, speakerTop: 64.1 },
      { left: 52, top: 48.8, width: 42, height: 15.3, speakerLeft: 67.4, speakerTop: 64.1 },
      { left: 6, top: 71.9, width: 42, height: 14.6, speakerLeft: 21.4, speakerTop: 86.2 },
      { left: 52, top: 71.9, width: 42, height: 14.6, speakerLeft: 67.4, speakerTop: 86.2 },
    ];
    return [
      hotspot("study-notifications", "查看通知", 74.5, 1.5, 11.5, 5.8, notifications),
      hotspot("study-report", "生成并分享宝宝报告", 88.2, 1.5, 9.2, 5.8, report),
      hotspot("study-english-tab", "管理 English 学习卡", 4.5, 9.2, 46, 5, () => openStudyLibrary("english")),
      hotspot("study-chinese-tab", "管理中文学习卡", 50, 9.2, 45.5, 5, () => openStudyLibrary("chinese")),
      hotspot("study-add", "新增学习卡", 60.8, 16.4, 15.2, 4.5, () => openNewLearning("english")),
      ...cardPositions.flatMap((position, index) => {
        const item = visibleStudyItems[index];
        const fallback = () => missingRecord("这张示例学习卡已不存在，已打开学习卡库", () => openStudyLibrary("english"));
        return [
          hotspot(`study-card-${index + 1}`, item ? `编辑 ${item.term}` : `管理第 ${index + 1} 张学习卡`, position.left, position.top, position.width, position.height, () => item ? openEditor("learning", item as unknown as Record<string, unknown>) : fallback()),
          hotspot(`study-speak-${index + 1}`, item ? `发音 ${item.term}` : `管理第 ${index + 1} 张学习卡`, position.speakerLeft, position.speakerTop, 11.7, 5.3, () => item ? speak(item) : fallback(), { pressed: Boolean(item && speakingId === item.id), layer: "foreground" }),
        ];
      }),
    ];
  };

  const navigatePage = (nextPage: Page, restoreKeyboardFocus = false) => {
    keyboard.hide();
    setPage(nextPage);
    if (restoreKeyboardFocus) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-testid="final-nav-${nextPage}"]`)?.focus({ preventScroll: true });
      });
    }
  };

  const renderPage = () => {
    const homeSummary = page === "home"
      ? `${homeDateHeading(homeNow)}，硕之出生 ${homeEnglishAgeLabel(age)}。当前体重 ${latestWeightRecord?.weight ?? "未填写"} kg，身高 ${latestHeightRecord?.height ?? "未填写"} cm，出生体重 ${FIXED_BIRTH_WEIGHT} kg，出生身高 ${FIXED_BIRTH_HEIGHT} cm。今日睡眠 ${homeMinutesLabel(todaySleepMinutes)}，便便 ${todayPoopCount} 次，维生素 D ${todayVitaminD?.completed ? "已服用" : "未服用"}。`
      : undefined;
    const openHeaderNotifications = (trigger: HTMLButtonElement) => {
      lastPageActionRef.current = trigger;
      setOverlay({ type: "notifications" });
    };
    const openHeaderReport = (trigger: HTMLButtonElement) => {
      lastPageActionRef.current = trigger;
      setOverlay({ type: "report" });
    };
    if (page === "growth") {
      return <div className="growth-dynamic-shell">
        <UnifiedTopNavigation
          page="growth"
          onBack={() => navigatePage("home")}
          onNotifications={openHeaderNotifications}
          onReport={openHeaderReport}
          variant="dynamic"
        />
        <MobileScroll className="growth-dynamic-scroll">{renderGrowth()}</MobileScroll>
        <UnifiedBottomNavigation activePage="growth" onNavigate={navigatePage} variant="dynamic" />
      </div>;
    }
    if (page === "health") {
      const healthTabs: { value: HealthTab; label: string }[] = [
        { value: "vaccine", label: "疫苗" },
        { value: "ability", label: "发育" },
        { value: "checkup", label: "儿保" },
      ];
      return <div className="health-dynamic-shell">
        <UnifiedTopNavigation
          page="health"
          onBack={() => navigatePage("home")}
          onNotifications={openHeaderNotifications}
          onReport={openHeaderReport}
          variant="dynamic"
        />
        <div className="health-dynamic-chrome">
          <SegmentedTabs
            className="journal-tabs health-dynamic-tabs"
            values={healthTabs}
            active={healthTab}
            onChange={(value) => { keyboard.hide(); setHealthTab(value); }}
            label="健康记录分类"
            idPrefix="health"
            panelId={(value) => `health-panel-${value}`}
            testId="health-tabs"
          />
        </div>

        <MobileScroll key={healthTab} className="health-dynamic-scroll">{renderHealth()}</MobileScroll>

        <UnifiedBottomNavigation activePage="health" onNavigate={navigatePage} variant="dynamic" />
      </div>;
    }
    const openHeaderMemoryAdd = (trigger: HTMLButtonElement) => {
      lastPageActionRef.current = trigger;
      openNewMemory("moment");
    };
    const staticAdd: StaticAddControl | undefined = page === "home"
      ? { id: "home-add-todo", label: "管理今日待办", centerX: 84.06, centerY: 80.34, onClick: openTodoLibrary }
      : page === "education"
        ? { id: "education-add-music", label: "新增音乐", centerX: 66.35, centerY: 19.18, onClick: () => openEditor("music") }
        : page === "study"
          ? { id: "study-add", label: "新增学习卡", centerX: 68.17, centerY: 18.79, onClick: () => openNewLearning("english") }
          : undefined;
    return <FullScreenImagePage
      page={page}
      hotspots={imageHotspots()}
      onNavigate={navigatePage}
      onActionTrigger={(trigger) => { lastPageActionRef.current = trigger; }}
      onNotifications={openHeaderNotifications}
      onReport={openHeaderReport}
      onMemoryAdd={page === "memory" ? openHeaderMemoryAdd : undefined}
      staticAdd={staticAdd}
      homeDate={page === "home" ? homeDateHeading(homeNow) : undefined}
      summary={homeSummary}
    >
      {page === "home" ? renderHomeLiveOverlay() : null}
    </FullScreenImagePage>;
  };

  const careListContent = (list: CareList) => {
    if (list === "feeding") return sortedFeedings.map((item) => <article className="sheet-record" key={item.id}><div><span>{displayDate(item.time)} · {displayTime(item.time)}</span><strong>{item.amount} ml · {item.milkType}</strong><p>{item.note || "没有补充备注"}</p></div><MiniActions label={`${displayTime(item.time)} 的喂养记录`} onEdit={() => openEditor("feeding", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("feeding", item.id)} /></article>);
    if (list === "sleep") return sortedSleeps.map((item) => <article className="sheet-record" key={item.id}><div><span>{displayDate(item.start)} · {displayTime(item.start)} – {displayTime(item.end)}</span><strong>{durationLabel(item.start, item.end)}</strong><p>{item.note || "没有补充备注"}</p></div><MiniActions label={`${displayTime(item.start)} 的睡眠记录`} onEdit={() => openEditor("sleep", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("sleep", item.id)} /></article>);
    if (list === "diaper") return sortedDiapers.map((item) => <article className="sheet-record" key={item.id}><div><span>{displayDate(item.time)} · {displayTime(item.time)}</span><strong>{item.status}</strong><p>{item.note || "没有补充备注"}</p></div><MiniActions label={`${displayTime(item.time)} 的便便记录`} onEdit={() => openEditor("diaper", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("diaper", item.id)} /></article>);
    return sortNewest(data.supplements, (item) => item.date).map((item) => <article className="sheet-record" key={item.id}><div><span>{displayDate(item.date, true)}</span><strong>{item.name}</strong><p>{item.completed ? "已完成" : "待完成"}</p></div><button className={`sheet-check ${item.completed ? "done" : ""}`} type="button" onClick={() => toggleSupplement(item.id)} data-scroll-drag="ignore">{item.completed ? <CheckIcon /> : "打卡"}</button><MiniActions label={item.name} onEdit={() => openEditor("supplement", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("supplement", item.id)} /></article>);
  };

  const listTitle = (list: CareList) => ({ feeding: "喂养记录", sleep: "睡眠记录", diaper: "便便记录", supplement: "补剂打卡" })[list];

  const libraryTabs = <T extends string,>(
    options: { value: T; label: string }[],
    active: T,
    onSelect: (value: T) => void,
    label: string,
    idPrefix: string,
    panelId: string,
  ) => <SegmentedTabs<T> className="library-switcher" values={options} active={active} onChange={onSelect} label={label} idPrefix={idPrefix} panelId={panelId} />;

  const todoLibraryContent = () => <div className="library-sheet">
    <button className="primary-button" type="button" onClick={() => openEditor("todo")} data-scroll-drag="ignore"><PlusIcon /> 新增待办</button>
    <div className="library-record-list">
      {data.todos.map((item) => <article className={`library-record todo-manager-record${item.completed ? " is-complete" : ""}`} key={item.id}>
        <button className={`sheet-check ${item.completed ? "done" : ""}`} type="button" onClick={() => toggleTodo(item.id)} aria-label={`${item.completed ? "取消完成" : "完成"} ${item.title}`} aria-pressed={item.completed} data-scroll-drag="ignore">{item.completed ? <CheckIcon /> : "待办"}</button>
        <button className="library-record-main" type="button" onClick={() => openEditor("todo", item as unknown as Record<string, unknown>)} data-scroll-drag="ignore"><span>{item.completed ? "已完成" : "今天待办"}</span><strong>{item.title}</strong><p>{item.completed ? "点击左侧可以重新标记为待办" : "完成后点击左侧打勾"}</p></button>
        <MiniActions label={item.title} onEdit={() => openEditor("todo", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("todo", item.id)} />
      </article>)}
      {!data.todos.length ? <EmptyState text="今天还没有待办，点上方按钮添加第一项。" /> : null}
    </div>
  </div>;

  const growthLibraryContent = () => <div className="library-sheet">
    <button className="primary-button" type="button" onClick={() => openEditor("growth")} data-scroll-drag="ignore"><PlusIcon /> 新增成长记录</button>
    <div className="library-record-list">
      {sortedGrowth.map((item) => <article className="library-record" key={item.id}>
        <button className="library-record-main" type="button" onClick={() => openEditor("growth", item as unknown as Record<string, unknown>)} data-scroll-drag="ignore"><span>{displayDate(item.date, true)}</span><strong>{typeof item.weight === "number" ? `${item.weight} kg` : "未记录体重"} · {typeof item.height === "number" ? `${item.height} cm` : "未记录身长"}</strong><p>{item.note || "没有补充备注"}</p></button>
        <MiniActions label={`${displayDate(item.date, true)} 的成长记录`} onEdit={() => openEditor("growth", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("growth", item.id)} />
      </article>)}
      {!sortedGrowth.length ? <EmptyState text="还没有成长记录，点上方按钮添加第一次测量。" /> : null}
    </div>
  </div>;

  const memoryLibraryContent = (filter: "all" | MemoryType) => {
    const items = sortNewest(data.memories, (item) => item.date).filter((item) => filter === "all" || item.type === filter);
    return <div className="library-sheet">
      {libraryTabs([
        { value: "all", label: "全部" },
        { value: "moment", label: "瞬间" },
        { value: "photo", label: "照片" },
        { value: "note", label: "随记" },
      ], filter, openMemoryLibrary, "成长回忆分类", "memory-library", "memory-library-panel")}
      <div id="memory-library-panel" className="library-panel" role="tabpanel" aria-labelledby={`memory-library-tab-${filter}`}>
        <button className="primary-button" type="button" onClick={() => filter === "all" ? openNewMemory("moment") : openNewMemory(filter)} data-scroll-drag="ignore"><PlusIcon /> 新增{filter === "photo" ? "照片" : filter === "note" ? "随记" : "瞬间"}</button>
        <div className="library-record-list">
        {items.map((item) => {
          const image = item.assetId ? assetUrls[item.assetId] : item.type === "photo" ? "/assets/baby/memory-luna-cuddle-v1.png" : undefined;
          return <article className="library-record with-leading" key={item.id}>
            {image ? <img className="library-record-image" src={image} alt="" /> : <span className={`library-record-doodle ${item.type}`} aria-hidden="true">{item.type === "note" ? <ReaderIcon /> : <HeartFilledIcon />}</span>}
            <button className="library-record-main" type="button" onClick={() => setOverlay({ type: "memory-detail", id: item.id })} data-scroll-drag="ignore"><span>{memoryDisplayDate(item.date)} · {item.type === "moment" ? "瞬间" : item.type === "photo" ? "照片" : "随记"}</span><strong>{item.title}</strong><p>{item.description}</p></button>
            <MiniActions label={item.title} onEdit={() => openEditor("memory", item as unknown as Record<string, unknown>)} onDelete={() => removeItem("memory", item.id)} />
          </article>;
        })}
        {!items.length ? <EmptyState text="这里还没有记录，点上方按钮写下第一条吧。" /> : null}
        </div>
      </div>
    </div>;
  };

  const healthLibraryContent = (tab: HealthTab) => {
    const records = tab === "vaccine"
      ? data.vaccines
      : tab === "ability"
        ? sortNewest(data.abilities, (item) => item.date)
        : sortNewest(data.checkups, (item) => item.date);
    return <div className="library-sheet">
      {libraryTabs([
        { value: "vaccine", label: "疫苗" },
        { value: "ability", label: "发育" },
        { value: "checkup", label: "儿保" },
      ], tab, openHealthLibrary, "健康记录分类", "health-library", "health-library-panel")}
      <div id="health-library-panel" className="library-panel" role="tabpanel" aria-labelledby={`health-library-tab-${tab}`}>
        <button className="primary-button" type="button" onClick={() => openEditor(tab)} data-scroll-drag="ignore"><PlusIcon /> 新增{editorTitle(tab)}</button>
        <div className="library-record-list">
        {records.map((record) => {
          const scheduleVaccine = tab === "vaccine" && Boolean((record as Vaccine).scheduleKey);
          const summary = tab === "vaccine"
            ? `${(record as Vaccine).dose} · ${(record as Vaccine).ageLabel || (record as Vaccine).protects}`
            : tab === "ability"
              ? (record as Ability).description
              : (record as Checkup).tips;
          const date = tab === "vaccine" ? (record as Vaccine).completedDate || (record as Vaccine).dueDate : (record as Ability | Checkup).date;
          return <article className="library-record" key={record.id}>
            <button className="library-record-main" type="button" onClick={() => scheduleVaccine ? toggleVaccineCompletion(record.id) : openEditor(tab, record as unknown as Record<string, unknown>)} aria-label={scheduleVaccine ? `${(record as Vaccine).completedDate ? "取消已接种" : "标记为已接种"}：${record.name} ${(record as Vaccine).dose}` : undefined} data-scroll-drag="ignore"><span>{displayDate(date, true)}</span><strong>{record.name}</strong><p>{summary}</p></button>
            {!scheduleVaccine ? <MiniActions label={record.name} onEdit={() => openEditor(tab, record as unknown as Record<string, unknown>)} onDelete={() => removeItem(tab, record.id)} /> : null}
          </article>;
        })}
        {!records.length ? <EmptyState text="还没有记录，点上方按钮新增一条。" /> : null}
        </div>
      </div>
    </div>;
  };

  const educationLibraryContent = (tab: EducationTab) => <div className="library-sheet">
    {libraryTabs([
      { value: "music", label: "音乐" },
      { value: "story", label: "故事" },
    ], tab, openEducationLibrary, "早期教育分类", "education-library", "education-library-panel")}
    <div id="education-library-panel" className="library-panel" role="tabpanel" aria-labelledby={`education-library-tab-${tab}`}>
      <button className="primary-button" type="button" onClick={() => openEditor(tab)} data-scroll-drag="ignore"><PlusIcon /> 新增{tab === "music" ? "音乐" : "故事"}</button>
      <div className="library-record-list">
      {tab === "music" ? data.musicTracks.map((track) => {
        const isPlaying = playingId === track.id;
        const isPaused = pausedId === track.id;
        const isActive = isPlaying || isPaused;
        const duration = isActive && playback.duration ? playback.duration : track.durationSeconds ?? 0;
        return <article className={`library-record media-record${isPlaying ? " is-playing" : ""}${isPaused ? " is-paused" : ""}`} key={track.id}>
          <button className={`library-media-action${isPlaying ? " active" : ""}`} type="button" onClick={() => void playTrack(track)} aria-label={isPlaying ? `暂停 ${track.name}` : isPaused ? `继续播放 ${track.name}` : `播放 ${track.name}`} aria-pressed={isPlaying} data-scroll-drag="ignore">{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
          <div className="library-record-main static"><span>{trackDurationLabel(duration)} · {track.assetId ? isPaused ? "已暂停" : "已上传" : "等待上传音频"}</span><strong>{track.name}</strong><p>{track.description || track.artist}</p>{isActive ? <input className="library-progress" type="range" min="0" max={Math.max(duration, 1)} step="0.1" value={Math.min(playback.current, Math.max(duration, 1))} onChange={(event) => seekTrack(track.id, Number(event.target.value))} data-scroll-drag="ignore" aria-label={`${track.name} 播放进度`} /> : null}</div>
          <MiniActions label={track.name} onEdit={() => openEditor("music", track as unknown as Record<string, unknown>)} onDelete={() => removeItem("music", track.id)} />
        </article>;
      }) : data.stories.map((story) => {
        const cover = story.coverId ? assetUrls[story.coverId] : undefined;
        return <article className="library-record with-leading story-manager-record" key={story.id}>
          {cover
            ? <img className="library-record-image story-cover-preview" src={cover} alt={`${story.name} 封面`} />
            : <span className="library-record-doodle story" aria-hidden="true"><ReaderIcon /></span>}
          <button className="library-record-main" type="button" onClick={() => openStory(story)} aria-label={`打开 ${story.name} 外部故事`} data-scroll-drag="ignore"><span>外部儿童故事 · 打开链接 <ExternalLinkIcon aria-hidden="true" /></span><strong>{story.name}</strong><p>{story.link}</p></button>
          <MiniActions label={story.name} onEdit={() => openEditor("story", story as unknown as Record<string, unknown>)} onDelete={() => removeItem("story", story.id)} />
        </article>;
      })}
      {tab === "music" && !data.musicTracks.length ? <EmptyState text="音乐库还是空的，先上传一首宝宝喜欢的音乐吧。" /> : null}
      {tab === "story" && !data.stories.length ? <EmptyState text="故事书架还是空的，先添加一个故事链接吧。" /> : null}
      </div>
    </div>
  </div>;

  const studyLibraryContent = (tab: StudyTab) => {
    const items = data.learningItems.filter((item) => item.kind === tab);
    return <div className="library-sheet">
      {libraryTabs([
        { value: "english", label: "English" },
        { value: "chinese", label: "中文" },
      ], tab, openStudyLibrary, "学习语言", "study-library", "study-library-panel")}
      <div id="study-library-panel" className="library-panel" role="tabpanel" aria-labelledby={`study-library-tab-${tab}`}>
        <button className="primary-button" type="button" onClick={() => openNewLearning(tab)} data-scroll-drag="ignore"><PlusIcon /> 新增{tab === "english" ? "英文" : "中文"}学习卡</button>
        <div className="study-manager-grid">
        {items.map((item) => {
          const image = item.imageId && assetUrls[item.imageId]
            ? assetUrls[item.imageId]
            : `/assets/baby/study-${item.artworkKey ?? "bear"}-v1.png`;
          return <article className="study-manager-card" key={item.id}>
            <button className="study-manager-main" type="button" onClick={() => openEditor("learning", item as unknown as Record<string, unknown>)} data-scroll-drag="ignore"><img src={image} alt={item.translation} /><strong>{item.term}</strong><span>{item.translation}</span></button>
            <div className="study-manager-actions"><button type="button" className={speakingId === item.id ? "active" : ""} onClick={() => speak(item)} aria-label={`发音 ${item.term}`} aria-pressed={speakingId === item.id} data-scroll-drag="ignore"><SpeakerLoudIcon /></button><button type="button" onClick={() => openEditor("learning", item as unknown as Record<string, unknown>)} aria-label={`编辑 ${item.term}`} data-scroll-drag="ignore"><Pencil1Icon /></button><button type="button" onClick={() => removeItem("learning", item.id)} aria-label={`删除 ${item.term}`} data-scroll-drag="ignore"><TrashIcon /></button></div>
          </article>;
        })}
      </div>
      {!items.length ? <EmptyState text="还没有学习卡，点上方按钮新增第一张。" /> : null}
      </div>
    </div>;
  };

  const renderEditorFields = () => {
    if (!editor) return null;
    const inputControl = (key: string, type: string, props: InputHTMLAttributes<HTMLInputElement>) => {
      const inputProps: InputHTMLAttributes<HTMLInputElement> = {
        ...props,
        type,
        value: draftValue(key),
        onChange: (event) => changeDraft(key, event.target.value),
      };
      return nativeInputs
        ? <input {...inputProps} onFocus={handleNativeInputFocus} data-native-input="true" />
        : <KeyboardInput {...inputProps} />;
    };
    const textareaControl = (key: string, props: TextareaHTMLAttributes<HTMLTextAreaElement>) => {
      const textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {
        ...props,
        value: draftValue(key),
        onChange: (event) => changeDraft(key, event.target.value),
      };
      return nativeInputs
        ? <textarea {...textareaProps} onFocus={handleNativeInputFocus} data-native-input="true" />
        : <KeyboardTextarea {...textareaProps} />;
    };
    const field = (label: string, key: string, type = "text", props: InputHTMLAttributes<HTMLInputElement> = {}) => <label className="form-field"><span>{label}</span>{inputControl(key, type, props)}</label>;
    const textarea = (label: string, key: string, placeholder = "") => <label className="form-field"><span>{label}</span>{textareaControl(key, { placeholder })}</label>;
    const select = (label: string, key: string, options: { value: string; label: string }[]) => <label className="form-field"><span>{label}</span><select value={draftValue(key)} onChange={(event) => changeDraft(key, event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    const file = (label: string, accept: "image/*" | "audio/*", preview?: string) => {
      const uploadKind = accept === "audio/*" ? "audio" : "image";
      return <label className="form-field upload-field" data-scroll-drag="ignore">
        <span>{label}</span>
        <span className="native-file-picker">
          <input
            type="file"
            accept={accept}
            aria-label={label}
            onClick={(event) => { event.currentTarget.value = ""; }}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];
              chooseUpload(selected, uploadKind);
              event.currentTarget.value = "";
            }}
            data-scroll-drag="ignore"
          />
          <span className="native-file-picker-label"><PlusIcon /> {uploadKind === "image" ? "从相册或文件选择" : "从文件选择音频"}</span>
        </span>
        <small role="status">{upload ? `已选择：${upload.name} · ${formatFileSize(upload.size)}` : "文件只保存在当前设备"}</small>
        {uploadError ? <em className="upload-error" role="alert">{uploadError}</em> : null}
        {upload && uploadKind === "image" && uploadPreviewFailed ? <em className="upload-preview-note">文件已选中，当前浏览器暂不能预览该格式，仍可保存。</em> : null}
        {preview && !uploadPreviewFailed ? <img className="native-upload-preview" src={preview} alt={`${label}预览`} onError={() => setUploadPreviewFailed(true)} /> : null}
      </label>;
    };
    if (editor.kind === "profile") return <>{data.demoMode ? <div className="demo-callout"><strong>当前是硕之的示例数据</strong><p>默认会在保存资料时清除内置示例；你自己新增的记录会保留。</p><button className={`secondary-button ${draft.clearDemo ? "selected" : ""}`} type="button" onClick={() => changeDraft("clearDemo", !Boolean(draft.clearDemo))} data-scroll-drag="ignore">{draft.clearDemo ? <><CheckIcon /> 保存时清除内置示例</> : "保留示例记录"}</button></div> : null}<div className="fixed-profile-summary"><strong>硕之</strong><span>出生日期：2026年8月4日</span><span>出生体重：2.4 kg · 出生身高：48 cm</span></div>{file("宝宝照片", "image/*", uploadPreviewUrl ?? (data.baby.avatarId ? assetUrls[data.baby.avatarId] : undefined))}</>;
    if (editor.kind === "feeding") return <>{field("喂养时间", "time", "datetime-local")}{field("奶量 ml", "amount", "number", { min: "0" })}{select("喂养类型", "milkType", [{ value: "母乳", label: "母乳" }, { value: "配方奶", label: "配方奶" }, { value: "混合喂养", label: "混合喂养" }])}{textarea("备注", "note")}</>;
    if (editor.kind === "sleep") return <>{field("开始时间", "start", "datetime-local")}{field("结束时间", "end", "datetime-local")}{textarea("备注", "note", "例如：午睡、夜间容易醒")}</>;
    if (editor.kind === "diaper") return <>{field("便便时间", "time", "datetime-local")}{select("便便状态", "status", [{ value: "正常软便", label: "正常软便" }, { value: "偏稀", label: "偏稀" }, { value: "偏硬", label: "偏硬" }, { value: "其他", label: "其他" }])}{textarea("备注", "note")}</>;
    if (editor.kind === "supplement") return <>{field("补剂名称", "name")}{field("日期", "date", "date")}<label className="switch-field"><input type="checkbox" checked={Boolean(draft.completed)} onChange={(event) => changeDraft("completed", event.target.checked)} data-scroll-drag="ignore"/><span>今天已经完成</span></label></>;
    if (editor.kind === "todo") return <>{field("待办内容", "title", "text", { placeholder: "例如：洗澡时间" })}<label className="switch-field"><input type="checkbox" checked={Boolean(draft.completed)} onChange={(event) => changeDraft("completed", event.target.checked)} data-scroll-drag="ignore"/><span>标记为已完成</span></label></>;
    if (editor.kind === "memory") {
      const editingMemory = editor.id ? data.memories.find((item) => item.id === editor.id) : undefined;
      const persistedPreview = editingMemory?.assetId ? assetUrls[editingMemory.assetId] : editingMemory?.type === "photo" ? "/assets/baby/memory-luna-cuddle-v1.png" : undefined;
      const preview = uploadPreviewUrl ?? persistedPreview;
      return <>{draftValue("sourceAbilityId") ? <div className="linked-note"><strong>成长旅程 · 能力记录</strong><p>这是同一条里程碑，在这里修改会同步到健康记录。</p></div> : select("内容类型", "type", [{ value: "moment", label: "瞬间 · 第一次" }, { value: "photo", label: "照片" }, { value: "note", label: "随记" }])}{field("标题", "title")}{field("日期", "date", "date", draftValue("sourceAbilityId") ? { min: FIXED_BIRTH_DATE, max: today() } : {})}{textarea("内容", "description")}{file(draftValue("type") === "photo" ? "上传照片 *" : "照片（可选）", "image/*")}{draftValue("type") === "photo" && preview && !uploadPreviewFailed ? <figure className="memory-upload-preview"><img src={preview} alt="照片预览" onError={() => setUploadPreviewFailed(true)} /><figcaption>照片会按原始比例保存，并仅在卡片中居中裁切。</figcaption></figure> : null}</>;
    }
    if (editor.kind === "growth") return <>{field("测量日期 *", "date", "date", { max: today() })}<p className="form-hint">身长和体重可以只填一项；同一天只保留一条完整记录。</p><div className="form-columns">{field("身长 cm（可选）", "height", "number", { step: "0.1", min: "20", max: "200" })}{field("体重 kg（可选）", "weight", "number", { step: "0.01", min: "0.5", max: "50" })}</div>{textarea("成长备注（可选）", "note", "例如：坐得更稳了、第一次量身高")}</>;
    if (editor.kind === "vaccine") return <>
      {field("年龄阶段 *", "ageLabel", "text", { placeholder: "例如：7月龄" })}
      {field("疫苗名称 *", "name")}
      {field("接种次数 *", "dose", "text", { placeholder: "例如：第1/2针" })}
      {field("计划接种日期 *", "dueDate", "date", { min: FIXED_BIRTH_DATE })}
      {field("实际接种日期（可选）", "completedDate", "date", { min: FIXED_BIRTH_DATE, max: today() })}
      {textarea("接种备注（可选）", "note", "例如：与另一种方案二选一")}
      <p className="form-hint">价格不在本应用中记录；接种安排以当地接种门诊为准。</p>
    </>;
    if (editor.kind === "ability") {
      const editingAbility = editor.id ? data.abilities.find((item) => item.id === editor.id) : undefined;
      const preview = uploadPreviewUrl ?? (editingAbility?.imageId ? assetUrls[editingAbility.imageId] : undefined);
      return <>{field("记录日期", "date", "date", { min: FIXED_BIRTH_DATE, max: today() })}{field("大运动能力", "name")}{textarea("表现说明", "description")}{file("示意图（可选）", "image/*")}{preview && !uploadPreviewFailed ? <figure className="memory-upload-preview health-ability-upload-preview"><img src={preview} alt="发育里程碑图片预览" onError={() => setUploadPreviewFailed(true)} /><figcaption>图片将以原色保存，并在里程碑卡片中居中显示。</figcaption></figure> : null}<p className="form-hint">支持 JPG、PNG、WebP、HEIC，最大 12 MB；图片只保存在当前设备。</p><label className="switch-field"><input type="checkbox" checked={Boolean(draft.syncMemory)} onChange={(event) => changeDraft("syncMemory", event.target.checked)} data-scroll-drag="ignore"/><span>同步到成长回忆 · 瞬间（同一条记录）</span></label>{editor.id && data.memories.some((memory) => memory.sourceAbilityId === editor.id) && !draft.syncMemory ? <p className="unlink-warning">保存后，这条内容会从成长回忆移除，但健康记录会保留。</p> : null}</>;
    }
    if (editor.kind === "checkup") return <>
      {field("计划 / 儿保日期", "date", "date", { min: FIXED_BIRTH_DATE })}
      {field("儿保项目名", "name")}
      {textarea("建议", "tips")}
      <label className="switch-field"><input type="checkbox" checked={Boolean(draft.completed)} onChange={(event) => changeDraft("completed", event.target.checked)} data-scroll-drag="ignore"/><span>已经完成本次儿保</span></label>
      {draft.completed ? field("实际完成日期", "completedDate", "date", { min: FIXED_BIRTH_DATE, max: today() }) : null}
    </>;
    if (editor.kind === "music") return <>{field("音乐名称", "name")}{field("歌手 / 来源", "artist")}{textarea("一句温柔说明（可选）", "description", "例如：轻柔的声音，陪宝宝安心入睡。")}{file(editor.id && draftValue("assetId") ? "替换音乐（可选）" : "上传音乐 *", "audio/*")}<p className="form-hint">支持 MP3、M4A、WAV 等常用音频，最大 40 MB；文件只保存在当前设备。</p></>;
    if (editor.kind === "story") return <>{field("故事名称", "name")}{field("外部链接", "link", "url", { placeholder: "https://..." })}{file("故事封面（可选）", "image/*")}</>;
    return <>
      {select("语言 *", "kind", [{ value: "english", label: "English" }, { value: "chinese", label: "中文" }])}
      {field("单词 / 汉字 *", "term")}
      {field("释义 *", "translation")}
      {select("内置手绘图例", "artworkKey", studyArtworkOptions.map((option) => ({ value: option.key, label: `${option.english} · ${option.chinese}` })))}
      {file("替换为自己的图片（可选）", "image/*")}
      <p className="form-hint">图片最大 12 MB，仅保存在当前设备；不上传时使用上方选择的手绘图例。</p>
    </>;
  };

  const selectedMemory = overlay?.type === "memory-detail" ? data.memories.find((item) => item.id === overlay.id) : undefined;
  const selectedMemoryImage = selectedMemory?.assetId ? assetUrls[selectedMemory.assetId] : selectedMemory?.type === "photo" ? "/assets/baby/memory-luna-cuddle-v1.png" : undefined;
  const overlayTitle = !overlay
    ? ""
    : overlay.type === "list"
      ? listTitle(overlay.list)
      : overlay.type === "report"
        ? "宝宝基本报告"
        : overlay.type === "memory-detail"
          ? "回忆详情"
          : overlay.type === "memory-library"
            ? "成长回忆"
            : overlay.type === "health-library"
              ? "健康记录"
              : overlay.type === "education-library"
                ? "早期教育"
                : overlay.type === "study-library"
                  ? "学习记录"
                  : overlay.type === "todo-library"
                    ? "今日待办"
                    : overlay.type === "growth-library"
                      ? "生长记录"
                      : "今日提醒";
  const overlayDescription = overlay?.type === "report"
    ? "选择范围与隐私项，再一键分享给家人。"
    : overlay?.type === "memory-detail"
      ? "硕之成长故事里，值得珍藏的一页。"
      : overlay && ["memory-library", "health-library", "education-library", "study-library", "todo-library", "growth-library"].includes(overlay.type)
        ? "这里显示真实保存的数据，可新增、修改、删除并立即再次使用。"
        : undefined;
  const overlaySnap = overlay?.type === "report"
    ? 0.78
    : overlay?.type === "memory-detail"
      ? 0.7
      : overlay && ["memory-library", "health-library", "education-library", "study-library", "todo-library", "growth-library"].includes(overlay.type)
        ? 0.84
        : 0.72;

  return (
    <div className="baby-app-shell" data-native-inputs={nativeInputs ? "true" : "false"}>
      {renderPage()}

      <BottomSheet open={Boolean(overlay)} onOpenChange={(open) => { if (!open) { keyboard.hide(); setOverlay(null); } }} title={overlayTitle} description={overlayDescription} snap={overlaySnap}>
        {overlay?.type === "list" ? <div className="sheet-record-list"><button className="primary-button" type="button" onClick={() => openEditor(overlay.list)} data-scroll-drag="ignore"><PlusIcon /> 新增一条</button>{careListContent(overlay.list)}</div> : null}
        {overlay?.type === "todo-library" ? todoLibraryContent() : null}
        {overlay?.type === "growth-library" ? growthLibraryContent() : null}
        {overlay?.type === "memory-library" ? memoryLibraryContent(overlay.filter) : null}
        {overlay?.type === "health-library" ? healthLibraryContent(overlay.tab) : null}
        {overlay?.type === "education-library" ? educationLibraryContent(overlay.tab) : null}
        {overlay?.type === "study-library" ? studyLibraryContent(overlay.tab) : null}
        {overlay?.type === "report" ? <div className="report-sheet">
          {data.demoMode ? <p className="report-demo-warning"><strong>当前是示例报告</strong> 请先点击首页头像填写真实资料；若继续分享，报告正文也会带示例标记。</p> : null}
          <div className="report-controls">
            <label><span>统计范围</span><select value={String(reportDays)} onChange={(event) => setReportDays(Number(event.target.value) as 1 | 7 | 30 | 0)} data-scroll-drag="ignore"><option value="1">近 24 小时</option><option value="7">近 7 天</option><option value="30">近 30 天</option><option value="0">全部记录</option></select></label>
            <label className="switch-field"><input type="checkbox" checked={reportShowName} onChange={(event) => setReportShowName(event.target.checked)} data-scroll-drag="ignore"/><span>报告中显示宝宝姓名</span></label>
            <label className="switch-field"><input type="checkbox" checked={reportIncludeHealth} onChange={(event) => setReportIncludeHealth(event.target.checked)} data-scroll-drag="ignore"/><span>包含补剂与疫苗提醒</span></label>
            <label className="switch-field"><input type="checkbox" checked={reportIncludeMemories} onChange={(event) => setReportIncludeMemories(event.target.checked)} data-scroll-drag="ignore"/><span>包含成长回忆数量（默认关闭）</span></label>
          </div>
          <details className="report-preview"><summary>查看报告预览</summary><pre>{reportText}</pre></details>
          <div className="report-actions"><button className="primary-button" type="button" onClick={() => void shareReport()} data-scroll-drag="ignore"><Share1Icon /> {data.demoMode ? "分享示例报告" : "一键分享"}</button><button className="secondary-button" type="button" onClick={downloadReport} data-scroll-drag="ignore"><DownloadIcon /> 保存文本报告</button></div>
        </div> : null}
        {overlay?.type === "notifications" ? <div className="notification-list"><article><span className={`notice-dot ${nextVaccineOverdue ? "coral" : "yellow"}`}/><div><strong>{nextVaccineOverdue ? "疫苗接种已逾期" : "下一针疫苗"}</strong><p>{nextVaccine ? `${nextVaccine.name} ${nextVaccine.dose} · ${displayDate(nextVaccine.dueDate)}` : "目前没有待接种项目"}</p></div></article><article><span className="notice-dot blue"/><div><strong>今日待办</strong><p>还有 {data.todos.filter((item) => !item.completed).length} 项没有完成。</p></div></article><article><span className="notice-dot coral"/><div><strong>温柔提醒</strong><p>今天也可以记下一张照片或一个第一次。</p></div></article></div> : null}
        {overlay?.type === "memory-detail" && selectedMemory ? <article className={`memory-detail-sheet ${selectedMemory.type}`}>
          {selectedMemoryImage ? <img className="memory-detail-photo" src={selectedMemoryImage} alt={selectedMemory.title} /> : <div className="memory-detail-doodle" aria-hidden="true">{selectedMemory.type === "note" ? <ReaderIcon /> : <FaceIcon />}</div>}
          <div className="memory-detail-meta"><span>{selectedMemory.type === "moment" ? "成长旅程" : selectedMemory.type === "photo" ? "照片回忆" : "宝宝随记"}</span><time>{memoryDisplayDate(selectedMemory.date)}</time></div>
          <h2>{selectedMemory.title}</h2>
          <p>{selectedMemory.description}</p>
          {selectedMemory.sourceAbilityId ? <em className="linked-badge">已关联健康记录</em> : null}
          <div className="memory-detail-actions"><button className="secondary-button" type="button" onClick={() => openEditor("memory", selectedMemory as unknown as Record<string, unknown>)} data-scroll-drag="ignore"><Pencil1Icon /> 编辑</button><button className="danger-button" type="button" onClick={() => removeItem("memory", selectedMemory.id)} data-scroll-drag="ignore"><TrashIcon /> 删除</button></div>
        </article> : null}
      </BottomSheet>

      <BottomSheet open={Boolean(editor)} onOpenChange={(open) => { if (!open) closeEditor(); }} title={editor ? editor.kind === "profile" ? "修改宝宝资料" : `${editor.id ? "修改" : "新增"}${editorTitle(editor.kind)}` : "编辑"} description="带 * 的核心信息请完整填写。" snap={0.82}>
        <form className="editor-form" onSubmit={(event) => { event.preventDefault(); void saveEditor(); }}>
          {renderEditorFields()}
          <button className="primary-button save-button" type="submit" disabled={savingEditor} aria-busy={savingEditor} data-scroll-drag="ignore"><CheckIcon /> {savingEditor ? "正在保存…" : "保存记录"}</button>
          {editor?.id && editor.kind !== "profile" && !(editor.kind === "vaccine" && data.vaccines.some((item) => item.id === editor.id && item.scheduleKey)) ? <button className="danger-button editor-delete-button" type="button" onClick={() => { const activeEditor = editor; if (!activeEditor?.id || activeEditor.kind === "profile") return; setEditor(null); setUpload(undefined); removeItem(activeEditor.kind, activeEditor.id); }} data-scroll-drag="ignore"><TrashIcon /> 删除这条{editorTitle(editor.kind)}</button> : null}
        </form>
      </BottomSheet>

      <BottomSheet open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) closeDeleteConfirmation(false); }} title="确认删除" description={pendingDelete ? deletePrompt(pendingDelete.kind, pendingDelete.id) : undefined} snap={0.36}>
        <div className="confirm-sheet">
          <button className="secondary-button" type="button" onClick={() => closeDeleteConfirmation(false)} data-scroll-drag="ignore">取消</button>
          <button className="danger-button" type="button" onClick={() => { if (!pendingDelete) return; performRemoveItem(pendingDelete.kind, pendingDelete.id); closeDeleteConfirmation(true); }} data-scroll-drag="ignore"><TrashIcon /> 确认删除</button>
        </div>
      </BottomSheet>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
