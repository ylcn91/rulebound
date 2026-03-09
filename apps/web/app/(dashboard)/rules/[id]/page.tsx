import { notFound } from "next/navigation";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { RuleForm } from "@/components/dashboard/RuleForm";
import { describeApiError, isRuleboundApiError } from "@/lib/api";
import { fetchRuleDetail } from "@/lib/dashboard-data";

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const rule = await fetchRuleDetail(id);
    return <RuleForm mode="edit" rule={rule} />;
  } catch (error) {
    if (isRuleboundApiError(error) && error.status === 404) {
      notFound();
    }

    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Rule Detail"
        subheading="Edit or remove a backend-authored rule."
        title={description.title}
        description={description.description}
      />
    );
  }
}
