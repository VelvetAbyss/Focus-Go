export interface Tag {
  id: string;
  name: string;
  icon?: string;
  pinned: boolean;
  children?: Tag[];
  noteCount: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  preview: string;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  trashedAt?: Date;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  imageCount: number;
  fileCount: number;
  headings: { level: number; text: string; id: string }[];
  backlinks: { noteId: string; noteTitle: string }[];
}

export type SystemCollection = "notes" | "today" | "untagged" | "trash";
export type SortOption = "edited" | "created" | "title";
export type ThemeMode = "paper" | "graphite";
export type FontFamily = "sans" | "serif" | "mono";

export interface AppearanceSettings {
  theme: ThemeMode;
  font: FontFamily;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  focusMode: boolean;
}
