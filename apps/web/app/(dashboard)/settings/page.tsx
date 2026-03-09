import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { SettingsClient } from "@/components/dashboard/SettingsClient";
import { describeApiError } from "@/lib/api";
import { fetchTokensList } from "@/lib/dashboard-data";

export default async function SettingsPage() {
  try {
    const tokens = await fetchTokensList();
    return <SettingsClient tokens={tokens} />;
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Settings"
        subheading="Configure CLI access against the backend token contract"
        title={description.title}
        description={description.description}
      />
    );
  }
}
