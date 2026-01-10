import { Id } from "../../../convex/_generated/dataModel";

export interface Slide {
  text: string;
  imageUrl: string;
  overlay?: boolean;
  prompt?: string; // Custom prompt used for image regeneration
}

export interface ContentConfig {
  fontSize: number;
  fontColor: string;
  textPosition: {
    x: number;
    y: number;
  };
  aspectRatio?: "1:1" | "4:5" | "9:16";
}

export interface CarouselContent {
  type: string;
  slides?: Slide[];
  texts?: string[];
  mediaUrls?: string[];
  config?: ContentConfig;
}

export interface InputParams {
  topic?: string;
  slideCount?: number;
  customPrompt?: string;
  variables?: any;
}

export interface ContentItem {
  _id: Id<"content">;
  _creationTime: number;
  productId?: Id<"products">;
  accountId?: Id<"accounts">;
  inputParams: InputParams;
  content: CarouselContent;
  createdAt: number;
  updatedAt: number;
}

export interface Product {
  _id: Id<"products">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AspectRatio = "1:1" | "4:5" | "9:16";
