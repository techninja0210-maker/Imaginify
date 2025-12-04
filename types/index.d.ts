/* eslint-disable no-unused-vars */

// ====== USER PARAMS
declare type CreateUserParams = {
  clerkId: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  photo: string;
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
};

declare type UpdateUserParams = {
  firstName: string | null;
  lastName: string | null;
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
  organizationId?: string;
  type: TransformationTypeKey;
  creditBalance: number;
  data?: any | null;
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
declare interface JobMetadata {
  publicId?: string;
  width?: number;
  height?: number;
  secureURL?: string;
  transformationURL?: string;
  aspectRatio?: string;
  prompt?: string;
  color?: string;
  config?: any;
}

declare interface Job {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  description?: string | null;
  workflowType: string;
  status: string;
  quotedCredits?: number | null;
  quotedAt?: Date | null;
  confirmedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  totalInternalCostUsd?: number | null;
  totalRetailCostCredits?: number | null;
  resultUrl?: string | null;
  errorMessage?: string | null;
  metadata?: JobMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}
declare type AddJobParams = {
  job: Pick<Job, 'title' | 'description' | 'workflowType' | 'status'> & { metadata?: JobMetadata };
  userId: string;
  organizationId: string;
  path: string;
};

declare type UpdateJobParams = {
  job: Partial<Omit<Job, 'organizationId' | 'userId' | 'createdAt' | 'updatedAt'>> & { id: string; metadata?: JobMetadata };
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