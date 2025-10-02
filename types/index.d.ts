/* eslint-disable no-unused-vars */

// ====== USER PARAMS
declare type CreateUserParams = {
  clerkId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  photo: string;
};

declare type UpdateUserParams = {
  firstName: string;
  lastName: string;
  username: string;
  photo: string;
};

// ====== IMAGE PARAMS
declare type AddImageParams = {
  image: {
    title: string;
    publicId: string;
    transformationType: string;
    width: number;
    height: number;
    config: any;
    secureURL: string;
    transformationURL: string;
    aspectRatio: string | undefined;
    prompt: string | undefined;
    color: string | undefined;
  };
  userId: string;
  path: string;
};

declare type UpdateImageParams = {
  image: {
    _id: string;
    title: string;
    publicId: string;
    transformationType: string;
    width: number;
    height: number;
    config: any;
    secureURL: string;
    transformationURL: string;
    aspectRatio: string | undefined;
    prompt: string | undefined;
    color: string | undefined;
  };
  userId: string;
  path: string;
};

declare type Transformations = {
  restore?: boolean;
  fillBackground?: boolean;
  remove?: {
    prompt: string;
    removeShadow?: boolean;
    multiple?: boolean;
  };
  recolor?: {
    prompt?: string;
    to: string;
    multiple?: boolean;
  };
  removeBackground?: boolean;
};

// ====== TRANSACTION PARAMS
declare type CheckoutTransactionParams = {
  plan: string;
  credits: number;
  amount: number;
  buyerId: string;
};

declare type CreateTransactionParams = {
  stripeId: string;
  amount: number;
  credits: number;
  plan: string;
  buyerId: string;
  createdAt: Date;
};

declare type TransformationTypeKey =
  | "restore"
  | "fill"
  | "remove"
  | "recolor"
  | "removeBackground";

// ====== URL QUERY PARAMS
declare type FormUrlQueryParams = {
  searchParams: string;
  key: string;
  value: string | number | null;
};

declare type UrlQueryParams = {
  params: string;
  key: string;
  value: string | null;
};

declare type RemoveUrlQueryParams = {
  searchParams: string;
  keysToRemove: string[];
};

declare type SearchParamProps = {
  params: { id: string; type: TransformationTypeKey };
  searchParams: { [key: string]: string | string[] | undefined };
};

declare type TransformationFormProps = {
  action: "Add" | "Update";
  userId: string;
  type: TransformationTypeKey;
  creditBalance: number;
  data?: IImage | null;
  config?: Transformations | null;
};

declare type TransformedImageProps = {
  image: any;
  type: string;
  title: string;
  transformationConfig: Transformations | null;
  isTransforming: boolean;
  hasDownload?: boolean;
  setIsTransforming?: React.Dispatch<React.SetStateAction<boolean>>;
};

// ====== JOB PARAMS (New for ShoppableVideos)
declare type AddJobParams = {
  job: {
    title: string;
    description?: string;
    workflowType: string;
    status?: string;
    quotedCredits?: number;
    quotedAt?: Date;
    confirmedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    totalInternalCostUsd?: number;
    totalRetailCostCredits?: number;
    resultUrl?: string;
    errorMessage?: string;
    metadata?: any;
  };
  userId: string;
  organizationId: string;
  path: string;
};

declare type UpdateJobParams = {
  job: {
    id: string;
    title?: string;
    description?: string;
    status?: string;
    quotedCredits?: number;
    quotedAt?: Date;
    confirmedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    totalInternalCostUsd?: number;
    totalRetailCostCredits?: number;
    resultUrl?: string;
    errorMessage?: string;
    metadata?: any;
  };
  userId: string;
  path: string;
};

declare type CreateJobQuoteParams = {
  organizationId: string;
  userId: string;
  workflowType: string;
  parameters: any;
  totalCredits: number;
  breakdown: any;
  expiresAt: Date;
};

declare type WorkflowTypeKey =
  | "text_to_image"
  | "image_to_video"
  | "text_to_video"
  | "product_video"
  | "ugc_video";