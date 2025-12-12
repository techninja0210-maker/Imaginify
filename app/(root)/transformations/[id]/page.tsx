import { auth } from "@clerk/nextjs";
import Link from "next/link";

import Header from "@/components/shared/Header";
import TransformedImage from "@/components/shared/TransformedImage";
import { Button } from "@/components/ui/button";
import { getJobById } from "@/lib/actions/job.actions";
import { getImageSize } from "@/lib/utils";
import { DeleteConfirmation } from "@/components/shared/DeleteConfirmation";

const ImageDetails = async ({ params: { id } }: SearchParamProps) => {
  const { userId } = auth();

  const job = await getJobById(id);

  return (
    <>
      <Header title={job.title} />

      <section className="mt-5 flex flex-wrap gap-4">
        <div className="p-14-medium md:p-16-medium flex gap-2">
          <p className="text-dark-600">Transformation:</p>
          <p className=" capitalize text-purple-400">
            {job.workflowType}
          </p>
        </div>

        {job.description && (
          <>
            <p className="hidden text-dark-400/50 md:block">&#x25CF;</p>
            <div className="p-14-medium md:p-16-medium flex gap-2 ">
              <p className="text-dark-600">Description:</p>
              <p className=" capitalize text-purple-400">{job.description}</p>
            </div>
          </>
        )}

        {job.status && (
          <>
            <p className="hidden text-dark-400/50 md:block">&#x25CF;</p>
            <div className="p-14-medium md:p-16-medium flex gap-2">
              <p className="text-dark-600">Status:</p>
              <p className=" capitalize text-purple-400">{job.status}</p>
            </div>
          </>
        )}

        {job.quotedCredits && (
          <>
            <p className="hidden text-dark-400/50 md:block">&#x25CF;</p>
            <div className="p-14-medium md:p-16-medium flex gap-2">
              <p className="text-dark-600">Credits Used:</p>
              <p className=" capitalize text-purple-400">{job.quotedCredits}</p>
            </div>
          </>
        )}
      </section>

      <section className="mt-10 border-t border-dark-400/15">
        <div className="transformation-grid">
          {/* MEDIA UPLOADER */}
          <div className="flex flex-col gap-4">
            <h3 className="h3-bold text-dark-600">Original</h3>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/placeholder.jpg"
              alt="job"
              width={400}
              height={400}
              className="transformation-original_image"
            />
          </div>

          {/* TRANSFORMED IMAGE */}
          <TransformedImage
            image={job}
            type={job.workflowType}
            title={job.title}
            isTransforming={false}
            transformationConfig={job.metadata}
            hasDownload={true}
          />
        </div>

        {userId === job.user.clerkId && (
          <div className="mt-4 space-y-4">
            <Button asChild type="button" className="submit-button capitalize">
              <Link href={`/transformations/${job.id}/update`}>
                Update Job
              </Link>
            </Button>

            <DeleteConfirmation imageId={job.id} />
          </div>
        )}
      </section>
    </>
  );
};

export default ImageDetails;