export interface BugDevice {
  browser: string;
  browserVersion: string;
  engine: string;
  os: string;
  osVersion: string;
  deviceType: "desktop" | "tablet" | "mobile";
  userAgent: string;
  viewport: string;
  screen: string;
  devicePixelRatio: number;
  touchPoints: number;
  cores: number | null;
  memoryGb: number | null;
  connection: string;
  languages: string[];
  timezone: string;
  theme: string;
  online: boolean;
}

export interface BugLogEntry {
  at: string;
  level: "error" | "warn" | "info";
  text: string;
}

export interface BugContext {
  route: string;
  appVersion: string;
  capturedAt: string;
}

export interface BugReporter {
  name: string;
  email: string;
  tier: string | null;
  role: string | null;
  scopeLabel: string;
}

export interface BugScreenshot {
  mime: string;
  dataBase64: string;
}

export interface BugBundle {
  description: string;
  device: BugDevice;
  context: BugContext;
  logs: BugLogEntry[];
  reporter: BugReporter;
  serverVersion: string;
  receivedAt: string;
  screenshot: BugScreenshot | null;
}
